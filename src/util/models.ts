import { invoke } from '@tauri-apps/api/core';



 /*$      /$$                 /$$           /$$
| $$$    /$$$                | $$          | $$
| $$$$  /$$$$  /$$$$$$   /$$$$$$$  /$$$$$$ | $$  /$$$$$$$
| $$ $$/$$ $$ /$$__  $$ /$$__  $$ /$$__  $$| $$ /$$_____/
| $$  $$$| $$| $$  \ $$| $$  | $$| $$$$$$$$| $$|  $$$$$$
| $$\  $ | $$| $$  | $$| $$  | $$| $$_____/| $$ \____  $$
| $$ \/  | $$|  $$$$$$/|  $$$$$$$|  $$$$$$$| $$ /$$$$$$$/
|__/     |__/ \______/  \_______/ \_______/|__/|______*/

export class DescriptionModel {

    async load(): Promise<void> {
        await invoke('load_description_model');
    }

    async unload(): Promise<void> {
        await invoke('unload_description_model');
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

export class EmbeddingsModel {

    async load(): Promise<void> {
        await invoke('load_embeddings_model');
    }

    async unload(): Promise<void> {
        await invoke('unload_embeddings_model');
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const result = (await invoke<string>('generate_embedding', { text }));
        return JSON.parse(result);
    }

}