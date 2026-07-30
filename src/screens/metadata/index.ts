import { convertFileSrc } from '@tauri-apps/api/core';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';
import { Album, DescriptionModel, Item, Util } from '../../util';
import { load_image } from '@huggingface/transformers';

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
    elementSearchResults!: HTMLElement
    elementClean!: HTMLButtonElement
    elementFix!: HTMLButtonElement

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
        this.elementSearchDialogInput = document.getElementById('metadata-search-dialog-input') as HTMLInputElement;
        this.elementSearchDialogSearch = document.getElementById('metadata-search-dialog-search') as HTMLButtonElement;
        this.elementSearchResults = document.getElementById('metadata-search-results')!;
        this.elementClean = document.getElementById('metadata-clean') as HTMLButtonElement;
        this.elementFix = document.getElementById('metadata-fix') as HTMLButtonElement;

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
            this.elementSearchDialogInput.value = '';
            this.elementSearchDialog.showModal();
        }

        Util.onDialogBackdropClick(this.elementSearchDialog, () => {
            //Close dialog
            this.elementSearchDialog.close();
        });

        this.elementSearchDialogSearch.onclick = () => {
            //Get query
            const query = this.elementSearchDialogInput.value;
            if (query.length < 3) return;

            //Search
            this.search(query);

            //Close dialog
            this.elementSearchDialog.close();
        }

        //Assign clean metadata event
        this.elementClean!.onclick = () => {
            //Working
            if (this.isWorking) return;

            //Start working
            this.setWorking(true);

            //Clean metadata
            this.cleanMetadata().then(() => {
                //Finish working
                this.setWorking(false);
            });
        }

        //Assign fix metadata event
        this.elementFix!.onclick = () => {
            //Working
            if (this.isWorking) return;

            //Start working
            this.setWorking(true);

            //Fix metadata
            this.fixMetadata().then(() => {
                //Finish working
                this.setWorking(false);
            });
        }
    }

    protected onOpen(): void {
        //Start loading
        this.setWorking(true);
        this.elementContent.setAttribute('hidden', '');

        //Load albums
        this.loadAlbums().then(() => {
            //Finish loading
            this.setWorking(false);
            this.elementLoading.remove();
            this.elementContent.removeAttribute('hidden');
        });
    }

    protected onClosed(): boolean {
        //Clear albums
        this.clearAlbums();

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
        this.elementFix.disabled = working;
    }

    //Albums
    private albums: Album[] = [];

    private async loadAlbums() {
        //Get links
        const links = this.app.settings.links;

        //Check if links are valid
        for (const link of links) {
            //Check if album folder or metadata file do not exist
            if (!(await Util.existsFile(link.albumFolder)) || !(await Util.existsFile(link.metadataFile))) {
                console.log('Please make sure all links have a valid album folder and metadata file!');
                return;
            }
        }

        //Load links info
        for (const link of links) {
            //Create & save album
            const album = await Album.create(link);
            this.albums.add(album);
        }

        //Count items
        this.countItemsWithMetadata();
    }

    private clearAlbums() {
        //Clear lists
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

        //Check albums
        for (const album of this.albums) {
            //Create list of items without metadata in this album
            const albumItemsWithoutMetadata: Item[] = [];
            this.itemsWithoutMetadata.add(albumItemsWithoutMetadata);

            //Look for its items without metadata
            for (const item of album.items) {
                const itemMetadata = album.getItemMetadata(item.name);
                if (!itemMetadata || !itemMetadata.caption || !itemMetadata.labels || !itemMetadata.text) {
                    albumItemsWithoutMetadata.add(item);
                    this.itemsWithoutMetadataCount++;
                } else {
                    this.itemsWithMetadataCount++;
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

    //Search
    private search(query: string) {
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
        this.clearSearch();
        this.elementSearchResults.style.display = '';

        //Add title & clear button
        const title = document.createElement('h2');
        title.innerText = 'Search results';
        this.elementSearchResults.appendChild(title);

        const button = document.createElement('button');
        button.innerText = 'Clear search';
        button.onclick = () => this.clearSearch();
        this.elementSearchResults.appendChild(button);

        //Check results
        if (!results.isEmpty()) {
            //Has results -> Add images
            for (const result of results) {
                const img = document.createElement('img');
                img.src = convertFileSrc(result.getPath());
                img.loading = 'lazy';
                img.decoding = 'async';
                img.classList.add('image');
                img.onload = () => {
                    img.setAttribute('loaded', '');
                }
                this.elementSearchResults.appendChild(img);
            }
        } else {
            //Empty -> Add text
            const text = document.createElement('span');
            text.innerText = 'There are no results.';
            this.elementSearchResults.appendChild(text);
        }
    }

    private clearSearch() {
        //Clear & hide results
        this.elementSearchResults.innerHTML = '';
        this.elementSearchResults.style.display = 'none';
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

        //Finish working
        this.setWorking(false);
    }

    private async fixMetadata() {
        //Create models
        const descriptionModel: DescriptionModel = new DescriptionModel()

        //Fix items
        for (const [albumIndex, itemsWithoutMetadata] of this.itemsWithoutMetadata.entries()) {
            //Check if any need fixing
            if (itemsWithoutMetadata.isEmpty()) continue;

            //Get album
            const album: Album = this.albums[albumIndex];
            let albumWasSaved: boolean = false;
            let itemsFixedCount: number = 0;

            //Fix album items
            for (let i = itemsWithoutMetadata.length - 1; i >= 0; i--) {
                //Get item info
                const item = itemsWithoutMetadata[i];
                console.log(`- ${item.name}`);

                //Get metadata info
                const itemMetadata = item.getMetadata();
                let hasCaption: boolean = typeof itemMetadata.caption == 'string';
                let hasLabels: boolean = Array.isArray(itemMetadata.labels);
                let hasText: boolean = Array.isArray(itemMetadata.text);

                //Load image
                const image = await load_image(convertFileSrc(item.getPath()));

                //Fix caption
                if (!itemMetadata.caption) {
                    console.log(`Generating caption...`);
                    itemMetadata.caption = await descriptionModel.generateCaption(image);
                    hasCaption = true;
                }

                //Fix labels
                if (!itemMetadata.labels) {
                    console.log(`Generating labels...`);
                    itemMetadata.labels = await descriptionModel.generateLabels(image);
                    hasLabels = true;
                }

                //Fix text
                if (!itemMetadata.text) {
                    console.log(`Detecting text...`);
                    itemMetadata.text = await descriptionModel.generateText(image);
                    hasText = true;
                }

                //Update metadata
                album.setItemMetadata(item.name, itemMetadata);

                //Check if fixed
                if (!hasCaption || !hasLabels || !hasText) continue;

                //Mark as fixed
                itemsWithoutMetadata.removeAt(i);
                this.itemsWithoutMetadataCount--;
                this.itemsWithMetadataCount++;
                this.notifyItemsWithMetadataChanged();
                itemsFixedCount++;

                //Check if should save
                if (itemsFixedCount % 5 == 0) {
                    //Save
                    await album.saveMetadata(!albumWasSaved);
                    albumWasSaved = true;
                }
            }

            //Sort album metadata keys & save
            album.cleanMetadata();
            await album.saveMetadata(!albumWasSaved);
        }

        //Unload models
        await descriptionModel.unload();
    }

}
