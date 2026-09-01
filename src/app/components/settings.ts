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
export interface MetadataTypes {
    captions: boolean;
    labels: boolean;
    text: boolean;
    embeddings: boolean;
}

export interface AppSettings {
    links: Link[];
    syncIgnoreDeletedItems: boolean;
    metadataIgnoredTypes: MetadataTypes;
}

//Settings file
const settingsPath = await join(await appDataDir(), 'settings.json');

export async function loadSettings(): Promise<AppSettings> {
    //Read file
    const settings: AppSettings = await Files.readJSON(settingsPath) as AppSettings;
    let wereSettingsFixed = false;

    //Fix links
    if (!Array.isArray(settings.links)) {
        //Reset links
        settings.links = []
        wereSettingsFixed = true;
    } else {
        //Fix invalid links
        for (let i = settings.links.length - 1; i >= 0; i--) {
            const link = settings.links[i];
            if (typeof link.albumFolder !== 'string' || typeof link.metadataFile !== 'string') {
                settings.links.splice(i, 1);
                wereSettingsFixed = true;
            }
        }
    }

    //Fix metadata settings
    if (typeof settings.metadataIgnoredTypes !== 'object') {
        //Reset generation types
        settings.metadataIgnoredTypes = { captions: false, labels: false, text: false, embeddings: false }
        wereSettingsFixed = true;
    } else {
        //Fix invalid values
        if (typeof settings.metadataIgnoredTypes.captions !== 'boolean') {
            settings.metadataIgnoredTypes.captions = false;
            wereSettingsFixed = true;
        }
        if (typeof settings.metadataIgnoredTypes.labels !== 'boolean') {
            settings.metadataIgnoredTypes.labels = false;
            wereSettingsFixed = true;
        }
        if (typeof settings.metadataIgnoredTypes.text !== 'boolean') {
            settings.metadataIgnoredTypes.text = false;
            wereSettingsFixed = true;
        }
        if (typeof settings.metadataIgnoredTypes.embeddings !== 'boolean') {
            settings.metadataIgnoredTypes.embeddings = false;
            wereSettingsFixed = true;
        }
    }

    //Fix sync settings
    if (typeof settings.syncIgnoreDeletedItems !== 'boolean') {
        //Reset sync ignore deleted items
        settings.syncIgnoreDeletedItems = true
        wereSettingsFixed = true;
    }

    //Check if settings were fixed
    if (wereSettingsFixed) {
        //Save to disk
        await Files.saveJSON(settingsPath, settings);
    }

    //Return settings
    return settings;
}

export async function saveSettings(settings: AppSettings) {
    //Save settings
    await Files.saveJSON(settingsPath, settings)
}