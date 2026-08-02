import { type App } from '../../app';
import { type AppBridge } from '../../app/components/bridge';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class SyncScreen extends BaseScreen {

    //Elements
    elementStartServer!: HTMLElement
    elementSyncAlbums!: HTMLElement
    elementSyncMetadata!: HTMLElement

    //Components
    get bridge(): AppBridge { return this.app.bridge; }

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string { return html; }

    //State
    protected onRendered(): void {
        //Get elements
        this.elementStartServer = document.getElementById('sync-start-server')!;
        this.elementSyncAlbums = document.getElementById('sync-albums')!;
        this.elementSyncMetadata = document.getElementById('sync-metadata')!;

        //Assign back event
        document.getElementById('sync-back')!.onclick = () => {
            //Return home
            this.app.open(this.app.homeScreen);
        }

        //Server
        this.elementStartServer.onclick = () => {}

        //Albums
        this.elementSyncAlbums.onclick = () => {
            //Ignore if syncing
            if (this.bridge.isSyncing) return;

            //Sync albums
            this.bridge.downloadAlbums();
        }

        //Metadata
        this.elementSyncMetadata.onclick = () => {
            //Ignore if syncing
            if (this.bridge.isSyncing) return;
        }
    }

    protected onOpen(): void {}

    protected onClosed(): boolean {
        //Block closing if syncing
        if (this.bridge.isSyncing) return false;

        //Reset app state
        this.app.resetState();
        return true;
    }

}