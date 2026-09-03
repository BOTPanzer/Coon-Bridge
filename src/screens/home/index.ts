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
            //Enter settings screen state
            const success = this.app.setState(AppState.SettingsScreen);
            if (success) {
                //Open settings screen
                this.app.open(this.app.settingsScreen);
            } else {
                //Notify user
                console.log("Can't enter settings screen right now!");
            }
        }

        document.getElementById('home-metadata')!.onclick = () => {
            //Enter metadata screen state
            const success = this.app.setState(AppState.MetadataScreen);
            if (success) {
                //Open metadata screen
                this.app.open(this.app.metadataScreen);
            } else {
                //Notify user
                console.log("Can't enter metadata screen right now!");
            }
        }

        document.getElementById('home-sync')!.onclick = () => {
            //Enter sync screen state
            const success = this.app.setState(AppState.SyncScreen);
            if (success) {
                //Open sync screen
                this.app.open(this.app.syncScreen);
            } else {
                //Notify user
                console.log("Can't enter sync screen right now!");
            }
        }
    }

    protected onOpened(): void {}

    protected onClosed(): boolean { return true; }

}