import type { App } from '../app';

export enum ScreenState { Open, Closed }

export abstract class BaseScreen {

    //Screen
    protected app: App

    constructor(app: App) {
        this.app = app;
    }

    //Rendering
    abstract render(): string

    //State
    private _state: ScreenState = ScreenState.Closed

    get state(): ScreenState { return this._state; }

    open() {
        this._state = ScreenState.Open;
        this.onRendered();
        this.onOpened();
    }

    protected abstract onRendered(): void

    protected abstract onOpened(): void

    close(): boolean {
        this._state = ScreenState.Closed;
        return this.onClosed();
    }

    protected abstract onClosed(): boolean

}