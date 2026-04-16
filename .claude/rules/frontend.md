---
paths:
  - "src/views/**/*.twig"
  - "src/public/**/*.css"
  - "src/public/**/*.js"
---

## Key Pattern: Twig Template Structure

`base.twig` is the only full-page layout. It includes all `<head>` dependencies, the page shell, and the main form. Partials (in `src/views/partials/`) render HTML fragments only — no `<html>`, `<head>`, or `<body>` tags.

```twig
{# base.twig — full page layout #}
<!DOCTYPE html>
<html lang="en">
    <head>
        <link rel="stylesheet" href="pico/pico.classless.min.css">
        <link rel="stylesheet" href="css/main.css">
        <script src="htmx/htmx.min.js"></script>
        <title>{{ title }}</title>
    </head>
    <body>
        {# page content #}
        <script src="js/events.js"></script>
    </body>
</html>

{# partials/generated-image.twig — fragment only #}
<figure class="prompt__figure">
    <img src="{{ imgUrl }}" alt="{{ altText }}" />
</figure>
```

**Key rules:**
- Asset paths use the mount aliases set in `index.ts`: `pico/`, `htmx/`, `css/`, `js/`, `svg/`.
- The `<script src="js/events.js">` tag goes at the bottom of `<body>`, after all markup.
- Partials only output the HTML fragment that will be swapped — no surrounding page structure.
- Twig variables passed from `res.render` are referenced with `{{ variableName }}` syntax. Comments use `{# ... #}`.
- `strict_variables: false` is set on the Twig engine — missing variables silently render as empty, not errors.

### Files to explore
- @src/views/base.twig
- @src/views/partials/generated-image.twig
- @src/index.ts

---

## Key Pattern: Twig Partials as HTMx Swap Targets

The `res.render` call in Express renders a Twig partial whose output replaces the `hx-target` element in the browser. The partial receives a consistent set of props: `imgUrl`, `altText`, `generatedPrompt`.

```typescript
// Express route — render partial
res.render(path.join('partials', 'generated-image'), {
    generatedPrompt: req.body.promptRephrase,
    imgUrl: image,
    altText: req.body.promptRephrase,
})
```

```twig
{# partials/generated-image.twig #}
<figure class="prompt__figure">
    <img id="img-response" src="{{ imgUrl }}" alt="{{ altText }}" class="gen-ai-image htmx-indicator" />
    <img src="/svg/loaders/puff.svg" alt="loading" class="prompt__response-loader htmx-indicator" />
</figure>
```

**Key rules:**
- Use `path.join('partials', 'generated-image')` (no `.twig` extension) — the Twig engine appends it.
- The partial's root element must be a single container (`<figure>`) that replaces the entire `hx-target` inner HTML.
- Always pass all three props — `generatedPrompt`, `imgUrl`, `altText` — from the route, even if the partial does not use all of them yet (forward compatibility).

### Files to explore
- @src/views/partials/generated-image.twig
- @src/index.ts

---

## Key Pattern: HTMx Attributes

HTMx is used for the image generation POST request. The form is submitted with `hx-post`, includes all form fields via `hx-include`, targets the response container with `hx-target`, and shows a loading indicator via `hx-indicator`.

```html
<button
    hx-post="/make-image"
    hx-include="#prompt-form"
    hx-target=".prompt__response-image"
    hx-swap="innerHTML"
    hx-indicator=".prompt__response"
>Generate Image</button>
```

**Key rules:**
- `hx-include="#prompt-form"` sends all named inputs inside the form — this is how `modelApi` (radio) and `promptRephrase` (textarea) reach the server.
- `hx-swap="innerHTML"` replaces the content inside the target, not the target itself — the wrapper `.prompt__response-image` persists.
- `hx-indicator` points to the element that receives the `htmx-request` class during the request — used to drive CSS loading states.
- SSE streaming (the `/make-prompt` route) is handled by vanilla JS `EventSource`, not HTMx SSE extension — the comment in `base.twig` explains why.

### Files to explore
- @src/views/base.twig

---

## Key Pattern: SSE Client with EventSource

The client-side SSE handler lives in `src/public/js/events.js`. It intercepts the form's `submit` event, builds a query string from `FormData`, opens an `EventSource`, and streams JSON chunks into the `#prompt-result` textarea. An empty object payload signals completion and re-enables the submit button.

