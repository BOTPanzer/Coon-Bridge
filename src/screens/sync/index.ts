import { type App } from '../../app';
import { type AppBridge } from '../../app/components/bridge';
import { Util } from '../../util';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class SyncScreen extends BaseScreen {

    //Elements
    elementStartServer!: HTMLElement
    elementSyncAlbums!: HTMLElement
    elementSyncMetadata!: HTMLElement
    elementSyncMetadataDialog!: HTMLDialogElement
    elementSyncMetadataSend!: HTMLButtonElement
    elementSyncMetadataReceive!: HTMLButtonElement
    elementSyncMetadataDialogSend!: HTMLButtonElement
    elementSyncMetadataDialogReceive!: HTMLButtonElement

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
        this.elementSyncMetadataDialog = document.getElementById('sync-metadata-dialog') as HTMLDialogElement;
        this.elementSyncMetadataDialogSend = document.getElementById('sync-metadata-dialog-send') as HTMLButtonElement;
        this.elementSyncMetadataDialogReceive = document.getElementById('sync-metadata-dialog-receive') as HTMLButtonElement;

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

            //Show options dialog
            this.elementSyncMetadataDialog.showModal();
        }
        
        Util.onDialogBackdropClick(this.elementSyncMetadataDialog, () => {
            //Close dialog
            this.elementSyncMetadataDialog.close();
        });

        this.elementSyncMetadataDialogSend.onclick = () => {
            //Ignore if syncing
            if (this.bridge.isSyncing) return;

            //Sync metadata & close dialog
            this.bridge.uploadMetadata();
            this.elementSyncMetadataDialog.close();
        }

        this.elementSyncMetadataDialogReceive.onclick = () => {
            //Ignore if syncing
            if (this.bridge.isSyncing) return;

            //Sync metadata & close dialog
            this.bridge.downloadMetadata();
            this.elementSyncMetadataDialog.close();
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