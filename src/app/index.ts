import { getCurrentWindow } from '@tauri-apps/api/window';
import { getMatches } from '@tauri-apps/plugin-cli';
import { BaseScreen, HomeScreen, SettingsScreen, MetadataScreen, SyncScreen } from '../screens';
import { AppSettings, loadSettings, saveSettings } from './components/settings';
import { AppBridge } from './components/bridge';



 /*$$$$$$$ /$$                                               /$$
| $$_____/| $$                                              | $$
| $$      | $$  /$$$$$$  /$$$$$$/$$$$   /$$$$$$  /$$$$$$$  /$$$$$$   /$$$$$$$
| $$$$$   | $$ /$$__  $$| $$_  $$_  $$ /$$__  $$| $$__  $$|_  $$_/  /$$_____/
| $$__/   | $$| $$$$$$$$| $$ \ $$ \ $$| $$$$$$$$| $$  \ $$  | $$   |  $$$$$$
| $$      | $$| $$_____/| $$ | $$ | $$| $$_____/| $$  | $$  | $$ /$$\____  $$
| $$$$$$$$| $$|  $$$$$$$| $$ | $$ | $$|  $$$$$$$| $$  | $$  |  $$$$//$$$$$$$/
|________/|__/ \_______/|__/ |__/ |__/ \_______/|__/  |__/   \___/ |______*/

const elements = {
    //Toolbar
    toolbarTitle: document.getElementById('toolbar-title')!,
    toolbarMinimize: document.getElementById('toolbar-minimize')!,
    toolbarMaximize: document.getElementById('toolbar-maximize')!,
    toolbarClose: document.getElementById('toolbar-close')!,
    //Content
    contentPage: document.getElementById('content-page')!
}



  /*$$$$$
 /$$__  $$
| $$  \ $$  /$$$$$$   /$$$$$$
| $$$$$$$$ /$$__  $$ /$$__  $$
| $$__  $$| $$  \ $$| $$  \ $$
| $$  | $$| $$  | $$| $$  | $$
| $$  | $$| $$$$$$$/| $$$$$$$/
|__/  |__/| $$____/ | $$____/
          | $$      | $$
          | $$      | $$
          |__/      |_*/

//Start info
const startHidden = (await getMatches()).args.hidden?.value ?? false;

//Components
const settings: AppSettings = await loadSettings();

//App logic
export enum AppState { Idle, ManagingSettings, ManagingMetadata, Syncing }

export class App {

     /*$      /$$ /$$                 /$$
    | $$  /$ | $$|__/                | $$
    | $$ /$$$| $$ /$$ /$$$$$$$   /$$$$$$$  /$$$$$$  /$$  /$$  /$$
    | $$/$$ $$ $$| $$| $$__  $$ /$$__  $$ /$$__  $$| $$ | $$ | $$
    | $$$$_  $$$$| $$| $$  \ $$| $$  | $$| $$  \ $$| $$ | $$ | $$
    | $$$/ \  $$$| $$| $$  | $$| $$  | $$| $$  | $$| $$ | $$ | $$
    | $$/   \  $$| $$| $$  | $$|  $$$$$$$|  $$$$$$/|  $$$$$/$$$$/
    |__/     \__/|__/|__/  |__/ \_______/ \______/  \_____/\__*/

    //Window
    private window = getCurrentWindow();

    //Init
    initWindow = () => {
        //Prevent flashbang while loading
        window.onload = () => {
            //Show window after it loads
            if (!startHidden) this.window.show()
        }
    }

     /*$$$$$$$                  /$$ /$$
    |__  $$__/                 | $$| $$
       | $$  /$$$$$$   /$$$$$$ | $$| $$$$$$$   /$$$$$$   /$$$$$$
       | $$ /$$__  $$ /$$__  $$| $$| $$__  $$ |____  $$ /$$__  $$
       | $$| $$  \ $$| $$  \ $$| $$| $$  \ $$  /$$$$$$$| $$  \__/
       | $$| $$  | $$| $$  | $$| $$| $$  | $$ /$$__  $$| $$
       | $$|  $$$$$$/|  $$$$$$/| $$| $$$$$$$/|  $$$$$$$| $$
       |__/ \______/  \______/ |__/|_______/  \_______/|_*/

    //Init
    initToolbar = () => {
        //Window events
        elements.toolbarMinimize.onclick = () => {
            //Minimize window
            this.window.minimize()
        }

        elements.toolbarMaximize.onclick = () => {
            //Maximize window
            this.window.toggleMaximize()
        }

        elements.toolbarClose.onclick = () => {
            //Close window
            this.window.close()
        }
    }

