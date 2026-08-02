import { Link, Files } from "../../util";
import { appDataDir, join } from '@tauri-apps/api/path';



  /*$$$$$              /$$     /$$     /$$
 /$$__  $$            | $$    | $$    |__/
| $$  \__/  /$$$$$$  /$$$$$$ /$$$$$$   /$$ /$$$$$$$   /$$$$$$   /$$$$$$$
|  $$$$$$  /$$__  $$|_  $$_/|_  $$_/  | $$| $$__  $$ /$$__  $$ /$$_____/
 \____  $$| $$$$$$$$  | $$    | $$    | $$| $$  \ $$| $$  \ $$|  $$$$$$
 /$$  \ $$| $$_____/  | $$ /$$| $$ /$$| $$| $$  | $$| $$  | $$ \____  $$
|  $$$$$$/|  $$$$$$$  |  $$$$/|  $$$$/| $$| $$  | $$|  $$$$$$$ /$$$$$$$/
 \______/  \_______/   \___/   \___/  |__/|__/  |__/ \____  $$|_______/
                                                     /$$  \ $$
                                                    |  $$$$$$/
                                                     \_____*/

//Interfaces
export interface AppSettings {
    links: Link[];
    syncIgnoreDeletedItems: boolean;
}

//Settings file
const settingsPath = await join(await appDataDir(), 'settings.json');

export async function loadSettings(): Promise<AppSettings> {
    //Read file
    const settings: AppSettings = await Files.readJSON(settingsPath) as AppSettings;

    //Fix settings
    if (!Array.isArray(settings.links)) {
        //Reset links
        settings.links = []
        await Files.saveJSON(settingsPath, settings);
    } else {
        //Fix invalid links
        for (let i = settings.links.length - 1; i >= 0; i--) {
            const link = settings.links[i];
            if (typeof link.albumFolder !== 'string' || typeof link.metadataFile !== 'string') {
                settings.links.splice(i, 1);
                await Files.saveJSON(settingsPath, settings);
            }
        }
    }
    if (typeof settings.syncIgnoreDeletedItems !== 'boolean') {
        //Reset sync ignore deleted items
        settings.syncIgnoreDeletedItems = true
        await Files.saveJSON(settingsPath, settings);
    }

    //Return settings
    return settings;
}

export async function saveSettings(settings: AppSettings) {
    //Save settings
    await Files.saveJSON(settingsPath, settings)
}