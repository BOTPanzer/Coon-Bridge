import { exists } from '@tauri-apps/plugin-fs';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';
import { Album } from '../../util';

export class MetadataScreen extends BaseScreen {

    //Elements
    elementLoading!: HTMLElement
    elementContent!: HTMLElement
    elementStats!: HTMLElement

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

        //Add listeners
        document.getElementById('metadata-back')!.onclick = () => {
            //Check if loading
            if (this.isWorking) return;

            //Return home
            this.app.open(this.app.homeScreen);
        }

        document.getElementById('metadata-search')!.onclick = () => {}

        document.getElementById('metadata-clean')!.onclick = () => {}

        document.getElementById('metadata-generate')!.onclick = () => {}
    }

    protected onOpen(): void {
        //Start loading
        this.isWorking = true;
        this.elementContent.setAttribute('hidden', '');

        //Load albums
        this.loadAlbums().then(() => {
            //Finish loading
            this.isWorking = false;
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

    //Albums
    private isWorking: boolean = false;
    private albums: Album[] = [];

    private itemsWithoutMetadata: string[][] = [];
    private itemsWithoutMetadataCount: number = 0;
    private itemsWithMetadataCount: number = 0;

    private async loadAlbums() {
        //Get links
        const links = this.app.settings.links;

        //Check if links are valid
        for (const link of links) {
            //Check if album folder or metadata file do not exist
            if (!(await exists(link.albumFolder)) || !(await exists(link.metadataFile))) {
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
        await this.countItemsWithMetadata();
    }

    private clearAlbums() {
        //Clear lists
        this.albums = [];
    }

    private async countItemsWithMetadata() {
        //Items without metadata
        this.itemsWithoutMetadata = [];
        this.itemsWithoutMetadataCount = 0;
        this.itemsWithMetadataCount = 0;

        //Look for items without metadata
        for (const album of this.albums) {
            //Create list of items without metadata in this album
            const albumItemsWithoutMetadata: string[] = [];
            this.itemsWithoutMetadata.add(albumItemsWithoutMetadata);

            //Look for items without metadata in this album
            for (const item of album.items) {
                const itemMetadata = album.metadata[item];
                if (!itemMetadata || !itemMetadata.caption || !itemMetadata.labels || !itemMetadata.text) {
                    albumItemsWithoutMetadata.add(item);
                    this.itemsWithoutMetadataCount++;
                } else {
                    this.itemsWithMetadataCount++;
                }
            }
        }

        //Show results
        this.elementStats.innerHTML = `<li>Items with metadata: ${this.itemsWithMetadataCount}</li><li>Items without metadata: ${this.itemsWithoutMetadataCount}</li>`;
    }

}
