---
applyTo: "src/**/*.ts"
---

# TypeScript & Express Standards

## Strict TypeScript Config

### ENFORCE: Never weaken the strict compiler flags

```json
// CORRECT — tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### FLAG FOR REVIEW: Using `any` without an explanatory comment

```typescript
// WRONG
let image: any;

// CORRECT — explain why `any` is necessary
let image: any; // return type varies across model functions (hfImage returns {imgUrl, altText}, makeImage returns string, replicateImage returns array)
```

### FLAG FOR REVIEW: Node built-in imports missing the `node:` protocol

```typescript
// WRONG
import path from 'path';
import fs from 'fs';

// CORRECT
import path from 'node:path';
import fs from 'node:fs';
```

---

## Express App Bootstrap

### ENFORCE: Express type annotations on the app variable

```typescript
// CORRECT
import express, { Express, Request, Response } from 'express'
const app: Express = express();
```

### ENFORCE: Middleware registration order

```typescript
// CORRECT — this order must be preserved
app.use(express.urlencoded({ extended: true }))
app.use(express.json());
// static middleware next...
// view engine config next...
// route handlers last...
app.listen(port, () => { ... })
```

### FLAG FOR REVIEW: New router files being created

```typescript
// WRONG — adding a separate router file
// src/routes/images.ts

// CORRECT — add routes directly to src/index.ts unless the file exceeds ~200 lines
// src/index.ts
app.post('/make-image', async (req: Request, res: Response) => { ... })
```

---

## Route Handler Structure

### ENFORCE: `typeof` guard on query parameters before use

```typescript
// CORRECT
app.get('/make-prompt', async (req: Request, res: Response) => {
    const { prompt } = req.query || '';
    if (typeof prompt === 'string') {
        // safe to pass to model functions
    }
})
```

### FLAG FOR REVIEW: Query param passed to a function without a `typeof` check

```typescript
// WRONG
const stream = await makeImagePrompt(req.query.prompt);

// CORRECT
if (typeof req.query.prompt === 'string') {
    const stream = await makeImagePrompt(req.query.prompt);
}
```

### ENFORCE: Destructure named properties from `req.body`

```typescript
// CORRECT
const { modelApi, promptRephrase, prompt } = req.body;

// WRONG — repeated access
const result = await hfImage(req.body.promptRephrase);
res.render('...', { altText: req.body.promptRephrase });
```

---

## SSE Streaming Routes

### ENFORCE: All three SSE headers must be present

```typescript
// CORRECT
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
});
```

### ENFORCE: `sendEvent` defined as a local closure inside the route handler

```typescript
// CORRECT — defined inside the handler
const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// WRONG — module-level function
function sendEvent(res: Response, data: object) { ... }
```

### ENFORCE: Empty object `{}` as the final SSE event to signal stream completion

```typescript
// CORRECT
for await (const chunk of stream) {
    sendEvent({ promptResponse: chunk.text() });
}
sendEvent({}); // signals done to the client
```

### FLAG FOR REVIEW: Missing `req.on('close', ...)` cleanup listener

```typescript
// WRONG — no cleanup on disconnect
app.get('/make-prompt', async (req, res) => {
    // ...stream loop
})

// CORRECT
app.get('/make-prompt', async (req, res) => {
    // ...stream loop
    req.on('close', () => {
        console.log('Connection closed');
    });
})
```

---

## Static Asset Serving

### ENFORCE: Use `path.join(__dirname, 'public')` for project static files

```typescript
// CORRECT
app.use(express.static(path.join(__dirname, 'public')))

// WRONG — hardcoded relative string
app.use(express.static('./src/public'))
```

### ENFORCE: Explicit `Content-Type` when serving assets from `node_modules`

```typescript
// CORRECT
app.use('/htmx', express.static(
    path.join('node_modules', 'htmx.org', 'dist'),
    {
        setHeaders: (res, req, start) => {
            res.set('Content-Type', 'application/javascript')
        }
    }
))

// WRONG — no Content-Type override
app.use('/htmx', express.static(path.join('node_modules', 'htmx.org', 'dist')))
```

---

## Environment Variable Access

### ENFORCE: `import 'dotenv/config'` as the first import in files that read `process.env`

```typescript
// CORRECT — first line in the file
import 'dotenv/config'
import path from 'node:path';
// ...
```

### ENFORCE: Assign env vars to a named module-level `const` before use

```typescript
// CORRECT
const GEMINI_TOKEN = process.env.GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(GEMINI_TOKEN)

// WRONG — inline in constructor call
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
```

### ENFORCE: `|| ''` fallback for string API tokens

```typescript
// CORRECT — TypeScript accepts string, not string | undefined
const GEMINI_TOKEN = process.env.GEMINI_API_KEY || ''
const HF_API_TOKEN = process.env.HF_API_TOKEN  // acceptable when the SDK accepts string | undefined
```

---

## Model Dispatch via Switch

### ENFORCE: All switch cases render the same partial with the same three props

```typescript
// CORRECT — every case passes generatedPrompt, imgUrl, altText
res.render(path.join('partials', 'generated-image'), {
    generatedPrompt: req.body.promptRephrase,
    imgUrl: image,
    altText: req.body.promptRephrase,
})
```

### FLAG FOR REVIEW: A new `modelApi` case that does not match a radio input value in `base.twig`

The `modelApi` values in the switch (`'hf'`, `'openai'`, `'replicate'`) must match the `value` attributes on the radio inputs in `src/views/base.twig`. Adding a new case without a matching radio input will make the backend unreachable from the UI.

---

## Code Review Checklist

### ENFORCE:
1. `strict`, `noImplicitAny`, `strictNullChecks` are never disabled in `tsconfig.json`
2. Node built-in imports use the `node:` protocol
3. `import express, { Express, Request, Response }` with `const app: Express` annotation
4. Middleware registered in order: urlencoded → json → static → view engine → routes → listen
5. All three SSE headers present: `text/event-stream`, `no-cache`, `keep-alive`
6. `sendEvent` defined as a local closure inside the SSE route handler
7. Final SSE event is always `sendEvent({})`
8. `import 'dotenv/config'` is the first import in every file that reads `process.env`
9. Env vars assigned to named module-level `const` before being passed to constructors
10. `express.static` for `node_modules` assets includes an explicit `setHeaders` with `Content-Type`
11. All model dispatch switch cases render `partials/generated-image` with `generatedPrompt`, `imgUrl`, `altText`

### FLAG FOR REVIEW:
1. Any use of `any` without an explanatory comment
2. `require()` instead of `import`
3. `process.env.VAR` inlined directly in a constructor or function argument
4. Query parameters used without a `typeof param === 'string'` guard
5. New router files before `src/index.ts` reaches ~200 lines
6. Missing `req.on('close', ...)` listener in SSE route handlers
7. New `modelApi` switch case whose string value has no matching radio input in `base.twig`
