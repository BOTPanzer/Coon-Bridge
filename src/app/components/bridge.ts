import { type App } from '..';
import { Album, Files, Server, Util } from '../../util';

class Request {
    //Album
    albumIndex: number = -1;
    itemIndex: number = -1;

    //File info
    lastModified: number = 0; //Seconds
    size: number = 0;

    //Parts info
    partIndex: number = 0;
    partMaxSize: number = 0;
    parts: number = 1;
}

class QueueItem {
    albumIndex: number = -1;
    itemIndex: number = -1;
}

class HostInfo {
    //Albums
    albums: Album[] = [];

    //File request
    request: Request | null = null;

    //Queue info
    queueIndex: number = -1;
    queue: QueueItem[] = [];
}

class ClientInfo {
    //Albums
    albums: string[][] = [];
}

export class AppBridge extends Server {

    constructor(app: App) {
        super();
        this.app = app;
    }

    //Info
    private app: App;
    private host: HostInfo = new HostInfo();
    private client: ClientInfo = new ClientInfo();

    private _isSyncing: boolean = false;
    private _connectionCode: string = '';

    get isSyncing(): boolean { return this._isSyncing; }
    get connectionCode(): string { return this._connectionCode; }

    //Events
    private eventsOnLogMessage: Set<(text: string) => void> = new Set();
    private eventsOnServerStateChanged: Set<Function> = new Set();
    private eventsOnConnectionStateChanged: Set<Function> = new Set();
    private eventsOnConnectionCodeChanged: Set<Function> = new Set();


    //Info
    private resetInfo() {
        //Host info (this pc)
        this.host = new HostInfo()

        //Client info (the connected phone)
        this.client = new ClientInfo()
    }

    private async loadAlbums(loadItems: Boolean, loadMetadata: Boolean, ): Promise<boolean> {
        //Load albums
        const success = await Album.loadAlbums(this.app.settings.links, this.host.albums, loadItems, loadMetadata, false);

        //Check result
        if (success) {
            //Log result
            this.log('Albums loaded successfully.');
        } else {
            //Log result
            this.log('Failed to load albums: Make sure all links have a valid album folder!');
        }
        return success;
    }

    private clearAlbums() {
        //Empty albums list
        this.host.albums.length = 0;
    }

    //Events
    registerEvents(logMessage: ((text: string) => void) | null = null, serverStateChanged = null, connectionStateChanged = null, connectionCodeChanged = null) {
        if (logMessage) {
            this.eventsOnLogMessage.add(logMessage);
        }
        if (serverStateChanged) {
            this.eventsOnServerStateChanged.add(serverStateChanged);
        }
        if (connectionStateChanged) {
            this.eventsOnConnectionStateChanged.add(connectionStateChanged);
        }
        if (connectionCodeChanged) {
            this.eventsOnConnectionCodeChanged.add(connectionCodeChanged);
        }
    }

    unregisterEvents(logMessage: ((text: string) => void) | null = null, serverStateChanged = null, connectionStateChanged = null, connectionCodeChanged = null) {
        if (logMessage) {
            this.eventsOnLogMessage.delete(logMessage);
        }
        if (serverStateChanged) {
            this.eventsOnServerStateChanged.delete(serverStateChanged);
        }
        if (connectionStateChanged) {
            this.eventsOnConnectionStateChanged.delete(connectionStateChanged);
        }
        if (connectionCodeChanged) {
            this.eventsOnConnectionCodeChanged.delete(connectionCodeChanged);
        }
    }

    //Logs
    override log(message: string) {
        //Call parent function
        super.log(message);

        //Call events
        for (const callback of this.eventsOnLogMessage) {
            callback(message);
        }
    }

    //State
    override onAddressIsKnown(IP: string, PORT: number) {
        //Update connection code
        this.setConnectionCode(this.addressToCode(IP, PORT));
        this.log(`Connection code: ${this.connectionCode}`);
    }

