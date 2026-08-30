import { invoke } from '@tauri-apps/api/core';
import { Files, Util } from '.';



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
export type Link = {
    albumFolder: string;
    metadataFile: string;
}

//Metadata
export type MetadataItem = {
    caption: string | null;
    labels: string[] | null;
    text: string[] | null;
    embedding: number[] | null;
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
    private metadataModifiedItems: Set<string> = new Set();

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

    static async create(link: Link, loadItems: Boolean, loadMetadata: Boolean, ignoreVideos: Boolean): Promise<Album> {
        //Temp
        let items: Item[] = [];
        let metadata: Metadata = {};

        //Check if album is valid
        if (loadItems && await Files.exists(link.albumFolder)) {
            //Valid -> Get all allowed files in the album folder
            const itemsData = await invoke<{ name: string; path: string; lastModified: number, isVideo: boolean }[]>('list_folder_items', {
                folderPath: link.albumFolder,
                ignoreVideos: ignoreVideos
            });
            items = itemsData.map(data => new Item(data.name, data.path, data.lastModified, data.isVideo));
        }

        //Check if metadata is valid
        if (loadMetadata && await Files.exists(link.metadataFile)) {
            //Valid -> Load metadata file info
            metadata = await invoke<Metadata>('read_metadata_db', { 
                dbPath: link.metadataFile 
            });
        }

        //Create album
        return new Album(link, items, metadata);
    }

    static async loadAlbums(links: Link[], albums: Album[], loadItems: Boolean, loadMetadata: Boolean, ignoreVideos: Boolean): Promise<boolean> {
        //Clear albums list
        albums.length = 0;

        //Check if links are valid
        for (const link of links) {
            //Check if album folder does not exist
            if ((loadItems && !(await Files.exists(link.albumFolder))) || (loadMetadata && !(await Files.exists(link.metadataFile)))) {
                return false;
            }
        }

        //Load links info
        for (const link of links) {
            //Create & save album
            const album = await Album.create(link, loadItems, loadMetadata, ignoreVideos);
            albums.add(album);
        }

        //Success
        return true;
    }

    //Actions
    search(query: string): Item[] {
        //Tokenize query
        const queryTokens = Util.tokenize(query);

        //Create results list
        const scoredResults: { item: Item; score: number }[] = [];

        //Calculate average document length across items for BM25
        let totalTokens = 0;
        let validDocs = 0;

        for (const item of this.items) {
            const itemMetadata = this.getItemMetadata(item.name);
            const textPool = [
                itemMetadata.caption || '',
                ...(itemMetadata.labels || []),
                ...(itemMetadata.text || [])
            ].join(' ');

            const tokens = Util.tokenize(textPool);
            if (tokens.length > 0) {
                totalTokens += tokens.length;
                validDocs++;
            }
        }

        const avgDocLen = validDocs > 0 ? totalTokens / validDocs : 1;

        //Check all items
        for (const item of this.items) {
            //Get item metadata
            const itemMetadata = this.getItemMetadata(item.name);

            //Combine all text sources for scoring 😸
            const textPool = [
                itemMetadata.caption || '',
                ...(itemMetadata.labels || []),
                ...(itemMetadata.text || [])
            ].join(' ');

            //Calculate BM25 score
            const score = Util.scoreBM25(queryTokens, textPool, avgDocLen);

            //Only keep relevant matches
            if (score > 0) {
                scoredResults.push({ item, score });
            }
        }

        //Return results
        return scoredResults.map(res => res.item);
    }

    sortItems() {
        //Sort items
        this._items.sort((a, b) => b.lastModified - a.lastModified);
    }

    //Metadata management
    itemHasMetadata(itemName: string): boolean {
        //Check if item has metadata
        return this.metadata[itemName] != undefined;
    }

    getItemMetadata(itemName: string): MetadataItem {
        //Check if item has metadata
        if (this.itemHasMetadata(itemName)) {
            return this.metadata[itemName];
        } else {
            return {
                caption: null,
                labels: null,
                text: null,
                embedding: null
            };
        }
    }

    setItemMetadata(itemName: string, itemMetadata: MetadataItem) {
        //Update item metadata
        this.metadata[itemName] = itemMetadata;

        //Mark item as modified
        this.metadataModifiedItems.add(itemName);
    }

    cleanMetadata() {
        //Create new metadata
        const newMetadata: Metadata = {};

        //Move items with metadata to the new metadata var
        for (const item of this.items) {
            //Get item name
            const itemName = item.name;

            //Check if item has metadata
            if (this.itemHasMetadata(itemName)) {
                //Has metadata -> Add key to new metadata
                newMetadata[itemName] = this.getItemMetadata(itemName);
            }
        }

        //Check for deleted metadata items
        for (const itemName of Object.keys(this.metadata)) {
            //Check if item exists in new metadata
            if (newMetadata[itemName] == undefined) {
                //Doesn't exist -> Mark item as deleted
                this.metadataModifiedItems.add(itemName);
            }
        }

        //Replace old metadata with the new one
        this.metadata = newMetadata;
    }

    async saveMetadata(backup: boolean = true) {
        //No changes
        if (this.metadataModifiedItems.size <= 0) return

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
            await Files.clone(this.metadataPath, metadataBackupPath);
        }

        //Check for updated or deleted items
        const updated: Record<string, MetadataItem> = {};
        const deleted: string[] = [];

        for (const key of this.metadataModifiedItems) {
            if (this.itemHasMetadata(key)) {
                updated[key] = this.metadata[key];
            } else {
                deleted.push(key);
            }
        }

        //Save file
        await invoke('save_metadata_db', {
            dbPath: this.metadataPath,
            updated: updated,
            deleted: deleted
        });

        //Clear modified items
        this.metadataModifiedItems.clear();
    }

}
