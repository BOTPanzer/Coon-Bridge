import { invoke } from '@tauri-apps/api/core';
import { Util } from '.';



 /*$       /$$ /$$
| $$      |__/| $$
| $$       /$$| $$$$$$$   /$$$$$$  /$$$$$$   /$$$$$$  /$$   /$$
| $$      | $$| $$__  $$ /$$__  $$|____  $$ /$$__  $$| $$  | $$
| $$      | $$| $$  \ $$| $$  \__/ /$$$$$$$| $$  \__/| $$  | $$
| $$      | $$| $$  | $$| $$      /$$__  $$| $$      | $$  | $$
| $$$$$$$$| $$| $$$$$$$/| $$     |  $$$$$$$| $$      |  $$$$$$$
|________/|__/|_______/ |__/      \_______/|__/       \____  $$
                                                      /$$  | $$
                                                     |  $$$$$$/
                                                      \_____*/

//Links
export interface Link {
    albumFolder: string;
    metadataFile: string;
}

//Metadata
export type MetadataItem = {
    caption?: string;
    labels?: string[];
    text?: string[];
}

export type Metadata = Record<string, MetadataItem>

//Albums
export class Item {

    //Info
    private _name: string
    private _lastModified: number
    private _album!: Album

    get name(): string { return this._name; }
    get lastModified(): number { return this._lastModified; }
    get album(): Album { return this._album; }

    //Item
    constructor(name: string, lastModified: number) {
        //Save info
        this._name = name;
        this._lastModified = lastModified;
    }

    assignAlbum(album: Album) {
        this._album = album;
    }

    //Helpers
    getPath(): string {
        return `${this.album.albumFolder}\\${this.name}`;
    }

    getMetadata(): MetadataItem {
        return this.album.getItemMetadata(this.name);
    }

}

export class Album {

    //Info
    private _albumFolder: string
    private _metadataFile: string

    get albumFolder(): string { return this._albumFolder; }
    get metadataFile(): string { return this._metadataFile; }

    private _items: Item[] = [];
    private metadata: Metadata = {};

    get items(): readonly Item[] { return this._items; }

    //Factory
    constructor(link: Link, items: Item[], metadata: Metadata) {
        //Save info
        this._albumFolder = link.albumFolder;
        this._metadataFile = link.metadataFile;
        this._items = items;
        this.metadata = metadata;

        //Assign album to items
        for (const item of items) {
            item.assignAlbum(this);
        }
    }

    static async create(link: Link): Promise<Album> {
        //Temp
        let items: Item[] = [];
        let metadata: Metadata = {};

        //Check if album is valid
        if (await Util.existsFile(link.albumFolder)) {
            //Valid -> Get all allowed files in the album folder
            const itemsData = await invoke<{ name: string; lastModified: number }[]>('list_folder_items', { folderPath: link.albumFolder, allowVideos: false });
            items = itemsData.map(data => new Item(data.name, data.lastModified));
        }

        //Check if metadata is valid
        if (await Util.existsFile(link.metadataFile)) {
            //Valid -> Load metadata file info
            metadata = await Util.readJSON(link.metadataFile) as Metadata;
        }

        //Create album
        return new Album(link, items, metadata);
    }

    //Actions
    search(query: string): Item[] {
        //Create results list
        const results: Item[] = [];

        //Check all items
        for (const item of this.items) {
            //Get item metadata
            const itemMetadata = this.getItemMetadata(item.name);

            //Check caption
            if (itemMetadata.caption && itemMetadata.caption.toLowerCase().includes(query)) {
                results.add(item)
                continue;
            }

            //Check labels
            if (itemMetadata.labels) {
                let added = false;
                for (const label of itemMetadata.labels) {
                    if (label.toLowerCase().includes(query)) {
                        results.add(item)
                        added = true;
                        break;
                    }
                }
                if (added) continue;
            }

            //Check labels
            if (itemMetadata.text) {
                let added = false;
                for (const text of itemMetadata.text) {
                    if (text.toLowerCase().includes(query)) {
                        results.add(item)
                        added = true;
                        break;
                    }
                }
                if (added) continue;
            }
        }

        //Return results
        return results;
    }

    sortItems() {
        //Sort items
        this._items.sort((a, b) => b.lastModified - a.lastModified);
    }

    //Metadata management
    async saveMetadata(backup: boolean = true) {
        //Check if should backup
        if (backup && await Util.existsFile(this.metadataFile)) {
            //Create new backup path
            let metadataBackupPath = '';
            let metadataBackupIndex = 0;
            while (true) {
                metadataBackupPath = `${this.metadataFile}.backup${metadataBackupIndex}`;
                if (!await Util.existsFile(metadataBackupPath)) break;
                metadataBackupIndex++;
            }

            //Backup current metadata file
            await Util.renameFile(this.metadataFile, metadataBackupPath);
        }

        //Save file
        Util.saveJSON(this.metadataFile, this.metadata, false);
    }

    cleanMetadata() {
        //Create new metadata
        const newMetadata: Metadata = {};

        //Sort items
        this.sortItems();

        //Check each item to see if it has metadata
        for (const item of this.items) {
            //Check if item has metadata
            if (this.itemHasMetadata(item.name)) {
                //Has metadata -> Add key to new metadata
                newMetadata[item.name] = this.getItemMetadata(item.name);
            }
        }

        //Replace old metadata with the new one
        this.metadata = newMetadata;
    }

    itemHasMetadata(itemName: string): boolean {
        //Check if item has metadata
        return this.metadata[itemName] != undefined;
    }

    getItemMetadata(itemName: string): MetadataItem {
        //Check if item has metadata
        if (this.itemHasMetadata(itemName)) {
            return this.metadata[itemName];
        } else {
            return {}
        }
    }

    setItemMetadata(itemName: string, itemMetadata: MetadataItem) {
        //Update item metadata
        this.metadata[itemName] = itemMetadata
    }

}
