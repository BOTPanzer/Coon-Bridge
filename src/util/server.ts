import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';



  /*$$$$$
 /$$__  $$
| $$  \__/  /$$$$$$   /$$$$$$  /$$    /$$ /$$$$$$   /$$$$$$
|  $$$$$$  /$$__  $$ /$$__  $$|  $$  /$$//$$__  $$ /$$__  $$
 \____  $$| $$$$$$$$| $$  \__/ \  $$/$$/| $$$$$$$$| $$  \__/
 /$$  \ $$| $$_____/| $$        \  $$$/ | $$_____/| $$
|  $$$$$$/|  $$$$$$$| $$         \  $/  |  $$$$$$$| $$
 \______/  \_______/|__/          \_/    \_______/|_*/

export class Server {

    constructor() {}

    //Connection
    private unlistenFns: UnlistenFn[] = [];

    protected IP?: string;
    protected PORT?: number;

    //State
    private _isStarting: boolean = false;
    private _isRunning: boolean = false;
    private _isConnected: boolean = false;

    public get isStarting(): boolean { return this._isStarting; }
    public get isRunning(): boolean { return this._isRunning; }
    public get isConnected(): boolean { return this._isConnected; }

    //Logs
    protected _logs: string[] = [];

    public get logs(): readonly string[] { return this._logs; }


    //Connection
    public async start(PORT: number = 6969): Promise<void> {
        //Check if already running
        if (this.isRunning) {
            this.log('Server is already running');
            return;
        }

        //Check if already starting
        if (this.isStarting) {
            this.log('Server is already starting');
            return;
        }
        this._isStarting = true;

        //Log starting
        this.log(`Starting server in port ${PORT}...`);

        //Start server
        try {
            await this.registerServerEvents();
            this.IP = await invoke<string>('server_start', { port: PORT });
            this.PORT = PORT;
            this.onAddressIsKnown(this.IP, this.PORT);
        } catch (e: any) {
            this.log(`Internal error: ${e}`);
            this.setServerState(false);
        }
        this._isStarting = false;
    }

    private async registerServerEvents(): Promise<void> {
        //Clear old events
        this.clearServerEvents();

        //Register new events
        this.unlistenFns.push(
            await listen<boolean>('ws://server-state', (event) => {
                this.setServerState(event.payload);
            })
        );

        this.unlistenFns.push(
            await listen<{ connected: boolean; ip: string }>('ws://connection-state', (event) => {
                this.setConnectionState(event.payload.connected, event.payload.ip);
            })
        );

        this.unlistenFns.push(
            await listen<string>('ws://message-string', (event) => {
                this.onReceivedString(event.payload);
            })
        );

        this.unlistenFns.push(
            await listen<number[]>('ws://message-binary', (event) => {
                const buffer = Uint8Array.from(event.payload);
                this.onReceivedBinary(buffer);
            })
        );

        this.unlistenFns.push(
            await listen<string>('ws://error', (event) => {
                this.log(`Internal error: ${event.payload}`);
            })
        );
    }

    private clearServerEvents(): void {
        this.unlistenFns.forEach((unlisten) => unlisten());
        this.unlistenFns = [];
    }

    //State
    private setServerState(isRunning: boolean) {
        //Update state
        this._isRunning = isRunning;
        this.onServerStateChanged(isRunning);
    }

    private setConnectionState(isConnected: boolean, clientIP: string) {
        //Update state
        this._isConnected = isConnected;
        this.onConnectionStateChanged(isConnected, clientIP);
    }

    protected onAddressIsKnown(IP: string, PORT: number): void {
        this.log(`Server address: ${IP}:${PORT}`);
    }

    protected onServerStateChanged(isRunning: boolean): void {
        if (isRunning) {
            this.log('Server is now running');
        } else {
            this.log('Server is now not running');
        }
    }

    protected onConnectionStateChanged(isConnected: boolean, clientIP: string): void {
        if (isConnected) {
            this.log(`Connected to client with IP ${clientIP}`);
        } else {
            this.log(`Disconnected from client with IP ${clientIP}`);
        }
    }

    //Data
    protected async onReceivedString(str: string): Promise<void> {
        this.log(`Received string: ${str.length} characters`);
    }

    protected async onReceivedBinary(data: Uint8Array): Promise<void> {
        this.log(`Received bytes: ${data.length} bytes`);
    }

    protected async send(data: string | Uint8Array): Promise<void> {
        //Check if connected
        if (!this.isConnected) return;

        //Send data
        if (typeof data === 'string') {
            await invoke('server_send_text', { message: data });
        } else {
            await invoke('server_send_binary', { data: Array.from(data) });
        }
    }

    //Logs
    protected log(message: string): void {
        this._logs.push(message);
        console.log(message);
    }

}