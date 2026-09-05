import { ask, open, save } from '@tauri-apps/plugin-dialog';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { invoke } from '@tauri-apps/api/core';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import { Files, Link } from '../../util';
import html from './index.html?raw';

export class SettingsScreen extends BaseScreen {

    //Elements
    elementStartWithOS!: HTMLInputElement
    elementMetadataIgnoreCaptions!: HTMLInputElement
    elementMetadataIgnoreLabels!: HTMLInputElement
    elementMetadataIgnoreText!: HTMLInputElement
    elementMetadataIgnoreEmbeddings!: HTMLInputElement
    elementSyncIgnoreDeletedItemsSwitch!: HTMLInputElement
    elementMetadataPort!: HTMLElement
    elementLinksEmpty!: HTMLElement
    elementLinksList!: HTMLElement
    elementLinksAdd!: HTMLElement

    //Screen
    constructor(app: App) {
        super(app)
    }

    //Rendering
    render(): string{ return html; }

    //State
    protected onRendered(): void {
        //Get elements
        this.elementStartWithOS = document.getElementById('settings-appStartWithOS') as HTMLInputElement;
        this.elementMetadataIgnoreCaptions = document.getElementById('settings-metadataIgnoreCaptions') as HTMLInputElement;
        this.elementMetadataIgnoreLabels = document.getElementById('settings-metadataIgnoreLabels') as HTMLInputElement;
        this.elementMetadataIgnoreText = document.getElementById('settings-metadataIgnoreText') as HTMLInputElement;
        this.elementMetadataIgnoreEmbeddings = document.getElementById('settings-metadataIgnoreEmbeddings') as HTMLInputElement;
        this.elementSyncIgnoreDeletedItemsSwitch = document.getElementById('settings-syncIgnoreDeletedItems') as HTMLInputElement;
        this.elementMetadataPort = document.getElementById('settings-metadataPort')!
        this.elementLinksEmpty = document.getElementById('settings-links-empty')!;
        this.elementLinksList = document.getElementById('settings-links-list')!;
        this.elementLinksAdd = document.getElementById('settings-links-add')!;

        //Get app
        const app = this.app;

        //Assign back event
        document.getElementById('settings-back')!.onclick = () => {
            //Return home
            app.open(app.homeScreen);
        }

        //App
        this.checkAutostart().then((autostart) => {
            this.elementStartWithOS.disabled = false;
            this.elementStartWithOS.checked = autostart;
        })

        this.elementStartWithOS.oninput = async () => {
            await this.toggleAutostart(this.elementStartWithOS.checked);
        }

        //Metadata screen
        this.elementMetadataIgnoreCaptions.checked = this.app.settings.metadataIgnoredTypes.captions;
        this.elementMetadataIgnoreLabels.checked = this.app.settings.metadataIgnoredTypes.labels;
        this.elementMetadataIgnoreText.checked = this.app.settings.metadataIgnoredTypes.text;
        this.elementMetadataIgnoreEmbeddings.checked = this.app.settings.metadataIgnoredTypes.embeddings;

        this.elementMetadataIgnoreCaptions.oninput = async () => {
            this.app.settings.metadataIgnoredTypes.captions = this.elementMetadataIgnoreCaptions.checked;
            await this.app.saveSettings();
        }

        this.elementMetadataIgnoreLabels.oninput = async () => {
            this.app.settings.metadataIgnoredTypes.labels = this.elementMetadataIgnoreLabels.checked;
            await this.app.saveSettings();
        }

        this.elementMetadataIgnoreText.oninput = async () => {
            this.app.settings.metadataIgnoredTypes.text = this.elementMetadataIgnoreText.checked;
            await this.app.saveSettings();
        }

        this.elementMetadataIgnoreEmbeddings.oninput = async () => {
            this.app.settings.metadataIgnoredTypes.embeddings = this.elementMetadataIgnoreEmbeddings.checked;
            await this.app.saveSettings();
        }

        //Sync screen
        this.elementSyncIgnoreDeletedItemsSwitch.checked = app.settings.syncIgnoreDeletedItems;
        this.elementSyncIgnoreDeletedItemsSwitch.oninput = async () => {
            app.settings.syncIgnoreDeletedItems = this.elementSyncIgnoreDeletedItemsSwitch.checked;
            await app.saveSettings();
        }

        //Port metadata
        this.elementMetadataPort.onclick = async () => {
            await this.portMetadataFile();
        }

        //Init links
        this.initLinksList();
    }

    protected onOpened(): void {}

