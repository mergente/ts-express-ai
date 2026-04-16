---
paths:
  - "src/models/**/*.ts"
---


## Key Pattern: One File Per Provider

Each AI SDK gets its own file in `src/models/`. The file initializes the client once at module scope, exports named async functions, and does nothing else. No Express logic belongs inside model files.

```
src/models/
  gemini.ts       → @google/generative-ai
  openai.ts       → openai
  huggingface.ts  → @huggingface/inference
  replicate.ts    → replicate
```

**Key rules:**
- When adding a new AI provider, create `src/models/<provider>.ts` — do not add provider logic to `index.ts`.
- Each model file exports only named async functions (no default exports).
- Client initialization (`new GoogleGenerativeAI(...)`, `new OpenAI({})`, etc.) happens at module scope, not inside functions.
- Add a `README.md` entry to `src/models/README.md` documenting the model name, capability, and any known limitations.

### Files to explore
- @src/models/gemini.ts
- @src/models/openai.ts
- @src/models/huggingface.ts
- @src/models/replicate.ts
- @src/models/README.md

---

## Key Pattern: Gemini Text and Streaming

Gemini is used exclusively for text generation and prompt rephrasing — not image generation. The module exposes both a streaming variant (returns the raw stream for SSE) and a non-streaming variant (returns the full response string). The model is initialized once with `gemini-1.5-flash`.

```typescript
const genAI = new GoogleGenerativeAI(GEMINI_TOKEN)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// Streaming — return the stream, let the caller iterate it
async function makeImagePrompt(userPrompt: string) {
    const { stream } = await model.generateContentStream(prompt)
    return stream;
}

// Non-streaming — await the full response
async function generateText(prompt: string) {
    const result = await model.generateContent(prompt)
    return result.response.text()
}
```

**Key rules:**
- Use `generateContentStream` and return the stream object when the route needs to SSE-stream chunks to the browser.
- Use `generateContent` and return `result.response.text()` for single-shot text tasks.
- `makeImagePrompt` prepends the module-level `starterPrompt` — do not duplicate that instruction in the route handler.
- Gemini cannot generate images; route image generation requests to OpenAI, HuggingFace, or Replicate.
- Check `chunk.candidates` and `chunk.candidates[0].finishReason === 'STOP'` before treating a chunk as the final one.

### Files to explore
- @src/models/gemini.ts
- @src/index.ts

---

## Key Pattern: OpenAI Chat and Image

The OpenAI module provides two separate functions: `makePrompt` for chat completions (GPT-4o-mini) and `makeImage` for image generation (DALL-E 3). The client is initialized with `new OpenAI({})` — API key is picked up automatically from `OPENAI_API_KEY` in the environment.

```typescript
const openai = new OpenAI({})

// Chat — returns a streaming chat completion
async function makePrompt(userInput: string) {
    const chatStream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userInput }
        ],
        stream: true,
        stream_options: { "include_usage": true },
    })
    return chatStream;
}

// Image — returns the URL string from DALL-E
async function makeImage(prompt: string) {
    const response = await openai.images.generate({
        model: 'dall-e-3',
        n: 1,
        prompt,
    })
    return response.data[0].url
}
```

**Key rules:**
- `new OpenAI({})` with an empty options object — the SDK reads `OPENAI_API_KEY` from the environment automatically.
- Always include both `stream: true` and `stream_options: { "include_usage": true }` for streaming chat completions.
- `makeImage` returns `response.data[0].url` — a string. The route renders this directly as `imgUrl`.
- The system prompt for `makePrompt` instructs the model to use the input AS-IS to prevent DALL-E's built-in prompt revision from double-processing it.
- Export `openai` as a named export so it can be reused by future functions in the same file.

### Files to explore
- @src/models/openai.ts

---

## Key Pattern: Hugging Face Image — Blob to Disk

Hugging Face returns a `Blob` that must be manually converted to a `Buffer` and written to `src/public/assets/images/`. The file is saved with a timestamp suffix to avoid collisions. The function returns an object `{ imgUrl, altText }` — not the raw blob.

