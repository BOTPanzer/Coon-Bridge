import { invoke } from '@tauri-apps/api/core';
import { Files } from '.';



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
    private _path: string
    private _lastModified: number
    private _isVideo: boolean
    private _album!: Album

    get name(): string { return this._name; }
    get path(): string { return this._path; }
    get lastModified(): number { return this._lastModified; }
    get isVideo(): boolean { return this._isVideo; }
    get album(): Album { return this._album; }

    //Item
    constructor(name: string, path: string, lastModified: number, isVideo: boolean) {
        //Save info
        this._name = name;
        this._path = path;
        this._lastModified = lastModified;
        this._isVideo = isVideo;
    }

    assignAlbum(album: Album) {
        this._album = album;
    }

    //Helpers
    getMetadata(): MetadataItem {
        return this.album.getItemMetadata(this.name);
    }

}

export class Album {

    //Info
    private _albumPath: string
    private _metadataPath: string

    get albumPath(): string { return this._albumPath; }
    get metadataPath(): string { return this._metadataPath; }

    private _items: Item[] = [];
    private metadata: Metadata = {};

    get items(): readonly Item[] { return this._items; }

    //Factory
    constructor(link: Link, items: Item[], metadata: Metadata) {
        //Save info
        this._albumPath = link.albumFolder;
        this._metadataPath = link.metadataFile;
        this._items = items;
        this.metadata = metadata;

        //Assign album to items
        for (const item of items) {
            item.assignAlbum(this);
        }
    }

    static async create(link: Link, ignoreVideos: Boolean): Promise<Album> {
        //Temp
        let items: Item[] = [];
        let metadata: Metadata = {};

        //Check if album is valid
        if (await Files.exists(link.albumFolder)) {
            //Valid -> Get all allowed files in the album folder
            const itemsData = await invoke<{ name: string; path: string; lastModified: number, isVideo: boolean }[]>('list_folder_items', {
                folderPath: link.albumFolder,
                ignoreVideos: ignoreVideos
            });
            items = itemsData
                .map(data => new Item(data.name, data.path, data.lastModified, data.isVideo));
        }

        //Check if metadata is valid
        if (await Files.exists(link.metadataFile)) {
            //Valid -> Load metadata file info
            metadata = await Files.readJSON(link.metadataFile) as Metadata;
        }

        //Create album
        return new Album(link, items, metadata);
    }

    static async loadAlbums(links: Link[], albums: Album[], validateMetadata: Boolean, ignoreVideos: Boolean): Promise<boolean> {
        //Clear albums list
        albums.length = 0;

        //Check if links are valid
        for (const link of links) {
            //Check if album folder does not exist
            if (!(await Files.exists(link.albumFolder)) || (validateMetadata && !(await Files.exists(link.metadataFile)))) {
                return false;
            }
        }

        //Load links info
        for (const link of links) {
            //Create & save album
            const album = await Album.create(link, ignoreVideos);
            albums.add(album);
        }

        //Success
        return true;
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
        if (backup && await Files.exists(this.metadataPath)) {
            //Create new backup path
            let metadataBackupPath = '';
            let metadataBackupIndex = 0;
            while (true) {
                metadataBackupPath = `${this.metadataPath}.backup${metadataBackupIndex}`;
                if (!await Files.exists(metadataBackupPath)) break;
                metadataBackupIndex++;
            }

            //Backup current metadata file
            await Files.rename(this.metadataPath, metadataBackupPath);
        }

        //Save file
        Files.saveJSON(this.metadataPath, this.metadata, false);
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