    protected onClosed(): boolean {
        //Reset app state
        this.app.resetState();
        return true;
    }

    //Autostart
    private async checkAutostart(): Promise<boolean> {
        return await isEnabled();
    }

    private async toggleAutostart(enableBoot: boolean) {
        if (enableBoot) {
            await enable();
        } else {
            await disable();
        }
    }

    //Links
    private async portMetadataFile(): Promise<void> {
        //Select metadata file
        const metadataFile = await open({
            multiple: false,
            filters: [{
                name: 'JSON metadata file',
                extensions: ['json']
            }]
        });
        if (!metadataFile || Array.isArray(metadataFile)) return;

        //Read metadata file
        const metadata = await Files.readJSON(metadataFile);

        //Check if metadata is empty
        if (Object.keys(metadata).length <= 0) {
            this.app.notifications.create('Port metadata', 'The JSON metadata file is empty.');
            return;
        }

        //Select db file
        const dbFile = await save({
            filters: [{
                name: 'Destination for the SQLite database',
                extensions: ['db']
            }]
        });
        if (!dbFile) return;

        //Delete file if it exists
        if (await Files.exists(dbFile)) {
            await Files.remove(dbFile);
        }

        //Save to db
        try {
            await invoke('save_metadata_db', {
                dbPath: dbFile,
                updated: metadata,
                deleted: []
            });
            this.app.notifications.create('Port metadata', 'Database created successfully.');
        } catch (e) {
            this.app.notifications.create('Port metadata', `Error saving to db: ${e}.`, { duration: 10000 });
            console.log(e);
        }
    }

    private getLinkName(link: Link, index: number): string {
        //Check if album exists
        const album = link.albumFolder;
        const name = Files.getName(album);

        //Create name
        return (name ? `Link #${index}: ${name}` : `Link #${index}`)
    }

    private initLinksList(): void {
        //Empty elements list
        this.elementLinksList.innerHTML = '';

        //Create elements
        for (const [index, link] of this.app.settings.links.entries()) {
            //Create link element
            const element = this.createLinkItem(index, link);
            this.elementLinksList.appendChild(element);
        }

        //Assign "add link" event
        this.elementLinksAdd.onclick = async () => {
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
            this.elementLinksList.appendChild(element);

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
            <span id="link-name">${this.getLinkName(link, index)}</span>
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
                `Are you sure you want to delete link #${app.settings.links.indexOf(link)}?`, 
                {
                    title: 'Coon Bridge',
                    kind: 'warning',
                    okLabel: 'Delete',
                    cancelLabel: 'Cancel'
                }
            )
            if (!confirm) return;

            //Remove link & element
            const index = app.settings.links.remove(link);
            if (index <= -1) return
            await app.saveSettings();
            this.elementLinksList.removeChild(element);

            //Update link names
            const linkElements = this.elementLinksList.querySelectorAll('.link');
            for (const [index, element] of linkElements.entries()) {
                const link = app.settings.links[index];
                element.querySelector('#link-name')!.innerHTML = this.getLinkName(link, index)
            }

            //Nofify list changed
            this.notifyLinksListChanged();
        }

        albumSelect.onclick = async () => {
            //Select album folder
            const albumFolder = await open({
                directory: true,
                multiple: false,
                filters: [{
                    name: 'Album folder',
                    extensions: []
                }]
            });

            //User cancelled dialog
            if (!albumFolder || Array.isArray(albumFolder)) return;

            //Update input
            albumInput.value = albumFolder;
            albumInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        albumInput.oninput = async () => {
            //Update album folder
            link.albumFolder = albumInput.value;
            await app.saveSettings();

            //Update album name
            const index = app.settings.links.indexOf(link);
            const linkElements = this.elementLinksList.querySelectorAll('.link');
            linkElements[index].querySelector('#link-name')!.innerHTML = this.getLinkName(link, index)
        }

        metadataSelect.onclick = async () => {
            //Select metadata file
            const metadataFile = await open({
                multiple: false,
                filters: [{
                    name: 'Metadata file',
                    extensions: ['db']
                }]
            });

            //User cancelled dialog
            if (!metadataFile || Array.isArray(metadataFile)) return;

            //Update input
            metadataInput.value = metadataFile;
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

    private notifyLinksListChanged(): void {
        if (this.app.settings.links.length <= 0) {
            //No links
            this.elementLinksEmpty.style.display = '';
            this.elementLinksList.style.display = 'none';
        } else {
            //Has links
            this.elementLinksEmpty.style.display = 'none';
            this.elementLinksList.style.display = '';
        }
    }

}