    override onServerStateChanged(isRunning: boolean) {
        //Call parent function
        super.onServerStateChanged(isRunning);

        //Check if running
        if (!isRunning) {
            //Server stopped -> Reset connection code & stop syncing
            this.setConnectionCode('---');
            this.setSyncing(false);
        }

        //Call events
        for (const callback of this.eventsOnServerStateChanged) {
            callback(isRunning);
        }
    }

    override onConnectionStateChanged(isConnected: boolean, clientIP: string) {
        //Call parent function
        super.onConnectionStateChanged(isConnected, clientIP);

        //Check state
        if (!isConnected) {
            //Stop syncing & reset info if connection was closed
            this.setSyncing(false);
            this.resetInfo();
        }

        //Call events
        for (const callback of this.eventsOnConnectionStateChanged) {
            callback(isConnected, clientIP);
        }
    }

    //Data
    override async onReceivedString(str: string) {
        //Parse JSON from string
        try {
            //Parse JSON
            const message: any = JSON.parse(str);

            //Check if message has action
            if (!('action' in message)) {
                //No action -> Show error
                this.log('Missing JSON message action');
            } else {
                //Has action -> Check it
                switch (message['action']) {
                    //End sync
                    case 'endSync':
                        this.actionEndSync();
                        break;
                    //Received client albums
                    case 'albums':
                        this.actionReceivedAlbums(message);
                        break;
                    //Received item info
                    case 'itemInfo':
                        await this.actionReceivedItemInfo(message);
                        break;
                    //Received metadata info
                    case 'metadataInfo':
                        await this.actionReceivedMetadataInfo(message);
                        break;
                    //Send metadata info
                    case 'requestMetadataInfo':
                        await this.actionSendMetadataInfo(message);
                        break;
                    //Send metadata data
                    case 'requestMetadataData':
                        await this.actionSendMetadataData(message);
                        break;
                }
            }
        } catch(e: any) {
            //Failed to parse json
            this.log(`Failed to parse JSON: ${e}`)
        }
    }

    override async onReceivedBinary(data: Uint8Array) {
        //Get request
        const request = this.host.request!;

        //Check request type
        if (request.itemIndex >= 0) {
            //Has item index -> Is a file request
            await this.actionReceivedItemData(request, data)
        } else {
            //No item index -> Is a metadata request
            await this.actionReceivedMetadataData(request, data)
        }
    }

    //Connection code
    private setConnectionCode(newCode: string) {
        //Update code
        this._connectionCode = newCode;
        
        //Call events
        for (const callback of this.eventsOnConnectionCodeChanged) {
            callback(newCode);
        }
    }

    private encodeBase36(n: number): string {
        const CODE_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (n === 0) return CODE_CHARSET[0];
        let res = "";
        while (n > 0) {
            const rem = n % 36;
            n = Math.floor(n / 36);
            res = CODE_CHARSET[rem] + res;
        }
        return res;
    }

    private addressToCode(IP: string, PORT: number): string {
        const parts = IP.split('.').map(Number);
        const ipNum = (parts[0] * 16777216) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
        const combined = (ipNum * 65536) + PORT;
        return this.encodeBase36(combined);
    }

    //Syncing
    private setSyncing(newSyncing: boolean) {
        this._isSyncing = newSyncing;
    }

    //Actions
    private actionEndSync(message: string = 'Finished sync') {
        //Stop syncing
        this.setSyncing(false);
        this.log(message);

        //Clear albums cache
        this.clearAlbums();
    }

    private actionReceivedAlbums(message: any) {
        //Save client albums
        this.client.albums = message['albums'];
        this.log('Received client albums list');
    }

