import type { App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class SettingsScreen extends BaseScreen {

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string {
        return html;
    }

    //State
    protected onRendered(): void {
        //Add listeners
        document.getElementById('settings-back')!.onclick = () => { this.app.open(this.app.homeScreen); }

        const syncIgnoreDeletedItems = document.getElementById('settings-syncIgnoreDeletedItems') as HTMLInputElement;
        syncIgnoreDeletedItems.checked = this.app.settings.syncIgnoreDeletedItems;
        syncIgnoreDeletedItems.oninput = async () => {
            this.app.settings.syncIgnoreDeletedItems = syncIgnoreDeletedItems.checked;
            await this.app.saveSettings();
        }
    }

    protected onOpen(): void {}

    protected onClosed(): boolean {
        return true;
    }

}