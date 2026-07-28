export enum BridgeState { Offline, Online, Connected }

export class AppBridge {

    constructor() {}

    //State
    private _state: BridgeState = BridgeState.Offline;

    get state() { return this._state; }

}