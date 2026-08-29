import { invoke } from '@tauri-apps/api/core';



  /*$$$$$  /$$$$$$
 /$$__  $$|_  $$_/
| $$  \ $$  | $$
| $$$$$$$$  | $$
| $$__  $$  | $$
| $$  | $$  | $$
| $$  | $$ /$$$$$$
|__/  |__/|_____*/


export class DescriptionModel {

    private modelPath: string = 'X:/Projects/Web/CoonBridge/models/florence_2';

    async load(): Promise<void> {
        return await invoke('load_model', { modelPath: this.modelPath });
    }

    async unload(): Promise<void> {
        return await invoke('unload_model');
    }

    async processImage(imagePath: string, caption: boolean, labels: boolean, text: boolean): Promise<any> {
        const result = (await invoke<string>('process_image', { imagePath, caption, labels, text }));
        return JSON.parse(result);
    }

    async generateCaption(imagePath: string): Promise<string> {
        const result = await this.processImage(imagePath, true, false, false);
        const caption = result['caption'];
        return (typeof caption === 'string' ? caption.trim() : '');
    }

    async generateLabels(imagePath: string): Promise<string[]> {
        const result = await this.processImage(imagePath, false, true, false);
        const labels = result['labels'];
        return (Array.isArray(labels) ? labels : []);
    }

    async generateText(imagePath: string): Promise<string[]> {
        const result = await this.processImage(imagePath, false, false, true);
        const text = result['text'];
        return (Array.isArray(text) ? text : []);
    }

}
