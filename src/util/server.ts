import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export class Server {

    constructor() {}

    //Connection
    private unlistenFns: UnlistenFn[] = [];

    protected IP?: string;
    protected PORT?: number;

    //State
    private _isRunning: boolean = false;
    private _isConnected: boolean = false;

    public get isRunning(): boolean { return this._isRunning; }
    public get isConnected(): boolean { return this._isConnected; }

    //Logs
    protected logs: string[] = [];


    //Connection
    public async start(PORT: number = 6969): Promise<void> {
        //Check if already running
        if (this.isRunning) {
            this.logMessage('Server is already running');
            return;
        }

        //Save connection address
        this.IP = '0.0.0.0'; //Change later to local IP
        this.PORT = PORT;

        //Log starting
        this.logMessage(`Starting server in port ${this.PORT}...`);

        //Start server
        try {
            await this.registerEvents();
            this.IP = await invoke<string>('server_start', { port: PORT });
            this.onAddressIsKnown(this.IP, this.PORT);
        } catch (e: any) {
            this.logMessage(`Internal error: ${e}`);
            this.setServerState(false);
        }
    }

    private async registerEvents(): Promise<void> {
        //Clear old events
        this.clearEvents();

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
                const buffer = Buffer.from(event.payload);
                this.onReceivedBinary(buffer);
            })
        );

        this.unlistenFns.push(
            await listen<string>('ws://error', (event) => {
                this.logMessage(`Internal error: ${event.payload}`);
            })
        );
    }

    private clearEvents(): void {
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
        this.logMessage(`Server address: ${IP}:${PORT}`);
    }

    protected onServerStateChanged(isRunning: boolean): void {
        if (isRunning) {
            this.logMessage('Server is now running');
        } else {
            this.logMessage('Server is now not running');
        }
    }

    protected onConnectionStateChanged(isConnected: boolean, clientIP: string): void {
        if (isConnected) {
            this.logMessage(`Connected to client with IP ${clientIP}`);
        } else {
            this.logMessage(`Disconnected from client with IP ${clientIP}`);
        }
    }

    //Data
    protected async onReceivedString(message: string): Promise<void> {
        this.logMessage(`Received string: ${message.length} characters`);
    }

    protected async onReceivedBinary(data: Buffer): Promise<void> {
        this.logMessage(`Received bytes: ${data.length} bytes`);
    }

    protected async send(data: string | Buffer): Promise<void> {
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
    protected logMessage(message: string): void {
        this.logs.push(message);
        console.log(message);
    }

}