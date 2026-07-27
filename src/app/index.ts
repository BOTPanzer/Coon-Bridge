import { getCurrentWindow } from '@tauri-apps/api/window';
import { getMatches } from '@tauri-apps/plugin-cli';
import { HomeScreen } from '../screens/home';
import { BaseScreen } from '../screens/screen';
import { SettingsScreen } from '../screens/settings';
import { MetadataScreen } from '../screens/metadata';
import { SyncScreen } from '../screens/sync';



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
const matches = await getMatches();
const startHidden = matches.args.hidden?.value;

//App logic
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
    private _homeScreen: HomeScreen = new HomeScreen(this);
    private _settingsScreen: SettingsScreen = new SettingsScreen(this);
    private _metadataScreen: MetadataScreen = new MetadataScreen(this);
    private _syncScreen: SyncScreen = new SyncScreen(this);

    get currentScreen(): BaseScreen { return this._currentScreen!; }
    get homeScreen(): HomeScreen { return this._homeScreen; }
    get settingsScreen(): SettingsScreen { return this._settingsScreen; }
    get metadataScreen(): MetadataScreen { return this._metadataScreen; }
    get syncScreen(): SyncScreen { return this._syncScreen; }

    //Toggle
    open(screen: BaseScreen) {
        //Already changing screen
        if (this.isChangingScreen) return;
        this.isChangingScreen = true;

        //Close current screen
        const closed = this.currentScreen?.close() || true;
        if (!closed) {
            this.isChangingScreen = false;
            return;
        }

        //Hide page
        elements.contentPage.setAttribute('hidden', '');
        const timeout = this.currentScreen == null ? 0 : 250;
        setTimeout(() => {
            //Open new screen
            elements.contentPage.innerHTML = screen.render();
            screen.open();
            this._currentScreen = screen;

            //Finish changing screen
            elements.contentPage.removeAttribute('hidden');
            this.isChangingScreen = false;
        }, timeout);
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

    constructor() {
        //Init app
        this.initWindow();
        this.initToolbar();

        //Init screens
        this._homeScreen
        this._settingsScreen
        this.open(this.homeScreen);
    }

}
