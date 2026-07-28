import { type App } from "../";
import { type AppBridge } from "./bridge";

export enum ActionsState { Idle, Syncing, Metadating }

export class AppActions {

    constructor(app: App) {
        this.app = app;
    }

    //App
    private app: App

    get bridge(): AppBridge { return this.app.bridge; }

    //State
    private _state: ActionsState = ActionsState.Idle;

    get state() { return this._state; }

}