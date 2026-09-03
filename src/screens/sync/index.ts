import { type App } from '../../app';
import { type AppBridge } from '../../app/components/bridge';
import { Util } from '../../util';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class SyncScreen extends BaseScreen {

    //Elements
    elementStateServer!: HTMLElement
    elementStatePhone!: HTMLElement
    elementStateCode!: HTMLElement
    elementStartServer!: HTMLElement
    elementSyncAlbums!: HTMLElement
    elementSyncMetadata!: HTMLElement
    elementSyncMetadataDialog!: HTMLDialogElement
    elementSyncMetadataSend!: HTMLButtonElement
    elementSyncMetadataReceive!: HTMLButtonElement
    elementSyncMetadataDialogSend!: HTMLButtonElement
    elementSyncMetadataDialogReceive!: HTMLButtonElement
    elementLogs!: HTMLElement

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
        this.elementStateServer = document.getElementById('sync-state-server')!;
        this.elementStatePhone = document.getElementById('sync-state-phone')!;
        this.elementStateCode = document.getElementById('sync-state-code')!;
        this.elementStartServer = document.getElementById('sync-start-server')!;
        this.elementSyncAlbums = document.getElementById('sync-albums')!;
        this.elementSyncMetadata = document.getElementById('sync-metadata')!;
        this.elementSyncMetadataDialog = document.getElementById('sync-metadata-dialog') as HTMLDialogElement;
        this.elementSyncMetadataDialogSend = document.getElementById('sync-metadata-dialog-send') as HTMLButtonElement;
        this.elementSyncMetadataDialogReceive = document.getElementById('sync-metadata-dialog-receive') as HTMLButtonElement;
        this.elementLogs = document.getElementById('metadata-logs')!;

        //Assign back event
        document.getElementById('sync-back')!.onclick = () => {
            //Return home
            this.app.open(this.app.homeScreen);
        }

        //Server
        this.elementStartServer.onclick = () => {
            //Start server
            this.bridge.start();
        }

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

    protected onOpened(): void {
        //Register events
        this.bridge.registerEvents(this.log, this.onServerStateChanged, this.onConnectionStateChanged, null);

        //Create logs
        for (const text of this.bridge.logs) {
            this.log(text);
        }

        //Update state
        this.onServerStateChanged(this.bridge.isRunning);
        this.onConnectionStateChanged(this.bridge.isConnected, '');
        this.onConnectionCodeChanged(this.bridge.connectionCode);
    }

    protected onClosed(): boolean {
        //Block closing if syncing
        if (this.bridge.isSyncing) return false;

        //Unregister events
        this.bridge.unregisterEvents(this.log, this.onServerStateChanged, this.onConnectionStateChanged, null);

        //Reset app state
        this.app.resetState();
        return true;
    }

    //Logs
    private maxLogs: number = 1000;

    private log = (text: string) => {
        //Add log
        this.elementLogs.appendChild(this.createLogElement(text));

        //Check if max length exceeded
        if (this.elementLogs.children.length > this.maxLogs) {
            //Exceeded -> Remove first
            this.elementLogs.removeChild(this.elementLogs.children[0]);
        }

        //Scroll to bottom
        this.elementLogs.scrollTop = this.elementLogs.scrollHeight;
    }

    private createLogElement(text: string): HTMLElement {
        const element = document.createElement('span');
        element.classList.add('log');
        element.innerText = text;
        return element;
    }

    //State
    private onServerStateChanged = (isRunning: boolean) => {
        if (isRunning) {
            this.elementStateServer.setAttribute('active', '');
        } else {
            this.elementStateServer.removeAttribute('active');
        }
    }

    private onConnectionStateChanged = (isConnected: boolean, _: string) => {
        if (isConnected) {
            this.elementStatePhone.setAttribute('active', '');
        } else {
            this.elementStatePhone.removeAttribute('active');
        }
    }

    private onConnectionCodeChanged = (code: string) => {
        this.elementStateCode.innerText = code;
    }

}