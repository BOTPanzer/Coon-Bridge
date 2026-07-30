import { readTextFile, writeTextFile, mkdir, exists, rename } from '@tauri-apps/plugin-fs';
import { dirname } from '@tauri-apps/api/path';



 /*$   /$$   /$$     /$$ /$$
| $$  | $$  | $$    |__/| $$
| $$  | $$ /$$$$$$   /$$| $$
| $$  | $$|_  $$_/  | $$| $$
| $$  | $$  | $$    | $$| $$
| $$  | $$  | $$ /$$| $$| $$
|  $$$$$$/  |  $$$$/| $$| $$
 \______/    \___/  |__/|_*/

export class Util {

    //Math
    static clamp(x: number, min: number, max: number) {
        //Clamp x between min and max
        return Math.min(Math.max(x, min), max);
    }

    static randomInt(min: number, max: number) {
        //Get a random int between min and max
        return Math.floor(Math.random() * (max - min)) + min;
    }

    //Lists
    static shuffleList<T>(list: T[]) {
        for (let i = list.length - 1; i > 0; i--) {
            const randomIndex = Math.floor(Math.random() * (i + 1));
            [list[i], list[randomIndex]] = [list[randomIndex], list[i]];
        }
    }

    static randomFromList<T>(list: T[], remove: boolean = false) {
        const index = Math.floor(Math.random() * list.length);
        const value = list[index];
        if (remove) list.splice(index, 1);
        return value;
    }

    //Events
    static interceptEvent(e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    static onDialogBackdropClick(dialog: HTMLDialogElement, onClick: Function) {
        //Add on click event
        dialog.onclick = (event) => {
            const rect = dialog.getBoundingClientRect();
            const clickedBackdrop = !(rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
            if (clickedBackdrop && dialog.open) onClick();
        }
    }

    //Text
    static setCharAt(string: string, index: number, char: string) {
        if (index > string.length - 1) return string;
        return string.substring(0, index) + char + string.substring(index + 1);
    }

    //Files
    static async readFile(path: string): Promise<string | null> {
        //Read file
        try {
            return await readTextFile(path);
        } catch (e) {
            return null;
        }
    }

    static async readJSON(path: string): Promise<object> {
        //Read file
        const text = await Util.readFile(path);
        if (!text) return {};

        //Parse JSON
        try {
            return JSON.parse(text);
        } catch (e) {
            return {};
        }
    }

    static async saveFile(path: string, content: string) {
        //Save file
        try {
            const dir = await dirname(path);
            await mkdir(dir, { recursive: true });
            await writeTextFile(path, content);
        } catch (e) {
            console.error(e);
        }
    }

    static async saveJSON(path: string, content: object, prettify: boolean = true) {
        //Save file
        await Util.saveFile(path, JSON.stringify(content, null, prettify ? 4 : 0));
    }

    static async existsFile(path: string): Promise<boolean> {
        return await exists(path);
    }

    static async renameFile(oldPath: string, newPath: string) {
        await rename(oldPath, newPath);
    }

}