    //Actions (receive item)
    private async actionReceivedItemInfo(message: any) {
        //Create new request info
        const request = new Request();
        request.albumIndex = message['albumIndex'];
        request.itemIndex = message['itemIndex'];
        request.lastModified = message['lastModified'];
        request.size = message['size'];
        request.partMaxSize = message['maxPartSize'];
        request.parts = message['parts'];
        this.host.request = request;

        //Request data
        await this.send(JSON.stringify({
            'action': 'requestItemData',
            'albumIndex': request.albumIndex,
            'itemIndex': request.itemIndex,
            'part': request.partIndex,
            'requestIndex': this.host.queueIndex,
            'requestCount': this.host.queue.length
        }));
    }

    private async actionReceivedItemData(request: Request, data: Uint8Array) {
        //Get info
        const albumIndex: number = request.albumIndex;
        const itemIndex: number = request.itemIndex;
        const partIndex: number = request.partIndex;
        const itemName: string = this.client.albums[albumIndex][itemIndex];
        const itemPath: string = await Files.join(this.host.albums[albumIndex].albumPath, itemName);

        //Manage write data
        const finished: Boolean = await this.manageWriteData(request, data, itemPath)

        //Check if finished
        if (finished) {
            //Finished -> Request next
            await this.requestNextQueueItem();
        } else {
            //Not finished -> Request next part
            await this.send(JSON.stringify({
                'action': 'requestItemData',
                'albumIndex': albumIndex,
                'itemIndex': itemIndex,
                'part': partIndex,
                'requestIndex': this.host.queueIndex,
                'requestCount': this.host.queue.length
            }));
        }
    }

    //Actions (receive metadata)
    private async actionReceivedMetadataInfo(message: any) {
        //Check if last modified is valid (if client doesn't have the file it doesn't add it)
        if (!('lastModified' in message)) {
            //Not valid -> Request next
            this.log('Client does not have the file');
            await this.requestNextQueueMetadata();
        }

        //Create new request info
        const request = new Request();
        request.albumIndex = message['albumIndex'];
        request.lastModified = message['lastModified'];
        this.host.request = request;

        //Request data
        await this.send(JSON.stringify({
            'action': 'requestMetadataData',
            'albumIndex': request.albumIndex
        }));
    }

    private async actionReceivedMetadataData(request: Request, data: Uint8Array) {
        //Get info
        const albumIndex: number = request.albumIndex;
        const metadataPath: string = this.host.albums[albumIndex].metadataPath;

        //Manage write data
        const finished: boolean = await this.manageWriteData(request, data, metadataPath);

        //Check if finished
        if (finished) {
            //Finished -> Request next
            await this.requestNextQueueMetadata();
        } else {
            //Not finished -> Request next part
            await this.send(JSON.stringify({
                'action': 'requestMetadataData',
                'albumIndex': albumIndex
            }));
        }
    }

    //Actions (send metadata)
    private async actionSendMetadataInfo(message: any) {
        //Get info
        const albumIndex: number = message['albumIndex'];
        const metadataPath: string = this.host.albums[albumIndex].metadataPath;

        //Log
        this.log(`- Sending metadata for album ${albumIndex}...`);

        //Send info
        await this.send(JSON.stringify({
            'action': 'metadataInfo',
            'albumIndex': albumIndex,
            'lastModified': (await Files.getLastModified(metadataPath)) / 1000 //Dates get sent in seconds, we use millis
        }));
    }

    private async actionSendMetadataData(message: any) {
        //Get info
        const albumIndex: number = message['albumIndex'];
        const metadataPath: string = this.host.albums[albumIndex].metadataPath;

        //Send info
        const bytes = await Files.readBytes(metadataPath);
        await this.send(bytes ?? Uint8Array.from([]));
    }

