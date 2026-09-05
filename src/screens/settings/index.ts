import { confirm, open, save } from '@tauri-apps/plugin-dialog';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { invoke } from '@tauri-apps/api/core';
import { type App } from '../../app';
import { BaseScreen } from  '../screen';
import { Files, Link, Util } from '../../util';
import html from './index.html?raw';
import { ListAdapter } from '../../util/adapter';

type LinkHolder = {
    albumSelect: HTMLInputElement;
    albumInput: HTMLInputElement;
    metadataInput: HTMLInputElement;
    metadataSelect: HTMLInputElement;
    remove: HTMLElement;
    moveUp: HTMLElement;
    moveDown: HTMLElement;
}

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
    elementLinksMetadataDialog!: HTMLDialogElement
    elementLinksMetadataDialogSelect!: HTMLInputElement
    elementLinksMetadataDialogCreate!: HTMLInputElement

    linksAdapter!: ListAdapter<Link, LinkHolder>

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
        this.elementLinksMetadataDialog = document.getElementById('settings-links-metadataDialog') as HTMLDialogElement
        this.elementLinksMetadataDialogSelect = document.getElementById('settings-links-metadataDialog-select') as HTMLInputElement
        this.elementLinksMetadataDialogCreate = document.getElementById('settings-links-metadataDialog-create') as HTMLInputElement

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

        //Select metadata dialog
        Util.onDialogBackdropClick(this.elementLinksMetadataDialog, () => {
            //Close dialog
            this.elementLinksMetadataDialog.close();
        });

        //Init links
        this.linksAdapter = new ListAdapter<Link, LinkHolder>(this.elementLinksList, app.settings.links, this.onCreateLinkElement, this.onUpdateLinkHolder);

        this.elementLinksAdd.onclick = async () => {
            //Create new link
            const link = {
                albumFolder: '',
                metadataFile: ''
            };

            //Add link to list
            const index = app.settings.links.add(link);
            await app.saveSettings();

            //Create link element
            this.linksAdapter.notifyItemAdded(index);

            //Nofify Amount changed
            this.notifyLinksAmountChanged();
        }
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
            await invoke('save_metadata_db', { dbPath: dbFile, updated: metadata, deleted: [] });
            this.app.notifications.create('Port metadata', 'Database created successfully.');
        } catch (e) {
            this.app.notifications.create('Port metadata', `Error saving to db: ${e}.`, { duration: 10000 });
            console.log(e);
        }
    }

    private notifyLinksAmountChanged(): void {
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

    private getLinkName = (link: Link, index: number): string => {
        const name = Files.getName(link.albumFolder);
        return (name ? `Link #${index}: ${name}` : `Link #${index}`);
    }

    private onCreateLinkElement = (_: Link): HTMLElement => {
        //Create element
        const element = document.createElement('div');
        element.classList.add('link');
        element.innerHTML = `
            <span id="link-name">Link #0</span>
            <div>
                <div>
                    <div>
                        <button id="link-album-select" icon>📂</button>
                        <input id="link-album-input" type="text" autocomplete="off" placeholder="Album folder path">
                    </div>
                    <div>
                        <button id="link-metadata-select" icon>📄</button>
                        <input id="link-metadata-input" type="text" autocomplete="off" placeholder="Metadata file path">
                    </div>
                </div>
                <button id="link-remove" icon style="height: 100%;">🗑️</button>
                <div>
                    <button id="link-up" icon>↑</button>
                    <button id="link-down" icon>↓</button>
                </div>
            </div>
        `;
        return element;
    }

    private onUpdateLinkHolder = (link: Link, index: number, element: HTMLElement): LinkHolder => {
        //Get app & links
        const app = this.app;
        const links = app.settings.links;

        //Create holder
        const holder = {
            name: element.querySelector(`#link-name`) as HTMLElement,
            albumSelect: element.querySelector(`#link-album-select`) as HTMLInputElement,
            albumInput: element.querySelector(`#link-album-input`) as HTMLInputElement,
            metadataInput: element.querySelector(`#link-metadata-input`) as HTMLInputElement,
            metadataSelect: element.querySelector(`#link-metadata-select`) as HTMLInputElement,
            remove: element.querySelector(`#link-remove`) as HTMLInputElement,
            moveUp: element.querySelector(`#link-up`) as HTMLInputElement,
            moveDown: element.querySelector(`#link-down`) as HTMLInputElement
        }

        //Update info
        holder.name.innerText = this.getLinkName(link, index);
        holder.albumInput.value = link.albumFolder;
        holder.metadataInput.value = link.metadataFile;

        //Add listeners
        holder.albumSelect.onclick = async () => {
            //Select album folder
            const albumFolder = await open({
                directory: true,
                multiple: false,
                filters: [{
                    name: 'Album folder',
                    extensions: []
                }]
            });
            if (!albumFolder || Array.isArray(albumFolder)) return;

            //Update input
            holder.albumInput.value = albumFolder;
            holder.albumInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        holder.albumInput.oninput = async () => {
            //Update album folder
            link.albumFolder = holder.albumInput.value;
            await app.saveSettings();

            //Update album name
            holder.name.innerText = this.getLinkName(link, index);
        }

        holder.metadataSelect.onclick = async () => {
            //Assign option listeners
            this.elementLinksMetadataDialogSelect.onclick = async () => {
                //Close dialog
                this.elementLinksMetadataDialog.close()

                //Select path
                const metadataFile = await open({
                    multiple: false,
                    filters: [{
                        name: 'Metadata file',
                        extensions: ['db']
                    }]
                });
                if (!metadataFile || Array.isArray(metadataFile)) return;

                //Update input
                holder.metadataInput.value = metadataFile;
                holder.metadataInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            this.elementLinksMetadataDialogCreate.onclick = async () => {
                //Close dialog
                this.elementLinksMetadataDialog.close()

                //Select path
                const metadataFile = await save({
                    filters: [{
                        name: 'Metadata file',
                        extensions: ['db']
                    }]
                });
                if (!metadataFile || Array.isArray(metadataFile)) return;

                //Create database
                await invoke('create_metadata_db', { dbPath: metadataFile });

                //Update input
                holder.metadataInput.value = metadataFile;
                holder.metadataInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            //Show dialog
            this.elementLinksMetadataDialog.showModal();
        }

        holder.metadataInput.oninput = async () => {
            //Update metadata file
            link.metadataFile = holder.metadataInput.value;
            await app.saveSettings();
        }

        holder.remove.onclick = async () => {
            //Ask for confirmation
            const shouldDelete = await confirm(
                `Are you sure you want to delete link #${links.indexOf(link)}?`, 
                {
                    title: 'Coon Bridge',
                    kind: 'warning',
                    okLabel: 'Delete',
                    cancelLabel: 'Cancel'
                }
            )
            if (!shouldDelete) return;

            //Remove link & element
            links.remove(link);
            await app.saveSettings();
            this.linksAdapter.notifyItemRemoved(index);

            //Update link names
            for (let i = index; i < links.length; i++) {
                this.linksAdapter.notifyItemChanged(i);
            }

            //Nofify amount changed
            this.notifyLinksAmountChanged();
        }

        holder.moveUp.disabled = index <= 0;
        holder.moveUp.onclick = async () => {
            //Swap link positions
            const previousIndex = index - 1;
            [links[previousIndex], links[index]] = [links[index], links[previousIndex]];
            console.log(previousIndex, index);

            //Update elements
            this.linksAdapter.notifyItemChanged(previousIndex);
            this.linksAdapter.notifyItemChanged(index);
        }

        holder.moveDown.disabled = index >= this.app.settings.links.length - 1;
        holder.moveDown.onclick = async () => {
            //Swap link positions
            const nextIndex = index + 1;
            [links[index], links[nextIndex]] = [links[nextIndex], links[index]];
            console.log(index, nextIndex);

            //Update elements
            this.linksAdapter.notifyItemChanged(index);
            this.linksAdapter.notifyItemChanged(nextIndex);
        }

        //Return holder
        return holder;
    }

}