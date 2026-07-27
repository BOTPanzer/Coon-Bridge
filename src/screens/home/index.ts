import type { App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class HomeScreen extends BaseScreen {

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string { return html; }

    //State
    protected onRendered(): void {
        //Add listeners
        document.getElementById('home-settings')!.onclick = () => { this.app.open(this.app.settingsScreen); }
        document.getElementById('home-metadata')!.onclick = () => { this.app.open(this.app.metadataScreen); }
        document.getElementById('home-sync')!.onclick = () => { this.app.open(this.app.syncScreen); }
    }

    protected onOpen(): void {}

    protected onClosed(): boolean { return true; }

}