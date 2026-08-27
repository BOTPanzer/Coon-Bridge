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
            await listen<string>('ws://log', (event) => {
                this.log(event.payload);
            })
        );

        this.unlistenFns.push(
            await listen<string>('ws://error', (event) => {
                this.log(`Internal error: ${event.payload}`);
            })
        );

        this.unlistenFns.push(
            await listen<string>('ws://message-string', (event) => {
                this.onReceivedString(event.payload);
            })
        );

        this.unlistenFns.push(
            await listen<number[]>('ws://message-binary', (_) => {
                this.onReceivedBinary();
            })
        );
    }

    private clearServerEvents(): void {
        this.unlistenFns.forEach((unlisten) => unlisten());
        this.unlistenFns = [];
    }

    public async start(PORT: number = 6969): Promise<void> {
        try {
            //Register rust events
            await this.registerServerEvents();

            //Start server
            const IP = await invoke<string>('server_start', { port: PORT });
            this.setAddress(IP, PORT);
        } catch (e: any) {
            //Failed to start server
            this.log(e);
        }
    }

    //State
    private setAddress(IP: string, PORT: number) {
        //Update info
        this.IP = IP;
        this.PORT = PORT;

        //Notify
        this.onAddressIsKnown(IP, PORT);
    }

    protected onAddressIsKnown(IP: string, PORT: number): void {
        this.log(`Server address: ${IP}:${PORT}`);
    }

    private setServerState(isRunning: boolean) {
        //Update info
        this._isRunning = isRunning;

        //Notify
        this.onServerStateChanged(isRunning);
    }

    protected onServerStateChanged(isRunning: boolean): void {
        if (isRunning) {
            this.log('Server is now running');
        } else {
            this.log('Server is now stopped');
        }
    }

    private setConnectionState(isConnected: boolean, clientIP: string) {
        //Update info
        this._isConnected = isConnected;

        //Notify
        this.onConnectionStateChanged(isConnected, clientIP);
    }

    protected onConnectionStateChanged(isConnected: boolean, clientIP: string): void {
        if (isConnected) {
            this.log(`Connected to client with IP ${clientIP}`);
        } else {
            this.log(`Disconnected from client with IP ${clientIP}`);
        }
    }

    //Data
    protected async onReceivedString(_: string): Promise<void> {
        this.log(`Received string`);
    }

    protected async onReceivedBinary(): Promise<void> {
        this.log(`Received bytes`);
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