    //Helpers
    private async manageWriteData(request: Request, data: Uint8Array, filePath: string): Promise<boolean> {
        //Get info
        const lastModified: number = request.lastModified * 1000; //Dates get sent in seconds, we use millis

        const partIndex: number = request.partIndex;
        const partMaxSize: number = request.partMaxSize;
        const parts: number = request.parts;

        const isValid: boolean = data.length > 0;
        const isLast: boolean = (partIndex + 1) == parts;

        //Write file
        if (isValid) {
            //Write data on part offset
            Files.writeFileWithOffset(filePath, partIndex * partMaxSize, data);

            //Mark part as complete
            request.partIndex += 1;

            //Check if is the last part 
            if (isLast) {
                //Is the last part -> Update last modified timestamp
                Files.setLastModified(filePath, lastModified);

                //Log progress
                const progressCurrent = (this.host.queueIndex + 1);
                const progressSize = this.host.queue.length;
                const percent = Util.round(progressCurrent / progressSize * 100, 2);
                this.log(`(${progressCurrent}/${progressSize}, ${percent}%) ${isValid ? 'Success' : 'Error, data is invalid'}`);
            } else {
                //Not the last part -> Log progress
                this.log(`Received part ${partIndex + 1}/${parts}`);

                //Mark as not finished
                return false;
            }
        } else {
            //Log error
            this.log('Invalid data');
        }

        //Mark as finished
        return true;
    }

    private async requestNextQueueItem() {
        //Check if still connected
        if (!this.isConnected) return;

        //Update queue index
        this.host.queueIndex += 1;
        const queueIndex = this.host.queueIndex;
        const queueSize = this.host.queue.length;

        //Check if queue has remaining items
        if (queueIndex >= queueSize) {
            //No items left -> Finish sync
            this.actionEndSync('Finished downloading albums');
            await this.send(JSON.stringify({
                'action': 'endSync'
            }));
        } else {
            //Items left -> Get next item
            const next = this.host.queue[queueIndex];

            //Request next
            this.log(`- Requesting item "${this.client.albums[next.albumIndex][next.itemIndex]}"...`);
            await this.send(JSON.stringify({
                'action': 'requestItemInfo',
                'albumIndex': next.albumIndex,
                'itemIndex': next.itemIndex,
                'requestIndex': queueIndex,
                'requestCount': queueSize
            }));
        }
    }

    private async requestNextQueueMetadata() {
        //Check if still connected
        if (!this.isConnected) return;

        //Update queue index
        this.host.queueIndex += 1;
        const queueIndex = this.host.queueIndex;
        const queueSize = this.host.queue.length;

        //Check if queue has remaining items
        if (queueIndex >= queueSize) {
            //No items left -> Finish sync
            this.actionEndSync('Finished downloading metadata');
            await this.send(JSON.stringify({
                'action': 'endSync'
            }));
        } else {
            //Items left -> Get next item
            const next = this.host.queue[queueIndex];

            //Request next
            this.log(`- Requesting metadata for album ${next.albumIndex}...`);
            await this.send(JSON.stringify({
                'action': 'requestMetadataInfo',
                'albumIndex': next.albumIndex
            }));
        }
    }

    private canUse(): boolean {
        //Check if server is running
        if (!this.isRunning) {
            this.log('Server is not running');
            return false;
        }

        //Check if a client is connected
        if (!this.isConnected) {
            this.log('Connect your phone first');
            return false;
        }

        //Check if server is syncing
        if (this.isSyncing) {
            this.log('A sync is in progress');
            return false;
        }

        //Is free to use
        return true;
    }

    //Options
    private async performAction(action: Function) {
        //Check if can use
        if (!this.canUse()) return;

        //Perform action
        await action();
    }