      /*$$$$$
     /$$__  $$
    | $$  \__/  /$$$$$$$  /$$$$$$   /$$$$$$   /$$$$$$  /$$$$$$$
    |  $$$$$$  /$$_____/ /$$__  $$ /$$__  $$ /$$__  $$| $$__  $$
     \____  $$| $$      | $$  \__/| $$$$$$$$| $$$$$$$$| $$  \ $$
     /$$  \ $$| $$      | $$      | $$_____/| $$_____/| $$  | $$
    |  $$$$$$/|  $$$$$$$| $$      |  $$$$$$$|  $$$$$$$| $$  | $$
     \______/  \_______/|__/       \_______/ \_______/|__/  |_*/

    //Screens
    private isChangingScreen: boolean = false;
    private _currentScreen: BaseScreen | null = null;

    get currentScreen(): BaseScreen { return this._currentScreen!; }

    private _homeScreen: HomeScreen
    private _settingsScreen: SettingsScreen
    private _metadataScreen: MetadataScreen
    private _syncScreen: SyncScreen

    get homeScreen(): HomeScreen { return this._homeScreen; }
    get settingsScreen(): SettingsScreen { return this._settingsScreen; }
    get metadataScreen(): MetadataScreen { return this._metadataScreen; }
    get syncScreen(): SyncScreen { return this._syncScreen; }

    //Toggle
    open = (newScreen: BaseScreen) => {
        //Already changing screen
        if (this.isChangingScreen) return;
        this.isChangingScreen = true;

        //Close current screen
        const closed = this.currentScreen?.close() ?? true;
        if (!closed) {
            this.isChangingScreen = false;
            return;
        }

        //Hide page
        elements.contentPage.setAttribute('hidden', '');
        const timeout = this.currentScreen == null ? 0 : 250;
        setTimeout(() => {
            //Open new screen
            elements.contentPage.innerHTML = newScreen.render();
            newScreen.open();

            //Save new screen as current
            this._currentScreen = newScreen;

            //Finish changing screen
            elements.contentPage.removeAttribute('hidden');
            this.isChangingScreen = false;
        }, timeout);
    }

      /*$$$$$                                                                              /$$
     /$$__  $$                                                                            | $$
    | $$  \__/  /$$$$$$  /$$$$$$/$$$$   /$$$$$$   /$$$$$$  /$$$$$$$   /$$$$$$  /$$$$$$$  /$$$$$$   /$$$$$$$
    | $$       /$$__  $$| $$_  $$_  $$ /$$__  $$ /$$__  $$| $$__  $$ /$$__  $$| $$__  $$|_  $$_/  /$$_____/
    | $$      | $$  \ $$| $$ \ $$ \ $$| $$  \ $$| $$  \ $$| $$  \ $$| $$$$$$$$| $$  \ $$  | $$   |  $$$$$$
    | $$    $$| $$  | $$| $$ | $$ | $$| $$  | $$| $$  | $$| $$  | $$| $$_____/| $$  | $$  | $$ /$$\____  $$
    |  $$$$$$/|  $$$$$$/| $$ | $$ | $$| $$$$$$$/|  $$$$$$/| $$  | $$|  $$$$$$$| $$  | $$  |  $$$$//$$$$$$$/
     \______/  \______/ |__/ |__/ |__/| $$____/  \______/ |__/  |__/ \_______/|__/  |__/   \___/ |_______/
                                      | $$
                                      | $$
                                      |_*/

    //Components
    private _bridge: AppBridge

    get bridge(): AppBridge { return this._bridge; }

    //Settings
    get settings(): AppSettings { return settings; }

    saveSettings = async () => {
        //Save settings
        await saveSettings(settings);
    }

      /*$$$$$
     /$$__  $$
    | $$  \ $$  /$$$$$$   /$$$$$$
    | $$$$$$$$ /$$__  $$ /$$__  $$
    | $$__  $$| $$  \ $$| $$  \ $$
    | $$  | $$| $$  | $$| $$  | $$
    | $$  | $$| $$$$$$$/| $$$$$$$/
    |__/  |__/| $$____/ | $$____/
              | $$      | $$
              | $$      | $$
              |__/      |_*/

    //State
    private _state: AppState = AppState.Idle;

    get state() { return this._state; }

    setState(newState: AppState): boolean {
        //Check if can change state
        if (this.state != AppState.Idle) return false;

        //Change state
        this._state = newState;
        return true;
    }

    resetState() {
        //Already reset
        if (this.state == AppState.Idle) return;

        //Reset state
        this._state = AppState.Idle;
    }

    //App
    constructor() {
        //Init app
        this.initWindow();
        this.initToolbar();

        //Init components
        this._bridge = new AppBridge();
        this.bridge.start();

        //Init screens
        this._homeScreen = new HomeScreen(this);
        this._settingsScreen = new SettingsScreen(this);
        this._metadataScreen = new MetadataScreen(this);
        this._syncScreen = new SyncScreen(this);
        this.open(this.homeScreen);
    }

}
