import { AppState, type App } from '../../app';
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
        document.getElementById('home-settings')!.onclick = () => {
            //Start managing settings
            const success = this.app.setState(AppState.ManagingSettings);
            if (success) {
                //Open settings screen
                this.app.open(this.app.settingsScreen);
            } else {
                //Notify user
                console.log("Can't modify settings right now!");
            }
        }

        document.getElementById('home-metadata')!.onclick = () => {
            //Start managing metadata
            const success = this.app.setState(AppState.ManagingMetadata);
            if (success) {
                //Open metadata screen
                this.app.open(this.app.metadataScreen);
            } else {
                //Notify user
                console.log("Can't modify settings right now!");
            }
        }

        document.getElementById('home-sync')!.onclick = () => {
            //Open sync screen
            this.app.open(this.app.syncScreen);
        }
    }

    protected onOpen(): void {}

    protected onClosed(): boolean { return true; }

}