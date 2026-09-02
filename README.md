# Coon Bridge

Backup your albums and enable smart searching in the [Coon Gallery](https://github.com/BOTPanzer/Coon-Gallery) android app.

![Home screen](https://raw.githubusercontent.com/BOTPanzer/Coon-Bridge/refs/heads/main/screenshots/home.png)

## Features

| **What it does**                                                                          | **How it helps**                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Improve the search** of you android gallery by **generating metadata** for your images. | Is there a cat in a photo? Just search "cat" to find it!                       |
| Simple **in-app albums search**.                                                          | Don't have your phone with you? Use the in-app search to find images directly! |
| **Sync your albums** from your phone to your PC.                                          | Tired of relying on the cloud? Make local backups with just one click!         |
| **Sync your metadata** between devices.                                                   | Modified your metadata somewhere? You can move it from one device to another!  |

## How to run

Choose a version from the [releases page](https://github.com/BOTPanzer/Coon-Bridge/releases) and download the installer or clone the repository and build it yourself.

## How to generate metadata

This app needs Python installed for metadata generation to work. It was tested using **Python 3.13.11**, tho other versions may work:

1. **Installing dependencies**

   You can install them by running:

   `pip install name==version`

   Using other versions may work but these are the ones used while developing the app:

   - transformers (4.53.3)
   - [pytorch](https://pytorch.org/get-started/locally/) (2.9.1, select the best option for your gpu)
   - einops (0.8.1)
   - timm (1.0.24)

2. **Downloading the models**

   The app uses:

   - `Florence2` for generating captions, labels and detecting text.

   - `Paraphrase multilingual MiniLM L12 v2` for generating embeddings.

   You can download them manually from their respective hugging face repos:

   - [Florence2](https://huggingface.co/microsoft/Florence-2-large/tree/main)

   - [Paraphrase multilingual MiniLM L12 v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/tree/main)

3. **Move the model**

   Create a `./python/models/` folder and move the model files inside. It should look like this:

   ```
   Coon-Bridge/
   ├─ python/
   ├─── models/
   ├───── florence2/
   ├─────── model.safetensors
   ├─────── tokenizer.json
   ├─────── ...
   ├───── paraphrase-multilingual-MiniLM-L12-v2/
   ├─────── model.safetensors
   ├─────── tokenizer.json
   └─────── ...
   ```

## How to use

The app is divided into different screens.

### Home screen

This is the screen where you are greeted after opening the app. You can use it to navigate to other screens or exit the app.

![Home screen](https://raw.githubusercontent.com/BOTPanzer/Coon-Bridge/refs/heads/main/screenshots/home.png)

### Settings screen

Here you will be able to change different options of the app and setup *links*, which are connections between an *album folder* and a *metadata file*. 

- Adding an *album folder* will let you use the **sync** screen to backup your albums from your phone to your computer.

- Adding an *album folder* and a *metadata file* will let you use the **metadata** screen to generate information about your images and improve search.

**Note:** links should be in the same order as in the phone app.

![Settings screen](https://raw.githubusercontent.com/BOTPanzer/Coon-Bridge/refs/heads/main/screenshots/settings.png)

### Metadata screen

Here is where you can search and generate information about your images. There are 3 different actions to perform.

- **Search albums:** asks for a text input and searches in your albums to find images that contain it. If you search for "cat", images containing a cat will appear.

- **Clean metadata:** removes information about deleted images. You'll most likely never need to use this.

- **Generate metadata:** generates metadata for all images that don't have it: 

  - A description about the image.

  - A list of labels for things in the image.

  - A list of text detected in the image.

  - An embedding vector to enable "natural language" search in the android app.

![Metadata screen](https://raw.githubusercontent.com/BOTPanzer/Coon-Bridge/refs/heads/main/screenshots/metadata.png)

### Sync screen

The app has a server running in the background so that the phone app can connect to it. This screen lets you perform actions when the phone is connected.

- **Start server:** in case there was a problem, you can try restarting the server from here.

- **Sync albums:** creates a backup of the linked albums from your phone in your computer.

- **Download metadata:** updates the metadata files from your computer with the ones in your phone.

- **Upload metadata:** updates the metadata files from your phone with the ones in your computer.

![Sync screen](https://raw.githubusercontent.com/BOTPanzer/Coon-Bridge/refs/heads/main/screenshots/sync.png)
