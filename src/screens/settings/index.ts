import { ask, open } from '@tauri-apps/plugin-dialog';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import html from './index.html?raw';

export class SettingsScreen extends BaseScreen {

    //Elements
    syncIgnoreDeletedItemsSwitch!: HTMLInputElement
    linksEmpty!: HTMLElement
    linksList!: HTMLElement
    linksAdd!: HTMLElement

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string { return html; }

    //State
    protected onRendered(): void {

        //Get elements
        this.syncIgnoreDeletedItemsSwitch = document.getElementById('settings-syncIgnoreDeletedItems') as HTMLInputElement;
        this.linksEmpty = document.getElementById('settings-links-empty')!;
        this.linksList = document.getElementById('settings-links-list')!;
        this.linksAdd = document.getElementById('settings-links-add')!;

        //Get app
        const app = this.app;

        //Assign back event
        document.getElementById('settings-back')!.onclick = () => { app.open(app.homeScreen); }

        //Sync
        this.syncIgnoreDeletedItemsSwitch.checked = app.settings.syncIgnoreDeletedItems;
        this.syncIgnoreDeletedItemsSwitch.oninput = async () => {
            app.settings.syncIgnoreDeletedItems = this.syncIgnoreDeletedItemsSwitch.checked;
            await app.saveSettings();
        }

        //Init links
        this.initLinksList();
    }

    protected onOpen(): void {}

    protected onClosed(): boolean {
        //Reset app state
        this.app.resetState();
        return true;
    }

    //Links
    private initLinksList() {
        //Empty elements list
        this.linksList.innerHTML = '';

        //Create elements
        for (const [index, link] of this.app.settings.links.entries()) {
            //Create link element
            const element = this.createLinkItem(index, link);
            this.linksList.appendChild(element);
        }

        //Assign "add link" event
        this.linksAdd.onclick = async () => {
            //Create new link
            const link = {
                albumFolder: '',
                metadataFile: ''
            };

            //Add link to list
            const index = this.app.settings.links.add(link);
            await this.app.saveSettings();

            //Create link element
            const element = this.createLinkItem(index, link);
            this.linksList.appendChild(element);

            //Nofify list changed
            this.notifyLinksListChanged();
        }

        //Nofify list changed
        this.notifyLinksListChanged();
    }

    private createLinkItem(index: number, link: any): HTMLElement {
        //Get app
        const app = this.app;

        //Create link element
        const element = document.createElement('div');
        element.classList.add('link');
        element.innerHTML = `
            <span id="link-name">Link ${index}</span>
            <div>
                <button id="link-remove" icon>🗑️</button>
                <div>
                    <div>
                        <button id="link-album-select" icon>📂</button>
                        <input id="link-album-input" type="text" autocomplete="off" placeholder="Album folder path" value="${link.albumFolder}">
                    </div>
                    <div>
                        <button id="link-metadata-select" icon>📂</button>
                        <input id="link-metadata-input" type="text" autocomplete="off" placeholder="Metadata file path" value="${link.metadataFile}">
                    </div>
                </div>
            </div>
        `;

        //Get elements
        const remove = element.querySelector(`#link-remove`) as HTMLElement;
        const albumSelect = element.querySelector(`#link-album-select`) as HTMLInputElement;
        const albumInput = element.querySelector(`#link-album-input`) as HTMLInputElement;
        const metadataInput = element.querySelector(`#link-metadata-input`) as HTMLInputElement;
        const metadataSelect = element.querySelector(`#link-metadata-select`) as HTMLInputElement;

        //Add listeners
        remove.onclick = async () => {
            //Ask for confirmation
            const confirm = await ask(
                `Are you sure you want to remove link ${app.settings.links.indexOf(link)}?`, 
                {
                    title: 'Coon Bridge',
                    kind: 'warning',
                    okLabel: 'Remove',
                    cancelLabel: 'Cancel'
                }
            )
            if (!confirm) return;

            //Remove link & element
            const index = app.settings.links.remove(link);
            if (index <= -1) return
            await app.saveSettings();
            this.linksList.removeChild(element);

            //Update link names
            const linkElements = this.linksList.querySelectorAll('.link');
            for (const [index, element] of linkElements.entries()) {
                element.querySelector('#link-name')!.innerHTML = `Link ${index}`
            }

            //Nofify list changed
            this.notifyLinksListChanged();
        }

        albumSelect.onclick = async () => {
            //Select album folder
            const selected = await open({
                directory: true,
                multiple: false,
                filters: [{
                    name: 'Select an album folder',
                    extensions: ['json']
                }]
            });

            //User cancelled dialog
            if (!selected || Array.isArray(selected)) return;

            //Update input
            albumInput.value = selected;
            albumInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        albumInput.oninput = async () => {
            //Update album folder
            link.albumFolder = albumInput.value;
            await app.saveSettings();
        }

        metadataSelect.onclick = async () => {
            //Select metadata file
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Select a metadata file',
                    extensions: ['json']
                }]
            });

            //User cancelled dialog
            if (!selected || Array.isArray(selected)) return;

            //Update input
            metadataInput.value = selected;
            metadataInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        metadataInput.oninput = async () => {
            //Update metadata file
            link.metadataFile = metadataInput.value;
            await app.saveSettings();
        }

        //Return element
        return element;
    }

    private notifyLinksListChanged() {
        if (this.app.settings.links.length <= 0) {
            //No links
            this.linksEmpty.style.display = '';
            this.linksList.style.display = 'none';
        } else {
            //Has links
            this.linksEmpty.style.display = 'none';
            this.linksList.style.display = '';
        }
    }

}