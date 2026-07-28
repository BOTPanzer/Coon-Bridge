import { type App } from "../";
import { type AppActions } from "./actions";

export enum BridgeState { Offline, Online, Connected }

export class AppBridge {

    constructor(app: App) {
        this.app = app;
    }

    //App
    private app: App

    get actions(): AppActions { return this.app.actions; }

    //State
    private _state: BridgeState = BridgeState.Offline;

    get state() { return this._state; }

}