---
paths:
  - "src/**/*.ts"
---


## Key Pattern: Strict TypeScript Config

The project runs `strict: true`, `noImplicitAny: true`, and `strictNullChecks: true`. These cannot be loosened. Target is `es2016`, module system is `commonjs`. Output goes to `dist/`, source root is `src/`.

**Key rules:**
- Never disable or comment out `strict`, `noImplicitAny`, or `strictNullChecks` in `tsconfig.json`.
- When the TypeScript compiler cannot infer a type, add an explicit annotation — do not fall back to `any` unless you write an explanatory comment (see the `let image: any` comment pattern in `index.ts`).
- `esModuleInterop: true` is enabled; use default imports for CommonJS packages (e.g., `import path from 'node:path'`).
- Use `node:` protocol for built-in Node modules: `import path from 'node:path'`, `import fs from 'node:fs'`.

### Files to explore
- @tsconfig.json
- @src/index.ts

---

## Key Pattern: Express App Bootstrap

The entire Express app lives in `src/index.ts`. There are no separate router files. Middleware is registered in this order: `urlencoded` → `json` → static routes → view engine config → route handlers → `app.listen`.

```typescript
import 'dotenv/config'
import path from 'node:path';
import express, { Express, Request, Response } from 'express'

const app: Express = express();
const port = process.env.PORT

app.use(express.urlencoded({ extended: true }))
app.use(express.json());
// static middleware...
// view engine config...
// route handlers...

app.listen(port, () => {
    console.log(`App running on server port: http://localhost:${port}`)
})
```

**Key rules:**
- Import `Express`, `Request`, `Response` from `express` for type annotations.
- Annotate the app variable: `const app: Express = express()`.
- `import 'dotenv/config'` must be the first import in `src/index.ts` and in any model file that reads `process.env`.
- Add new routes in `src/index.ts` unless the file grows beyond ~200 lines, at which point extract a router.

### Files to explore
- @src/index.ts

---

## Key Pattern: Route Handler Structure

Route handlers use the `async (req: Request, res: Response)` signature. Query params are destructured from `req.query`; body params from `req.body`. Always guard against non-string query values with a `typeof` check before passing to model functions.

```typescript
app.get('/make-prompt', async (req: Request, res: Response) => {
    const { prompt } = req.query || '';

    // Guard: query params are string | string[] | ParsedQs
    if (typeof prompt === 'string') {
        // call model function
    }
})

app.post('/make-image', async (req: Request, res: Response) => {
    const { modelApi, promptRephrase, prompt } = req.body;
    // body is already typed as any; destructure what you need
})
```

**Key rules:**
- Always `typeof param === 'string'` guard query parameters before using them.
- Destructure named properties from `req.body` rather than accessing them repeatedly as `req.body.prop`.
- Route handlers are `async` even when the route doesn't await anything, to allow future expansion.

### Files to explore
- @src/index.ts

---

## Key Pattern: SSE Streaming Routes

Server-Sent Events are implemented manually (no library). The route sets response headers, defines a `sendEvent` helper, iterates the AI stream with `for await`, and sends chunks as `data: <json>\n\n`. An empty object `{}` signals stream completion to the client.

```typescript
app.get('/make-prompt', async (req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const sendEvent = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // iterate stream
    for await (const chunk of stream) {
        sendEvent({ promptResponse: chunk.text() });
    }
    sendEvent({}); // signals done to the client
})
```

**Key rules:**
- Always set all three SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- Define `sendEvent` as a local `(data: object) => void` closure inside the route handler — do not make it a module-level function.
- Send an empty object `{}` as the final event to signal stream completion.
- Listen for `req.on('close', ...)` to log or clean up when the client disconnects.

### Files to explore
- @src/index.ts
- @src/public/js/events.js

---

## Key Pattern: Static Asset Serving

Assets from `node_modules` (PicoCSS, HTMx) are served via `express.static` with explicit `Content-Type` override in the `setHeaders` callback. Project static files are served from `src/public` via `__dirname`.

```typescript
// Project static files
app.use(express.static(path.join(__dirname, 'public')))

// node_modules assets — always set Content-Type explicitly
app.use('/htmx', express.static(
    path.join('node_modules', 'htmx.org', 'dist'),
    {
        setHeaders: (res, req, start) => {
            res.set('Content-Type', 'application/javascript')
        }
    }
))
```

**Key rules:**
- Use `path.join(__dirname, 'public')` for project assets — never hardcode relative strings.
- For `node_modules` assets, use `path.join('node_modules', ...)` (relative to project root, not `__dirname`).
- Always set `Content-Type` explicitly when serving JS or CSS from `node_modules`.
- Mount CSS frameworks at a short path alias (e.g., `/pico`, `/htmx`) that templates reference by convention.

### Files to explore
- @src/index.ts

---

## Key Pattern: Environment Variable Access

Each model file that needs API credentials imports `dotenv/config` at the top and reads from `process.env` into a module-level `const`, providing a fallback empty string `|| ''` when the key is optional or when TypeScript requires a `string` type.

```typescript
import 'dotenv/config'

const GEMINI_TOKEN = process.env.GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(GEMINI_TOKEN)
```

**Key rules:**
- Import `dotenv/config` as the first import in any file that reads `process.env`.
- Assign `process.env.VAR` to a named `const` at module scope — do not inline `process.env.VAR` in function calls.
- Use `|| ''` for string API tokens so TypeScript accepts the value as `string` (not `string | undefined`).
- API tokens that a constructor accepts as optional (like `Replicate`) can pass `process.env.VAR` directly.
- Never commit `.env`. Copy from `.env.example` when onboarding.

### Files to explore
- @src/models/gemini.ts
- @src/models/openai.ts
- @src/models/huggingface.ts
- @src/models/replicate.ts
- @.env.example

---

## Key Pattern: Model Dispatch via Switch

Route handlers that support multiple AI backends use a `switch` on a `modelApi` string (values: `'hf'`, `'openai'`, `'replicate'`). Each `case` calls its model function and renders the same partial template with normalized props.

```typescript
switch (modelApi) {
    case 'hf':
        image = await hfImage(req.body.promptRephrase);
        res.render(path.join('partials', 'generated-image'), {
            generatedPrompt: image.altText,
            imgUrl: image.imgUrl,
            altText: image.altText,
        })
        break;
    case 'openai':
        image = await makeImage(req.body.promptRephrase);
        res.render(path.join('partials', 'generated-image'), {
            generatedPrompt: req.body.promptRephrase,
            imgUrl: image,
            altText: req.body.promptRephrase,
        })
        break;
    // ...
}
```

**Key rules:**
- All cases render the same partial (`partials/generated-image`) with identical props: `generatedPrompt`, `imgUrl`, `altText`.
- When adding a new model backend, add a new `case` here and a new file in `src/models/`.
- The `modelApi` values (`'hf'`, `'openai'`, `'replicate'`) must match the `value` attributes on the radio inputs in `base.twig`.
- Use `let image: any` with a comment when the return type varies across model functions — this is the established pattern.

### Files to explore
- @src/index.ts
- @src/views/base.twig
