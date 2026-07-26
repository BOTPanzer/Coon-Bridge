import { getCurrentWindow } from '@tauri-apps/api/window'



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
    toolbarClose: document.getElementById('toolbar-close')!
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
    window = getCurrentWindow()

    //Init
    initWindow = () => {
        //Prevent flashbang while loading
        window.onload = () => {
            //Show window after it loads
            this.window.show()
        }

        //Prevent closing
        this.window.onCloseRequested(async (e) => {
            //Intercept
            e.preventDefault()

            //Check for sync in progress
            const proceed = true//await checkUnsavedChanges()
            if (proceed) this.window.destroy()
        })
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
        this.initWindow()
        this.initToolbar()
    }

}