```javascript
form.addEventListener('submit', (e) => {
    e.preventDefault();
    promptResult.innerHTML = '';

    const formData = new FormData(form);
    const urlParams = new URLSearchParams(formData);
    const eventSource = new EventSource(`/make-prompt?${urlParams.toString()}`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.promptResponse) {
            form.querySelector('button').disabled = true;
            promptResult.innerHTML += data.promptResponse;
        } else {
            form.querySelector('button').disabled = false;
        }
    };
});
```

**Key rules:**
- Always call `e.preventDefault()` on form submit before opening the `EventSource`.
- Clear `promptResult.innerHTML = ''` at the start of each submission before streaming new content.
- Parse each event's `data` as JSON — the server sends `JSON.stringify({ promptResponse: '...' })`.
- An event with no `promptResponse` key (empty object `{}`) means the stream is complete — re-enable the button and the `EventSource` can be closed.
- Append chunks with `+=` not `=` — each chunk is an incremental piece of the full response.

### Files to explore
- @src/public/js/events.js
- @src/index.ts

---

## Key Pattern: CSS Naming and Nesting

CSS uses a BEM-inspired flat naming convention: `.block`, `.block__element`. Nested rules use native CSS nesting (no preprocessor). Component blocks are scoped to their parent class.

```css
.prompt {
    max-width: var(--img-dim);

    .prompt__submit-button {
        display: flex;
        width: var(--img-dim);
    }

    .prompt__rephrase {
        height: 368px;
    }
}

.prompt__response {
    .prompt__figure {
        width: var(--img-dim);
    }
}
```

**Key rules:**
- Class names follow `.<block>__<element>` for components (`prompt__submit-button`, `prompt__response-image`).
- Use native CSS nesting (`&` is not required for descendant selectors inside a rule block) — no Sass or PostCSS.
- Keep component styles together under their block selector, not scattered across the file.
- `media-queries.css` is a separate file — add responsive overrides there, not inline in `main.css`.

### Files to explore
- @src/public/css/main.css
- @src/public/css/media-queries.css

---

## Key Pattern: CSS Custom Properties for Dimensions

Shared dimensional values are defined as CSS custom properties on `:root`. The canonical image size token is `--img-dim: 512px`.

```css
:root {
    --img-dim: 512px;
    --screen-tablet: 768px;
}

.prompt {
    max-width: var(--img-dim);
}
```

**Key rules:**
- Never hardcode `512px` — use `var(--img-dim)`.
- Add new shared values (colors, spacings, breakpoints) to `:root` in `main.css`.
- `--screen-tablet` is the tablet breakpoint; `media-queries.css` uses `1024px` for the desktop layout shift — add new breakpoints as named custom properties.
- PicoCSS classless styles provide base typography and form styling — avoid overriding PicoCSS variables unless necessary.

### Files to explore
- @src/public/css/main.css
- @src/public/css/media-queries.css

---

## Key Pattern: HTMX Indicator Pattern

HTMx loading states are driven by the `htmx-indicator` class and the `htmx-request` class that HTMx adds to the `hx-indicator` target during a request. Loading spinners use `opacity: 0` by default and `opacity: 1` during request. The generated image uses the same pattern in reverse.

```css
/* Default — show placeholder, hide loader */
.prompt__response-image .prompt__figure {
    .prompt__response-placeholder.htmx-indicator,
    .gen-ai-image.htmx-indicator {
        opacity: 1;
    }
}

/* During request — hide both, show loader */
.prompt__response.htmx-request {
    .prompt__response-image .prompt__figure {
        .htmx-indicator.prompt__response-placeholder,
        .htmx-indicator.gen-ai-image {
            opacity: 0;
            display: none;
        }
    }
}
```

**Key rules:**
- Use `htmx-indicator` class on elements that should respond to request state — HTMx manages their default `opacity: 0` automatically.
- Override `opacity: 1` explicitly when an indicator element should be *visible* in the default (non-request) state.
- The loading spinner (puff.svg) and the generated image both carry `htmx-indicator` — CSS toggles between them based on request state.
- Place spinner SVG at `/svg/loaders/puff.svg` — this path is resolved as a static asset.

### Files to explore
- @src/public/css/main.css
- @src/views/base.twig
- @src/views/partials/generated-image.twig
