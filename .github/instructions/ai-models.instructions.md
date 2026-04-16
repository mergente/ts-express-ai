---
applyTo: "src/models/**/*.ts"
---

# AI Models Standards

## One File Per Provider

### ENFORCE: All AI provider logic lives in `src/models/<provider>.ts`

```
src/models/
  gemini.ts       → @google/generative-ai
  openai.ts       → openai
  huggingface.ts  → @huggingface/inference
  replicate.ts    → replicate
```

### FLAG FOR REVIEW: AI provider code added to `src/index.ts`

```typescript
// WRONG — provider logic in the route file
app.post('/make-image', async (req, res) => {
    const openai = new OpenAI({});
    const response = await openai.images.generate({ ... });
})

// CORRECT — provider logic in src/models/openai.ts, imported into index.ts
import { makeImage } from './models/openai'
app.post('/make-image', async (req, res) => {
    const image = await makeImage(req.body.promptRephrase);
})
```

### ENFORCE: Named exports only — no default exports from model files

```typescript
// CORRECT
export { openai, makePrompt, makeImage }
export { hfImage }
export { replicateImage, replicateVideo }

// WRONG
export default makeImage
```

---

## Client Initialization at Module Scope

### ENFORCE: Clients initialized once at module scope, not inside functions

```typescript
// CORRECT
const openai = new OpenAI({})
const genAI = new GoogleGenerativeAI(GEMINI_TOKEN)
const hf = new HfInference(HF_API_TOKEN)
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

async function makeImage(prompt: string) {
    // use the already-initialized client
    return await openai.images.generate({ ... })
}
```

### FLAG FOR REVIEW: Client created inside a function body

```typescript
// WRONG — creates a new client on every call
async function makeImage(prompt: string) {
    const openai = new OpenAI({});
    return await openai.images.generate({ ... });
}
```

---

## Model Constants at Module Scope

### ENFORCE: Model name strings as module-level constants, never hardcoded inside function calls

```typescript
// CORRECT — gemini.ts
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// CORRECT — huggingface.ts (snake_case for HuggingFace model variants)
const model_stable = 'stabilityai/stable-diffusion-3-medium-diffusers'

// CORRECT — replicate.ts (SCREAMING_SNAKE_CASE for version-pinned strings)
const IMG_MODEL = 'adirik/flux-cinestill:216a43b9975de9768114644bbf8cd0cba54a923c6d0f65adceaccfc9383a938f'
const VIDEO_MODEL = 'cjwbw/videocrafter:02edcff3e9d2d11dcc27e530773d988df25462b1ee93ed0257b6f246de4797c8'
```

### FLAG FOR REVIEW: Model string hardcoded inside a function or API call

```typescript
// WRONG
async function makeImage(prompt: string) {
    return await openai.images.generate({
        model: 'dall-e-3',  // should be a module-level const
        ...
    })
}
```

---

## Replicate Version Pinning

### ENFORCE: Replicate model identifiers must include a full SHA version string

```typescript
// CORRECT — SHA pinned
const IMG_MODEL = 'adirik/flux-cinestill:216a43b9975de9768114644bbf8cd0cba54a923c6d0f65adceaccfc9383a938f'

// WRONG — floating reference
const IMG_MODEL = 'adirik/flux-cinestill:latest'
const IMG_MODEL = 'adirik/flux-cinestill'
```

### ENFORCE: Arrow function syntax for Replicate wrapper functions

```typescript
// CORRECT
const replicateImage = async (prompt: string) => {
    return await replicate.run(IMG_MODEL, { input: { prompt, ... } })
}

// WRONG — function declaration syntax breaks the convention
async function replicateImage(prompt: string) { ... }
```

---

## System Prompts as Module Constants

### ENFORCE: System prompts defined as module-level `const`, not embedded in API call arguments

```typescript
// CORRECT — gemini.ts
const starterPrompt = `
    You are an expert in prompt crafting.
    Use the text input to craft a detailed prompt for image generation.
    Keep the prompt length under 900 characters: `

async function makeImagePrompt(userPrompt: string) {
    const prompt = `${starterPrompt} ${userPrompt}`
    const { stream } = await model.generateContentStream(prompt)
    return stream;
}
```

### FLAG FOR REVIEW: Prompt string inlined directly in the API call

```typescript
// WRONG — prompt instruction is buried inside the call
const result = await model.generateContent(`
    You are an expert in prompt crafting. ${userPrompt}
`)
```

### ENFORCE: OpenAI system prompts use the `role: 'system'` message slot

```typescript
// CORRECT
messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userInput }
]
```

---

## Gemini Text and Streaming

