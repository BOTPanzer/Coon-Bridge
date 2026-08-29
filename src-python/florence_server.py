import os
from PIL import ImageFile



#  /$$      /$$                 /$$           /$$
# | $$$    /$$$                | $$          | $$
# | $$$$  /$$$$  /$$$$$$   /$$$$$$$  /$$$$$$ | $$
# | $$ $$/$$ $$ /$$__  $$ /$$__  $$ /$$__  $$| $$
# | $$  $$$| $$| $$  \ $$| $$  | $$| $$$$$$$$| $$
# | $$\  $ | $$| $$  | $$| $$  | $$| $$_____/| $$
# | $$ \/  | $$|  $$$$$$/|  $$$$$$$|  $$$$$$$| $$
# |__/     |__/ \______/  \_______/ \_______/|__/

class DescriptionModel:

    def __init__(self):
        self.model = None
        self.processor = None
        self.device = None
        self.torch_dtype = None

    # Load/unload
    def load(self):
        # Import libraries
        import torch
        from transformers import AutoProcessor, AutoModelForCausalLM

        # Select device
        if torch.cuda.is_available():
            self.device = 'cuda:0'
            self.torch_dtype = torch.float32 #float16
        else:
            self.device = 'cpu'
            self.torch_dtype = torch.float32

        # Load model
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, 'florence2')
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path, 
            torch_dtype=self.torch_dtype, 
            trust_remote_code=True,
            use_safetensors=True,
            tie_word_embeddings=False
        ).to(self.device)

        # Manually tie lm_head weight to the language model embeddings
        if hasattr(self.model, 'language_model'):
            lm = self.model.language_model
            if hasattr(lm, 'lm_head') and hasattr(lm, 'model') and hasattr(lm.model, 'shared'):
                lm.lm_head.weight = lm.model.shared.weight
        self.processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)

    def unload(self):
        # Import libraries
        import torch
        import gc

        # Unload model
        self.model = None
        self.processor = None

        # Free memory
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    # Generation
    def run(self, image: ImageFile, prompt: str) -> str:
        # Model not loaded
        if not self.model or not self.processor:
            raise RuntimeError("Model is not loaded!")

        # Run prompt
        inputs = self.processor(text=prompt, images=image, return_tensors='pt').to(self.device, self.torch_dtype)
        generated_ids = self.model.generate(
            input_ids=inputs['input_ids'],
            pixel_values=inputs['pixel_values'],
            max_new_tokens=1024,
            num_beams=3
        )
        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)
        generated_text = generated_text[0]
        parsed_answer = self.processor.post_process_generation(generated_text, task=prompt, image_size=(image.width, image.height))
        return parsed_answer[prompt]

    def generate_caption(self, image: ImageFile) -> str:
        result = self.run(image, '<MORE_DETAILED_CAPTION>') # <CAPTION> <DETAILED_CAPTION> <MORE_DETAILED_CAPTION>
        return result.strip()

    def generate_labels(self, image: ImageFile) -> list[str]:
        result = self.run(image, '<OD>')['labels']
        return list(set(result)) # list(set()) remove repeated items

    def detect_text(self, image: ImageFile) -> list[str]:
        result = self.run(image, '<OCR_WITH_REGION>')
        labels = result.get('labels', []) if isinstance(result, dict) else []
        text_fixed = [t.replace('</s>', '').replace('<s>', '').strip() for t in labels if t and t.strip()] # Remove leftover tokens
        return list(set(text_fixed)) # Remove repeated items

    def process_image(self, image: ImageFile, get_caption: bool = True, get_labels: bool = True, get_text: bool = True) -> dict:
        results = {}
        if get_caption:
            results["caption"] = self.generate_caption(image)
        if get_labels:
            results["labels"] = self.generate_labels(image)
        if get_text:
            results["text"] = self.detect_text(image)
        return results



#   /$$$$$$
#  /$$__  $$
# | $$  \__/  /$$$$$$   /$$$$$$  /$$    /$$ /$$$$$$   /$$$$$$
# |  $$$$$$  /$$__  $$ /$$__  $$|  $$  /$$//$$__  $$ /$$__  $$
#  \____  $$| $$$$$$$$| $$  \__/ \  $$/$$/| $$$$$$$$| $$  \__/
#  /$$  \ $$| $$_____/| $$        \  $$$/ | $$_____/| $$
# |  $$$$$$/|  $$$$$$$| $$         \  $/  |  $$$$$$$| $$
#  \______/  \_______/|__/          \_/    \_______/|__/

# Logging to file
def log(text: str):
    with open("python_debug.log", "a", encoding="utf-8") as f:
        f.write(text)

# Last image cache
last_image_cache = {
    "path": None,
    "data": None
}

# App
if __name__ == "__main__":

    # Import libraries
    import sys
    import json
    from PIL import Image

    # Initialize model once
    model = DescriptionModel()
    print("READY", flush=True)

    # Listen for commands from Rust
    for line in sys.stdin:
        try:
            # Get command
            req = json.loads(line.strip())
            cmd = req.get("command")

            # Check command
            if cmd == "load":
                # Load model
                model.load()
                print(json.dumps({"status": "ok"}), flush=True)
            elif cmd == "unload":
                # Unload model
                model.unload()
                print(json.dumps({"status": "ok"}), flush=True)
            elif cmd == "process":
                # Prepare image
                image_path = req["image_path"]
                image_data = None
                if (last_image_cache["path"] == image_path):
                    # Load image from last image cache
                    image_data = last_image_cache["data"]
                else:
                    # Load image as new
                    ImageFile.LOAD_TRUNCATED_IMAGES = True
                    image_data = Image.open(image_path).convert("RGB")
                    last_image_cache["path"] = image_path
                    last_image_cache["data"] = image_data

                # Check what to process
                get_cap = req.get("caption", True)
                get_lbl = req.get("labels", True)
                get_txt = req.get("text", True)

                # Process image
                res = model.process_image(image_data, get_caption=get_cap, get_labels=get_lbl, get_text=get_txt)
                print(json.dumps({"status": "ok", "result": res}), flush=True)
            else:
                # Error
                print(json.dumps({"status": "error", "message": "Unknown command"}), flush=True)
        except Exception as e:
            # Error
            print(json.dumps({"status": "error", "message": str(e)}), flush=True)