    async downloadAlbums() {
        //Perform action
        this.performAction(async () => {
            //Start syncing
            this.setSyncing(true);
            this.log('Starting to download albums...');

            //Load albums
            const success = await this.loadAlbums(true, false);
            if (!success) {
                //Failed to load albums -> Stop syncing
                this.setSyncing(false);
                this.log('Download cancelled');
                return;
            }

            //Check albums sizes
            const hostAlbumsCount = this.host.albums.length;
            const clientAlbumsCount = this.client.albums.length;
            if (hostAlbumsCount !== clientAlbumsCount) {
                //Different album amounts -> Stop syncing
                this.setSyncing(false);
                this.log(`Download cancelled, make sure both apps have the same amount of links! (host: ${hostAlbumsCount}, client: ${clientAlbumsCount})`);
                return;
            }

            //Create empty queue
            const queue: QueueItem[] = [];

            //Check albums
            for (let albumIndex = 0; albumIndex < this.host.albums.length; albumIndex++) {
                const hostAlbum = this.host.albums[albumIndex];
                //Get client album (item names list)
                const clientAlbum = this.client.albums[albumIndex];

                //Check for deleted files
                if (!this.app.settings.syncIgnoreDeletedItems) {
                    for (const hostItem of hostAlbum.items) {
                        //Check if client album contains item
                        if (clientAlbum.includes(hostItem.name)) continue;

                        //Item is missing -> It was deleted
                        this.log(`Deleted file found, deleting "${hostItem.name}"...`);
                        await Files.remove(hostItem.path);
                    }
                }

                //Check for missing files (from oldest to newest)
                const reversedClientAlbum = [...clientAlbum].reverse();
                for (let reversedItemIndex = 0; reversedItemIndex < reversedClientAlbum.length; reversedItemIndex++) {
                    const itemName = reversedClientAlbum[reversedItemIndex];

                    //Check if host album contains item
                    if (hostAlbum.items.some(albumItem => albumItem.name === itemName)) continue;

                    //Item is missing -> It needs to be downloaded
                    this.log(`Missing file found, adding "${itemName}" to the queue...`);
                    const item = new QueueItem();
                    item.albumIndex = albumIndex;
                    item.itemIndex = clientAlbum.length - (reversedItemIndex + 1);
                    queue.push(item);
                }
            }

            //Update queue
            this.host.queue = queue;

            //Request first item
            this.host.queueIndex = -1;
            await this.requestNextQueueItem();
        });
    }

    async downloadMetadata() {
        //Perform action
        this.performAction(async () => {
            //Start syncing
            this.setSyncing(true);
            this.log('Starting to download metadata...');

            //Load albums
            const success = await this.loadAlbums(false, false);
            if (!success) {
                //Failed to load albums -> Stop syncing
                this.setSyncing(false);
                this.log('Download cancelled');
                return;
            }

            //Create empty queue
            const queue: QueueItem[] = [];

            //Check metadata files
            for (const [index, link] of this.app.settings.links.entries()) {
                //Get metadata path
                const metadataPath = link.metadataFile;

                //Check if metadata exists
                if (!(await Files.exists(metadataPath))) {
                    //Path does not exist -> Stop syncing
                    this.setSyncing(false);
                    this.log('Download cancelled, make sure all link metadata files exist!');
                    return;
                }

                //Create item & add it to the queue
                const item = new QueueItem();
                item.albumIndex = index;
                queue.push(item);
            }

            //Update queue
            this.host.queue = queue;

            //Request first
            this.host.queueIndex = -1;
            await this.requestNextQueueMetadata();
        });
    }

    async uploadMetadata() {
        //Perform action
        this.performAction(async () => {
            //Start syncing
            this.setSyncing(true);
            this.log('Starting to upload metadata...');

            //Load albums
            const success = await this.loadAlbums(false, false);
            if (!success) {
                //Failed to load albums -> Stop syncing
                this.setSyncing(false);
                this.log('Upload cancelled');
                return;
            }

            //Check metadata files
            for (const link of this.app.settings.links) {
                //Get metadata path
                const metadataPath = link.metadataFile;

                //Check if metadata exists
                if (!(await Files.exists(metadataPath))) {
                    //Path does not exist -> Stop syncing
                    this.setSyncing(false);
                    this.log('Upload cancelled, make sure all link metadata files exist!');
                    return;
                }
            }

            //Start metadata request
            await this.send(JSON.stringify({
                action: 'startMetadataRequest'
            }));
        });
    }

}
