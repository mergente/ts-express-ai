import 'dotenv/config'
import { HfInference } from "@huggingface/inference"
import fs from 'node:fs'
import path from 'node:path';

const HF_API_TOKEN = process.env.HF_API_TOKEN

const hf = new HfInference(HF_API_TOKEN)
// const model_flux = 'black-forest-labs/FLUX.1-dev'
const model_stable = 'stabilityai/stable-diffusion-3-medium-diffusers'

// Text-to-image
/**
 * Converts a text prompt to an image using the Hugging Face API.
 * 
 * Hugging Face leaves it to the developer to decide how to process the response.
 * In this case, we are saving the image to the public/assets/images directory
 * but only after we convert the response blob to a buffer and then write it to the file system.
 * 
 * @param prompt - The text prompt to convert to an image.
 * @returns A Promise that resolves to a Blob response containing the converted image.
 */
async function hfImage(prompt: string) {
    console.log('====HF IMAGE====');
    const imgReq = await hf.textToImage({
        model: model_stable,
        inputs: prompt,
    })
    console.log('imgReq', imgReq);

    const blob = imgReq as Blob;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    await storeImage(blob, `hf-image-stable_${timestamp}.jpg`)
    return { imgUrl: `/assets/images/hf-image-stable_${timestamp}.jpg`, altText: prompt }
}
/**
 * Converts a Blob to a Buffer.
 * @param blob {Blob}
 * @returns 
 */
async function blobToBuffer(blob: Blob) : Promise<Buffer> {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer);
}
/**
 * Streams a Blob to a file.
 * @param blob 
 * @param filename 
 */
async function storeImage(blob: Blob, filename: string) {
    const imageRoot = path.join(__dirname, '..', 'public', 'assets', 'images')
    const buffer = await blobToBuffer(blob)
    // get the imageRoot, save the buffer to the file system, and return the path once done
    fs.createWriteStream(path.join(imageRoot, filename)).write(buffer)
}

export { hfImage }