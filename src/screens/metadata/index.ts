import { convertFileSrc } from '@tauri-apps/api/core';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';
import { Album, Item, MachineLearning, Util } from '../../util';

export class MetadataScreen extends BaseScreen {

    //Elements
    elementLoading!: HTMLElement
    elementContent!: HTMLElement
    elementStats!: HTMLElement
    elementBack!: HTMLButtonElement
    elementSearch!: HTMLButtonElement
    elementSearchDialog!: HTMLDialogElement
    elementSearchDialogInput!: HTMLInputElement
    elementSearchDialogSearch!: HTMLButtonElement
    elementSearchDialogForm!: HTMLElement
    elementSearchDialogResults!: HTMLElement
    elementClean!: HTMLButtonElement
    elementGenerate!: HTMLButtonElement
    elementLogs!: HTMLElement

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string { return html; }

    //State
    protected onRendered(): void {
        //Get elements
        this.elementLoading = document.getElementById('metadata-loading')!;
        this.elementContent = document.getElementById('metadata-content')!;
        this.elementStats = document.getElementById('metadata-stats')!;
        this.elementBack = document.getElementById('metadata-back') as HTMLButtonElement;
        this.elementSearch = document.getElementById('metadata-search') as HTMLButtonElement;
        this.elementSearchDialog = document.getElementById('metadata-search-dialog') as HTMLDialogElement;
        this.elementSearchDialogForm = document.getElementById('metadata-search-dialog-form')!;
        this.elementSearchDialogInput = document.getElementById('metadata-search-dialog-input') as HTMLInputElement;
        this.elementSearchDialogSearch = document.getElementById('metadata-search-dialog-search') as HTMLButtonElement;
        this.elementSearchDialogResults = document.getElementById('metadata-search-dialog-results')!;
        this.elementClean = document.getElementById('metadata-clean') as HTMLButtonElement;
        this.elementGenerate = document.getElementById('metadata-generate') as HTMLButtonElement;
        this.elementLogs = document.getElementById('metadata-logs')!;

        //Assign back event
        this.elementBack.onclick = () => {
            //Check if loading
            if (this.isWorking) return;

            //Return home
            this.app.open(this.app.homeScreen);
        }

        //Assign search events
        this.elementSearch.onclick = () => {
            //Working
            if (this.isWorking) return;

            //Search
            this.elementSearchDialog.showModal();
            this.toggleSearchResults(false);
        }

        Util.onDialogBackdropClick(this.elementSearchDialog, () => {
            //Close dialog
            this.elementSearchDialog.close();
            this.toggleSearchResults(false);
        });

        const onSearch = () => {
            //Get query
            const query = this.elementSearchDialogInput.value;
            if (query.length < 3) return;

            //Search
            this.search(query);
        }

        this.elementSearchDialogInput.onkeydown = (e) => {
            if (e.key === "Enter") {
                Util.interceptEvent(e);
                onSearch();
            }
        };

        this.elementSearchDialogSearch.onclick = (e) => {
            Util.interceptEvent(e);
            onSearch();
        }

        //Assign clean metadata event
        this.elementClean!.onclick = () => {
            //Working
            if (this.isWorking) return;

            //Start working
            this.setWorking(true);

            //Clean metadata
            this.cleanMetadata().finally(() => {
                //Finish working
                this.setWorking(false);
            });
        }

        //Assign generate metadata event
        this.elementGenerate!.onclick = () => {
            //Working
            if (this.isWorking) return;

            //Start working
            this.setWorking(true);

            //Generate metadata
            this.generateMetadata().finally(() => {
                //Finish working
                this.setWorking(false);
            });
        }
    }

    protected onOpened(): void {
        //Start loading
        this.setWorking(true);
        this.elementContent.setAttribute('hidden', '');

        //Load albums
        this.loadAlbums().finally(() => {
            //Finish loading
            this.setWorking(false);
            this.elementLoading.remove();
            this.elementContent.removeAttribute('hidden');
        });
    }

    protected onClosed(): boolean {
        //Clear albums & logs
        this.clearAlbums();
        this.clearLogs();

        //Reset app state
        this.app.resetState();
        return true;
    }

    //Working
    private isWorking: boolean = false;

    private setWorking(working: boolean) {
        //Update working state
        this.isWorking = working;

        //Update buttons
        this.elementBack.disabled = working;
        this.elementSearch.disabled = working;
        this.elementClean.disabled = working;
        this.elementGenerate.disabled = working;
    }

    //Albums
    private albums: Album[] = [];

    private async loadAlbums(): Promise<boolean> {
        //Load albums
        const success = await Album.loadAlbums(this.app.settings.links, this.albums, true, true, true);

        //Check result
        if (success) {
            //Log result
            this.log('Albums loaded successfully.');

            //Count items
            this.countItemsWithMetadata();
        } else {
            //Log result
            this.log('Failed to load albums: Make sure all links have a valid album folder and metadata file!');
        }
        return success;
    }

    private clearAlbums() {
        //Clear list
        this.albums = [];
    }

