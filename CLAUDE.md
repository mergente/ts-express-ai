# ts-express-ai

## Project Overview

A TypeScript + Express generative AI exploration app. Users submit a text prompt that is rephrased by Google Gemini (streamed via SSE) and then sent to one of three image-generation backends (OpenAI DALL-E, Hugging Face Stable Diffusion, or Replicate Flux). The UI is rendered server-side with Twig templates and wired with HTMx for partial updates and vanilla JS for SSE handling.

## Tech Stack

- **Runtime:** Node.js 20.16.0 (`.nvmrc`)
- **Language:** TypeScript 5.5 (`target: es2016`, `module: commonjs`, `strict: true`)
- **Framework:** Express 4
- **Templating:** Twig 1.17 (`src/views/`)
- **Frontend:** HTMx 2 + PicoCSS 2 (classless) + vanilla JS (`src/public/`)
- **AI SDKs:**
  - `@google/generative-ai` — prompt rephrasing / text generation (Gemini 1.5 Flash)
  - `openai` — chat completions (GPT-4o-mini) and image generation (DALL-E 3)
  - `@huggingface/inference` — text-to-image (Stable Diffusion 3)
  - `replicate` — image generation (Flux Cinestill) and video generation

## Architecture

```
src/
  index.ts          # Express app: middleware, routes, view engine config
  models/           # One file per AI provider SDK
    gemini.ts
    openai.ts
    huggingface.ts
    replicate.ts
  views/
    base.twig       # Full-page layout
    partials/
      generated-image.twig   # HTMx swap target
  public/
    js/events.js    # SSE EventSource + form wiring
    css/main.css    # BEM-ish scoped styles with CSS nesting
    css/media-queries.css
    assets/         # Static images
```

## Key Conventions

- All AI provider logic lives in `src/models/` — one file per provider.
- Routes are defined directly in `src/index.ts` (no separate router files currently).
- Static assets from `node_modules` (PicoCSS, HTMx) are served via `express.static` with explicit `Content-Type` headers.
- Environment variables are loaded via `dotenv/config` at the top of each model file that needs them.
- `npm run dev` uses `nodemon` + `concurrently` to run `tsc --watch` and `ts-node` simultaneously.
- Build output goes to `dist/` (`outDir`); source root is `src/` (`rootDir`).

## Environment Variables

See `.env.example`. Required keys:
- `PORT`
- `OPENAI_API_KEY`
- `REPLICATE_API_TOKEN`
- `HF_API_TOKEN`
- `GEMINI_API_KEY`
