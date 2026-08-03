import { readFile, readTextFile, writeTextFile, mkdir, exists, rename, stat, remove } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';



 /*$$$$$$$ /$$ /$$
| $$_____/|__/| $$
| $$       /$$| $$  /$$$$$$   /$$$$$$$
| $$$$$   | $$| $$ /$$__  $$ /$$_____/
| $$__/   | $$| $$| $$$$$$$$|  $$$$$$
| $$      | $$| $$| $$_____/ \____  $$
| $$      | $$| $$|  $$$$$$$ /$$$$$$$/
|__/      |__/|__/ \_______/|______*/

export class Files {

    static async readBytes(path: string): Promise<Buffer | null> {
        //Read file
        try {
            return Buffer.from(await readFile(path));
        } catch (e) {
            return null;
        }
    }

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
        const text = await Files.readFile(path);
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
        await Files.saveFile(path, JSON.stringify(content, null, prettify ? 4 : 0));
    }

    static async writeFileWithOffset(path: string, offset: number, buffer: Uint8Array) {
        //Save file
        try {
            await invoke('write_file_at_offset', { path, offset, data: Array.from(buffer) });
        } catch (e) {
            console.error(e);
        }
    }

    static async exists(path: string): Promise<boolean> {
        return await exists(path);
    }

    static async rename(oldPath: string, newPath: string) {
        await rename(oldPath, newPath);
    }

    static async remove(path: string) {
        await remove(path);
    }

    static async createFolder(path: string) {
        await mkdir(path, { recursive: true });
    }

    static async getLastModified(path: string): Promise<number> {
        return (await stat(path)).mtime!.getTime();
    }

    static async setLastModified(path: string, lastModified: number): Promise<void> {
        return await invoke('set_last_modified', { path, lastModified });
    }

    static async join(path1: string, path2: string): Promise<string> {
        return await join(path1, path2);
    }

}