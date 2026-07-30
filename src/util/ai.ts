import {
    Florence2ForConditionalGeneration,
    AutoProcessor,
    Tensor,
    Florence2Processor,
    RawImage,
    PreTrainedModel
} from '@huggingface/transformers';

export class DescriptionModel {

    private modelId: string = 'onnx-community/Florence-2-large-ft';
    private processor: Florence2Processor | null = null;
    private model: PreTrainedModel | null = null;

    async load(): Promise<void> {
        //Check if already loaded
        if (this.processor && this.model) return;

        //Load processor & model
        console.log('Loading description model...');
        this.processor = (await AutoProcessor.from_pretrained(this.modelId)) as Florence2Processor;
        this.model = await Florence2ForConditionalGeneration.from_pretrained(
            this.modelId, 
            {
                device: "webgpu",
                dtype: {
                    embed_tokens: "fp16",
                    vision_encoder: "fp16",
                    encoder_model: "q4",
                    decoder_model_merged: "q4",
                }
            }
        );
    }

    async unload(): Promise<void> {
        //Unload processor & model
        if (this.model) {
            await this.model.dispose();
            this.model = null;
        }
        if (this.processor) {
            this.processor = null;
        }
    }

    async run(image: RawImage, taskPrompt: string): Promise<any> {
        //Load model
        await this.load();

        //Process inputs
        const prompts = this.processor!.construct_prompts(taskPrompt);
        const inputs = await this.processor!(image, prompts);

        //Generate output
        const generatedIds = (await this.model!.generate({
            ...inputs,
            max_new_tokens: 1024,
            num_beams: 3,
        })) as Tensor;

        //Decode output
        const generatedText = this.processor!.batch_decode(generatedIds, {
            skip_special_tokens: false,
        })[0];

        //Parse task-specific response
        return this.processor!.post_process_generation(
            generatedText,
            taskPrompt,
            image.size
        );
    }

    async generateCaption(image: RawImage): Promise<string> {
        const task = '<MORE_DETAILED_CAPTION>';
        const result = await this.run(image, task);
        return (result[task] ?? "").trim();
    }

    async generateLabels(image: RawImage): Promise<string[]> {
        const task = '<OD>';
        const result = await this.run(image, task);
        const labels: string[] = result[task]?.labels ?? [];
        return Array.from(new Set(labels)); //Remove repeated items
    }

    async generateText(image: RawImage): Promise<string[]> {
        const task = '<OCR_WITH_REGION>';
        const result = await this.run(image, task);
        const text: string[] = result[task]?.labels ?? [];
        const textFixed: string[] = text
            .map(text => text.trim())
            .filter(text => text.length > 0);
        return Array.from(new Set(textFixed)); //Remove repeated items
    }

}