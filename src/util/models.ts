import { invoke } from '@tauri-apps/api/core';



 /*$      /$$                 /$$           /$$
| $$$    /$$$                | $$          | $$
| $$$$  /$$$$  /$$$$$$   /$$$$$$$  /$$$$$$ | $$  /$$$$$$$
| $$ $$/$$ $$ /$$__  $$ /$$__  $$ /$$__  $$| $$ /$$_____/
| $$  $$$| $$| $$  \ $$| $$  | $$| $$$$$$$$| $$|  $$$$$$
| $$\  $ | $$| $$  | $$| $$  | $$| $$_____/| $$ \____  $$
| $$ \/  | $$|  $$$$$$/|  $$$$$$$|  $$$$$$$| $$ /$$$$$$$/
|__/     |__/ \______/  \_______/ \_______/|__/|______*/

export class MachineLearning {

    static async loadDescriptionModel(): Promise<void> {
        await invoke('load_description_model');
    }

    static async unloadDescriptionModel(): Promise<void> {
        await invoke('unload_description_model');
    }

    static async processImage(imagePath: string, caption: boolean, labels: boolean, text: boolean): Promise<any> {
        const result = (await invoke<string>('process_image', { imagePath, caption, labels, text }));
        return JSON.parse(result);
    }

    static async generateCaption(imagePath: string): Promise<string> {
        const result = await this.processImage(imagePath, true, false, false);
        const caption = result['caption'];
        return (typeof caption === 'string' ? caption.trim() : '');
    }

    static async generateLabels(imagePath: string): Promise<string[]> {
        const result = await this.processImage(imagePath, false, true, false);
        const labels = result['labels'];
        return (Array.isArray(labels) ? labels : []);
    }

    static async generateText(imagePath: string): Promise<string[]> {
        const result = await this.processImage(imagePath, false, false, true);
        const text = result['text'];
        return (Array.isArray(text) ? text : []);
    }

    static async loadEmbeddingsModel(): Promise<void> {
        await invoke('load_embeddings_model');
    }

    static async unloadEmbeddingsModel(): Promise<void> {
        await invoke('unload_embeddings_model');
    }

    static async generateEmbedding(text: string): Promise<number[]> {
        const result = (await invoke<string>('generate_embedding', { text }));
        return JSON.parse(result);
    }

    static async shutdownServer(): Promise<void> {
        await invoke('shutdown_metadata_server');
    }

}