    //Stats
    private itemsWithoutMetadata: Item[][] = [];
    private itemsWithoutMetadataCount: number = 0;
    private itemsWithMetadataCount: number = 0;

    private countItemsWithMetadata() {
        //Items without metadata
        this.itemsWithoutMetadata = [];
        this.itemsWithoutMetadataCount = 0;
        this.itemsWithMetadataCount = 0;

        //Get settings
        const ignoreCaptions = this.app.settings.metadataIgnoredTypes.captions;
        const ignoreLabels = this.app.settings.metadataIgnoredTypes.labels;
        const ignoreText = this.app.settings.metadataIgnoredTypes.text;
        const ignoreEmbeddings = this.app.settings.metadataIgnoredTypes.embeddings;

        //Check albums
        for (const album of this.albums) {
            //Create list of items without metadata in this album
            const albumItemsWithoutMetadata: Item[] = [];
            this.itemsWithoutMetadata.add(albumItemsWithoutMetadata);

            //Look for its items without metadata
            for (const item of album.items) {
                const itemMetadata = album.getItemMetadata(item.name);
                if (itemMetadata && 
                    (ignoreCaptions || itemMetadata.caption) && 
                    (ignoreLabels || itemMetadata.labels) && 
                    (ignoreText || itemMetadata.text) && 
                    (ignoreEmbeddings || itemMetadata.embedding)) {
                    //Has metadata
                    this.itemsWithMetadataCount++;
                } else {
                    //Doesn't have metadata
                    albumItemsWithoutMetadata.add(item);
                    this.itemsWithoutMetadataCount++;
                }
            }
        }

        //Show stats
        this.notifyItemsWithMetadataChanged();
    }

    private notifyItemsWithMetadataChanged() {
        //Show stats
        this.elementStats.innerHTML = `<li>Items with metadata: ${this.itemsWithMetadataCount}</li><li>Items without metadata: ${this.itemsWithoutMetadataCount}</li>`;
    }

    //Logs
    private maxLogs: number = 1000;
    private logs: string[] = [];

    private log = (text: string) => {
        //Add log
        console.log(text);
        this.logs.add(text);
        this.elementLogs.appendChild(this.createLogElement(text));

        //Check if max length exceeded
        if (this.logs.length > this.maxLogs) {
            //Exceeded -> Remove first
            this.logs.removeAt(0);
            this.elementLogs.removeChild(this.elementLogs.children[0]);
        }

        //Scroll to bottom
        this.elementLogs.scrollTop = this.elementLogs.scrollHeight;
    }

    private clearLogs() {
        //Clear list
        this.logs = [];
    }

    private createLogElement(text: string): HTMLElement {
        const element = document.createElement('span');
        element.classList.add('log');
        element.innerText = text;
        return element;
    }

    //Search
    private async search(query: string) {
        //Create results list
        const results: Item[] = [];

        //Search all albums
        for (const album of this.albums) {
            const result = album.search(query);
            results.push(...result);
        }

        //Sort results
        results.sort((a, b) => b.lastModified - a.lastModified);

        //Prepare UI
        this.toggleSearchResults(true);

        //Add clear button
        const button = document.createElement('button');
        button.innerText = 'Clear search';
        button.onclick = (event: Event) => {
            Util.interceptEvent(event);
            this.toggleSearchResults(false);
        };
        this.elementSearchDialogResults.appendChild(button);

        //Check results
        if (!results.isEmpty()) {
            //Has results -> Add images
            for (const result of results) {
                const img = document.createElement('img');
                img.src = convertFileSrc(result.path);
                img.loading = 'lazy';
                img.decoding = 'async';
                img.classList.add('image');
                img.onload = () => {
                    img.setAttribute('loaded', '');
                }
                this.elementSearchDialogResults.appendChild(img);
            }
        } else {
            //Empty -> Add text
            const text = document.createElement('span');
            text.innerText = 'There are no results.';
            this.elementSearchDialogResults.appendChild(text);
        }
    }

    private toggleSearchResults(show: boolean) {
        //Clear & hide results
        this.elementSearchDialogForm.style.display = (show ? 'none' : '');
        this.elementSearchDialogResults.style.display = (show ? '' : 'none');
        this.elementSearchDialogResults.innerHTML = '';
        this.elementSearchDialogInput.value = '';
    }

    //Metadata management
    private async cleanMetadata() {
        //Start working
        this.setWorking(true);

        //Clean metadata
        for (const album of this.albums) {
            album.cleanMetadata();
            await album.saveMetadata();
        }
        this.log(`Finished cleaning metadata.`);

        //Finish working
        this.setWorking(false);
    }

