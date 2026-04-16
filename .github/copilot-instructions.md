# Copilot Instructions for ts-express-ai

## Project Context

A TypeScript + Express generative AI exploration app. Users submit a text prompt that is rephrased by Google Gemini (streamed via SSE) and then sent to one of three image-generation backends (OpenAI DALL-E, Hugging Face Stable Diffusion, or Replicate Flux). The UI is rendered server-side with Twig templates and wired with HTMx for partial updates and vanilla JS for SSE handling.

Key areas:
- `src/index.ts` — Express app bootstrap, all routes, middleware registration
- `src/models/` — One file per AI provider (gemini, openai, huggingface, replicate)
- `src/views/` — Twig templates: `base.twig` (full page), `partials/` (HTMx swap fragments)
- `src/public/js/` — Vanilla JS SSE client (`events.js`)
- `src/public/css/` — BEM-ish CSS with native nesting (`main.css`, `media-queries.css`)

## Code Review Rules

### TypeScript

- Flag any use of `any` that is not accompanied by an explanatory inline comment. The established pattern is `let image: any; // return type varies across model functions`.
- Flag `require()` — all imports must use ES module `import` syntax.
- Flag Node built-in imports that do not use the `node:` protocol (e.g., `import fs from 'fs'` should be `import fs from 'node:fs'`).
- Flag `process.env.VAR` used inline inside function bodies or constructor calls — all env vars must be read into a named module-level `const` first.
- Flag any file that reads `process.env` but does not have `import 'dotenv/config'` as its first import.
- Flag loosening or disabling of `strict`, `noImplicitAny`, or `strictNullChecks` in `tsconfig.json`.
- Flag query parameters (`req.query.*`) passed to model functions without a `typeof param === 'string'` guard.

For detailed rules, see `.github/instructions/typescript-express.instructions.md`.

### AI Models

- Flag any AI provider logic (client instantiation, API calls, prompt strings) added directly to `src/index.ts` — all provider code must live in `src/models/<provider>.ts`.
- Flag default exports from model files — all exports must be named.
- Flag client initialization (`new GoogleGenerativeAI(...)`, `new OpenAI({})`, etc.) inside function bodies — clients must be initialized at module scope.
- Flag hardcoded model name strings inside function bodies — model identifiers must be module-level constants.
- Flag Replicate model identifiers that do not include a full SHA version string (floating `latest` tags are not allowed).
- Flag system prompt strings defined inside API call arguments — they must be module-level `const` values.
- Flag Gemini being used for image generation — Gemini handles text and streaming only.

For detailed rules, see `.github/instructions/ai-models.instructions.md`.

### Frontend (Twig, HTMx, CSS, JS)

- Flag Twig partial files that include `<html>`, `<head>`, or `<body>` tags — partials must output HTML fragments only.
- Flag asset paths in Twig templates that do not use the established mount aliases (`pico/`, `htmx/`, `css/`, `js/`, `svg/`).
- Flag `<script>` tags placed in `<head>` — `js/events.js` must be loaded at the bottom of `<body>`.
- Flag HTMx buttons that are missing `hx-include="#prompt-form"` when they need to submit form data.
- Flag HTMx indicator elements that are not using the `htmx-indicator` class for visibility toggling.
- Flag hardcoded `512px` dimension values — use `var(--img-dim)` instead.
- Flag CSS added to `main.css` that should be in `media-queries.css` (i.e., inside `@media` blocks).
- Flag SSE client code that does not call `e.preventDefault()` on the form submit event before opening `EventSource`.
- Flag SSE event handlers that do not parse `event.data` as JSON before reading properties.
- Flag SSE chunk accumulation using `=` instead of `+=` on the result element's `innerHTML`.

For detailed rules, see `.github/instructions/frontend.instructions.md`.

### Security

- Flag hardcoded API keys, tokens, or secrets in any file. All credentials must come from `process.env` and be listed in `.env.example` with placeholder values.
- Flag `.env` files committed to the repository — `.env` must remain in `.gitignore`.
- Flag `innerHTML` assignments that use unescaped user-supplied strings. The SSE `promptResult.innerHTML += data.promptResponse` pattern is acceptable only because the content originates from the AI model response, not raw user input.
- Flag `process.env.VAR` used directly as an argument to a constructor or function call without being assigned to a named const first — this obscures which key is being used and makes rotation harder.
