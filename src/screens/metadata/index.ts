import { exists } from '@tauri-apps/plugin-fs';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';
import { Album } from '../../util';

export class MetadataScreen extends BaseScreen {

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string { return html; }

    //State
    protected onRendered(): void {
        //Add listeners
        document.getElementById('metadata-back')!.onclick = () => {
            //Check if loading
            if (this.isLoading) return;

            //Return home
            this.app.open(this.app.homeScreen);
        }
    }

    protected onOpen(): void {
        //Start loading
        this.isLoading = true;

        //Load albums
        this.loadAlbums().then(() => {
            //Finish loading
            this.isLoading = false;

            //Test
            console.log(this.albums);
        });
    }

    protected onClosed(): boolean {
        //Reset app state
        this.app.resetState();
        return true;
    }

    //Links
    private isLoading: boolean = false;
    private albums: Album[] = [];

    async loadAlbums() {
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
    }

    clearAlbums() {
        //Clear lists
        this.albums = [];
    }

}