    private async generateMetadata() {
        //No metadata needs being generated
        if (this.itemsWithoutMetadataCount <= 0) {
            this.log(`There is no metadata to generate.`);
            return;
        }

        //Models info
        let isDescriptionModelLoaded = false;
        let isEmbeddingsModelLoaded = false;

        //Progress checks
        const progressTotal: number = this.itemsWithoutMetadataCount;
        let itemsProcessedTotalCount: number = 0;
        let itemsFixedTotalCount: number = 0;

        //Get settings
        const ignoreCaptions = this.app.settings.metadataIgnoredTypes.captions;
        const ignoreLabels = this.app.settings.metadataIgnoredTypes.labels;
        const ignoreText = this.app.settings.metadataIgnoredTypes.text;
        const ignoreEmbeddings = this.app.settings.metadataIgnoredTypes.embeddings;

        //Fix items
        for (const [albumIndex, itemsWithoutMetadata] of this.itemsWithoutMetadata.entries()) {
            //Check if any need fixing
            if (itemsWithoutMetadata.isEmpty()) continue;

            //Get album
            const album: Album = this.albums[albumIndex];
            let itemsFixedAlbumCount: number = 0;
            let wasAlbumSaved: boolean = false;

            //Fix album items
            for (let i = itemsWithoutMetadata.length - 1; i >= 0; i--) {
                //Get item info
                const item = itemsWithoutMetadata[i];
                const progressCurrent = itemsFixedTotalCount + 1;
                const progressCurrentPercentage = Util.round(itemsProcessedTotalCount / progressTotal * 100, 2);
                itemsProcessedTotalCount++;
                this.log(`- ${item.name} (${progressCurrent}/${progressTotal}, ${progressCurrentPercentage}%)`);

                //Get metadata info
                const itemMetadata = item.getMetadata();
                let generateCaption: boolean = (!ignoreCaptions && typeof itemMetadata.caption != 'string');
                let generateLabels: boolean = (!ignoreLabels && !Array.isArray(itemMetadata.labels));
                let generateText: boolean = (!ignoreText && !Array.isArray(itemMetadata.text));
                let generateEmbeddings: boolean = (!ignoreEmbeddings && !Array.isArray(itemMetadata.embedding));

                //Load description model
                if ((generateCaption || generateLabels || generateText) && !isDescriptionModelLoaded) {
                    this.log('Loading description model...');
                    try {
                        await MachineLearning.loadDescriptionModel();
                        isDescriptionModelLoaded = true;
                    } catch (e) {
                        this.log(`Error loading description model: ${e}`);
                        return;
                    }
                }

                //Generate caption
                if (generateCaption) {
                    this.log('Generating caption...');
                    itemMetadata.caption = await MachineLearning.generateCaption(item.path);
                    generateCaption = false;
                }

                //Generate labels
                if (generateLabels) {
                    this.log('Generating labels...');
                    itemMetadata.labels = await MachineLearning.generateLabels(item.path);
                    generateLabels = false;
                }

                //Generate text
                if (generateText) {
                    this.log('Detecting text...');
                    itemMetadata.text = await MachineLearning.generateText(item.path);
                    generateText = false;
                }

                //Load embeddings model
                if (generateEmbeddings && !isEmbeddingsModelLoaded) {
                    this.log('Loading embeddings model...');
                    try {
                        await MachineLearning.loadEmbeddingsModel();
                        isEmbeddingsModelLoaded = true;
                    } catch (e) {
                        this.log(`Error loading embeddings model: ${e}`);
                        return;
                    }
                }

                //Generate embedding
                if (generateEmbeddings) {
                    //Prepare generation
                    const caption = itemMetadata.caption ?? "";
                    const labels = (itemMetadata.labels ?? []).join(" ").trim();
                    const text = (itemMetadata.text ?? []).join(" ").trim();
                    const combinedText = `${caption} ${labels} ${text}`.trim();
            
                    //Check if valid
                    if (combinedText.length > 0) {
                        //Valid -> Generate embedding
                        this.log('Generating embedding...');
                        const embedding = await MachineLearning.generateEmbedding(combinedText);
                        if (embedding.length > 0) {
                            itemMetadata.embedding = embedding;
                            generateEmbeddings = false;
                        }
                    } else {
                        //Invalid -> Show error
                        this.log('Embedding generation requires generating a caption, labels or text first.');
                    }
                }

                //Update metadata
                album.setItemMetadata(item.name, itemMetadata);

                //Check if fixed
                if (generateCaption || generateLabels || generateText || generateEmbeddings) continue;

                //Mark as fixed
                itemsWithoutMetadata.removeAt(i);
                this.itemsWithoutMetadataCount--;
                this.itemsWithMetadataCount++;
                this.notifyItemsWithMetadataChanged();
                itemsFixedTotalCount++;
                itemsFixedAlbumCount++;

                //Check if should save
                if (itemsFixedAlbumCount % 5 == 0) {
                    //Save
                    await album.saveMetadata(!wasAlbumSaved);
                    wasAlbumSaved = true;
                }
            }

            //Sort album metadata keys & save
            album.cleanMetadata();
            await album.saveMetadata(!wasAlbumSaved);
        }
        this.log(`Finished generating metadata (fixed ${itemsFixedTotalCount}/${progressTotal} items).`);

        //Unload models
        await MachineLearning.shutdownServer();
    }

}