```typescript
async function hfImage(prompt: string) {
    const imgReq = await hf.textToImage({
        model: model_stable,
        inputs: prompt,
    })

    const blob = imgReq as Blob;
    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    await storeImage(blob, `hf-image-stable_${timestamp}.jpg`)

    return {
        imgUrl: `/assets/images/hf-image-stable_${timestamp}.jpg`,
        altText: prompt
    }
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer);
}

async function storeImage(blob: Blob, filename: string) {
    const imageRoot = path.join(__dirname, '..', 'public', 'assets', 'images')
    const buffer = await blobToBuffer(blob)
    fs.createWriteStream(path.join(imageRoot, filename)).write(buffer)
}
```

**Key rules:**
- Cast the `textToImage` response to `Blob` explicitly — the SDK types it loosely.
- Use `blobToBuffer` (the module-internal helper) for the Blob → Buffer conversion; do not inline the `arrayBuffer()` call.
- Timestamp format: `new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]` — keep consistent for predictable filenames.
- The returned `imgUrl` path must be relative to `public/` (i.e., starts with `/assets/`) so it resolves as a static asset.
- `storeImage` resolves the image root with `path.join(__dirname, '..', 'public', 'assets', 'images')` — maintain this relative path.

### Files to explore
- @src/models/huggingface.ts

---

## Key Pattern: Replicate Run API

Replicate runs models by their version-pinned identifier string. Model IDs include the full SHA of the version. Parameters are passed inside an `input` object. The function returns whatever the model returns (array of URLs for images).

```typescript
const IMG_MODEL = 'adirik/flux-cinestill:216a43b9975de...'

const replicateImage = async (prompt: string) => {
    return await replicate.run(
        IMG_MODEL,
        {
            input: {
                model: "dev",
                prompt,
                lora_scale: 0.6,
                num_outputs: 1,
                aspect_ratio: "1:1",
                output_format: "webp",
                // ...
            }
        }
    )
}
```

**Key rules:**
- Pin model identifiers to a specific SHA version string — never use a floating `latest` tag.
- Store model identifiers as module-level `const` strings in SCREAMING_SNAKE_CASE (e.g., `IMG_MODEL`, `VIDEO_MODEL`).
- Use arrow function syntax for Replicate wrappers (consistent with existing `replicateImage` and `replicateVideo`).
- The route accesses `image[0]` (first element of the returned array) for the image URL — account for this when adding new Replicate model wrappers.
- `auth` is passed via `process.env.REPLICATE_API_TOKEN` directly in the constructor — the SDK accepts `string | undefined`.

### Files to explore
- @src/models/replicate.ts
- @src/index.ts

---

## Key Pattern: Model Constants at Module Scope

Model name strings and configuration constants live at the top of each file, outside any function. This makes them easy to update and clearly documents which model version is in use.

```typescript
// gemini.ts
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// huggingface.ts
const model_stable = 'stabilityai/stable-diffusion-3-medium-diffusers'

// replicate.ts
const IMG_MODEL = 'adirik/flux-cinestill:216a43b9975de9768114644bbf8cd0cba54a923c6d0f65adceaccfc9383a938f'
const VIDEO_MODEL = 'cjwbw/videocrafter:02edcff3e9d2d11dcc27e530773d988df25462b1ee93ed0257b6f246de4797c8'
```

**Key rules:**
- Model name strings are always module-level constants — never hardcoded inside function bodies.
- Naming convention: `model_<variant>` (snake_case) for HuggingFace, `SCREAMING_SNAKE_CASE` for Replicate version-pinned strings.

---

## Key Pattern: System Prompts as Module Constants

Multi-line system prompt strings are defined as module-level `const` using template literals. They are referenced inside the function that uses them, not inlined into the API call.

```typescript
const starterPrompt = `
    You are an expert in prompt crafting.
    Use the text input to craft a detailed prompt for image generation.
    Keep the prompt length under 900 characters: `

async function makeImagePrompt(userPrompt: string) {
    const prompt = `
        ${starterPrompt}
        ${userPrompt}
    `
    // use prompt
}
```

**Key rules:**
- System prompts are `const` at module scope, not embedded inside function calls.
- Compose the final prompt inside the function by interpolating `starterPrompt` + `userPrompt` — keeps the base instructions separate from user input.
- OpenAI system prompts go in the `messages[0].content` field with `role: 'system'`.
- Gemini system prompts are prepended to the user prompt as a single string (the SDK does not have a separate system-role concept in this version).
