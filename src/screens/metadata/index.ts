import type { App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

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
        document.getElementById('metadata-back')!.onclick = () => { this.app.open(this.app.homeScreen); }
    }

    protected onOpen(): void {}

    protected onClosed(): boolean { return true; }

}