### ENFORCE: Use `generateContentStream` when the route needs to SSE-stream chunks

```typescript
// CORRECT — streaming variant returns the stream object
async function makeImagePrompt(userPrompt: string) {
    const { stream } = await model.generateContentStream(prompt)
    return stream;
}
```

### FLAG FOR REVIEW: Gemini used for image generation

Gemini (`@google/generative-ai`) handles text generation and prompt rephrasing only. It cannot generate images. Route image generation to `openai.ts` (DALL-E 3), `huggingface.ts` (Stable Diffusion), or `replicate.ts` (Flux Cinestill).

### ENFORCE: Check `chunk.candidates` before treating a chunk as final

```typescript
// CORRECT
for await (const chunk of promptStream) {
    if (chunk.candidates) {
        if (chunk.candidates[0].finishReason === 'STOP') {
            // final chunk handling
        }
        sendEvent({ promptResponse: chunk.text() });
    }
}
```

---

## OpenAI Chat and Image

### ENFORCE: `new OpenAI({})` with empty options object — SDK reads key from environment automatically

```typescript
// CORRECT
const openai = new OpenAI({})

// WRONG — passing key explicitly (unnecessary and risks accidental exposure)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

### ENFORCE: Streaming chat completions require both `stream: true` and `stream_options`

```typescript
// CORRECT
const chatStream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    stream: true,
    stream_options: { "include_usage": true },
})
```

### ENFORCE: `makeImage` returns `response.data[0].url` — a string

```typescript
// CORRECT — returns the URL string
async function makeImage(prompt: string) {
    const response = await openai.images.generate({ model: 'dall-e-3', n: 1, prompt })
    return response.data[0].url
}
```

---

## Hugging Face — Blob to Disk

### ENFORCE: Explicit cast of `textToImage` response to `Blob`

```typescript
// CORRECT — SDK types the return loosely
const blob = imgReq as Blob;
```

### ENFORCE: Use `blobToBuffer` helper for Blob → Buffer conversion; do not inline `arrayBuffer()`

```typescript
// CORRECT
const buffer = await blobToBuffer(blob)

// WRONG — inlining the conversion
const buffer = Buffer.from(await imgReq.arrayBuffer())
```

### ENFORCE: Timestamp format for HuggingFace image filenames

```typescript
// CORRECT — consistent, filesystem-safe format
const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
await storeImage(blob, `hf-image-stable_${timestamp}.jpg`)
```

### ENFORCE: `imgUrl` paths must start with `/assets/` to resolve as static assets

```typescript
// CORRECT
return { imgUrl: `/assets/images/hf-image-stable_${timestamp}.jpg`, altText: prompt }

// WRONG — absolute filesystem path exposed as URL
return { imgUrl: `/Users/edgarquintanilla/Sites/.../hf-image-stable.jpg` }
```

### ENFORCE: `storeImage` resolves the image root with `path.join(__dirname, '..', 'public', 'assets', 'images')`

```typescript
// CORRECT
const imageRoot = path.join(__dirname, '..', 'public', 'assets', 'images')

// WRONG — hardcoded absolute path
const imageRoot = '/Users/edgarquintanilla/Sites/mergente/ts-express-ai/src/public/assets/images'
```

---

## Code Review Checklist

### ENFORCE:
1. All AI provider logic (client init, API calls, prompts) lives in `src/models/<provider>.ts` — not in `src/index.ts`
2. Named exports only — no `export default` from model files
3. AI clients initialized at module scope, not inside function bodies
4. Model name strings are module-level constants — never hardcoded in function calls
5. Replicate model identifiers include a full SHA version string
6. Arrow function syntax for all Replicate wrapper functions
7. System prompts defined as module-level `const`, not embedded in API calls
8. OpenAI initialized as `new OpenAI({})` with empty options
9. Streaming OpenAI calls include both `stream: true` and `stream_options: { "include_usage": true }`
10. `makeImage` returns `response.data[0].url` (string)
11. HuggingFace `textToImage` response explicitly cast to `Blob`
12. HuggingFace `imgUrl` return value starts with `/assets/` (not a filesystem path)
13. `storeImage` uses `path.join(__dirname, '..', 'public', 'assets', 'images')` for the image root

### FLAG FOR REVIEW:
1. Gemini called for image generation — it handles text/streaming only
2. `chunk.candidates` not checked before accessing `finishReason` in Gemini stream loops
3. HuggingFace Blob → Buffer conversion inlined instead of using the `blobToBuffer` helper
4. Replicate model identifier without a SHA pin (floating reference)
5. New provider added without a corresponding file in `src/models/` and entry in `src/models/README.md`
