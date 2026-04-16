---
applyTo: "src/views/**/*.twig,src/public/**/*.css,src/public/**/*.js"
---

# Frontend Standards

## Twig Template Structure

### ENFORCE: `base.twig` is the only full-page layout — partials output fragments only

```twig
{# CORRECT — base.twig contains the full page shell #}
<!DOCTYPE html>
<html lang="en">
    <head>
        <link rel="stylesheet" href="pico/pico.classless.min.css">
        <link rel="stylesheet" href="css/main.css">
        <link rel="stylesheet" href="css/media-queries.css">
        <script src="htmx/htmx.min.js"></script>
        <title>{{ title }}</title>
    </head>
    <body>
        ...
        <script src="js/events.js"></script>
    </body>
</html>
```

### FLAG FOR REVIEW: Partial files that include `<html>`, `<head>`, or `<body>` tags

```twig
{# WRONG — partial should never include page structure #}
<html>
<body>
<figure class="prompt__figure">...</figure>
</body>
</html>

{# CORRECT — partial is a fragment only #}
<figure class="prompt__figure">
    <img id="img-response" src="{{ imgUrl }}" alt="{{ altText }}" class="gen-ai-image htmx-indicator" />
    <img src="/svg/loaders/puff.svg" alt="loading" class="prompt__response-loader htmx-indicator" />
</figure>
```

### ENFORCE: Asset paths must use the established mount aliases

| Asset | Alias |
|-------|-------|
| PicoCSS | `pico/pico.classless.min.css` |
| HTMx | `htmx/htmx.min.js` |
| Project CSS | `css/main.css`, `css/media-queries.css` |
| Project JS | `js/events.js` |
| SVG assets | `/svg/loaders/puff.svg` |

```twig
{# WRONG — raw node_modules path #}
<script src="/node_modules/htmx.org/dist/htmx.min.js"></script>

{# CORRECT — uses the Express mount alias #}
<script src="htmx/htmx.min.js"></script>
```

### ENFORCE: `<script src="js/events.js">` goes at the bottom of `<body>`, after all markup

```twig
{# CORRECT — script tag is the last element inside <body> #}
    <script src="js/events.js"></script>
</body>
</html>

{# WRONG — script in <head> or before the markup #}
<head>
    <script src="js/events.js"></script>
</head>
```

### ENFORCE: Twig variables use `{{ variableName }}` syntax, comments use `{# ... #}`

```twig
{# CORRECT #}
<title>{{ title }}</title>
{# This is a Twig comment #}

{# WRONG — HTML comment for template logic #}
<!-- {{ title }} -->
```

---

## Twig Partials as HTMx Swap Targets

### ENFORCE: All partial renders pass `generatedPrompt`, `imgUrl`, and `altText`

```typescript
// CORRECT — all three props always included
res.render(path.join('partials', 'generated-image'), {
    generatedPrompt: req.body.promptRephrase,
    imgUrl: image,
    altText: req.body.promptRephrase,
})

// WRONG — missing props break forward compatibility
res.render(path.join('partials', 'generated-image'), {
    imgUrl: image,
})
```

### ENFORCE: Use `path.join('partials', 'generated-image')` — no `.twig` extension

```typescript
// CORRECT — Twig engine appends the extension
res.render(path.join('partials', 'generated-image'), { ... })

// WRONG — extension causes a double-extension error
res.render(path.join('partials', 'generated-image.twig'), { ... })
```

### ENFORCE: The partial's root element must be a single container

```twig
{# CORRECT — single <figure> root that replaces hx-target inner HTML #}
<figure class="prompt__figure">
    <img ... />
    <img ... />
</figure>

{# WRONG — multiple root elements break hx-swap="innerHTML" #}
<img ... />
<img ... />
```

---

## HTMx Attributes

### ENFORCE: The "Generate Image" button requires all four HTMx attributes

```html
<!-- CORRECT -->
<button
    hx-post="/make-image"
    hx-include="#prompt-form"
    hx-target=".prompt__response-image"
    hx-swap="innerHTML"
    hx-indicator=".prompt__response"
>Generate Image</button>
```

### FLAG FOR REVIEW: `hx-include` missing or pointing to the wrong selector

```html
<!-- WRONG — form fields will not be submitted -->
<button hx-post="/make-image" hx-target=".prompt__response-image" hx-swap="innerHTML">

<!-- CORRECT -->
<button hx-post="/make-image" hx-include="#prompt-form" hx-target=".prompt__response-image" hx-swap="innerHTML">
```

### ENFORCE: `hx-swap="innerHTML"` — replaces content inside the target, not the target itself

```html
<!-- CORRECT — wrapper .prompt__response-image persists across swaps -->
hx-swap="innerHTML"

<!-- WRONG — replaces the wrapper element itself, breaking subsequent swaps -->
hx-swap="outerHTML"
```

### ENFORCE: `htmx-indicator` class on elements that participate in loading state toggling

HTMx automatically sets `opacity: 0` on elements with the `htmx-indicator` class and sets `opacity: 1` during a request. CSS overrides explicit visibility in non-request state.

```html
<!-- CORRECT — both the placeholder and the generated image carry htmx-indicator -->
<img src="/svg/512x512.svg" class="prompt__response-placeholder htmx-indicator" />
<img src="/svg/loaders/puff.svg" class="prompt__response-loader htmx-indicator" />
```

### FLAG FOR REVIEW: SSE handled via the HTMx SSE extension (`hx-ext="sse"`)

The project uses vanilla JS `EventSource` for SSE streaming, not the HTMx SSE extension. The comment in `base.twig` documents why: `hx-ext="sse"` does not handle word-by-word updates correctly. Do not add `hx-ext="sse"` to the form or any element.

---

## SSE Client with EventSource

### ENFORCE: `e.preventDefault()` called before opening `EventSource`

```javascript
// CORRECT
form.addEventListener('submit', (e) => {
    e.preventDefault();
    // ...open EventSource
});

// WRONG — page navigates away without preventDefault
form.addEventListener('submit', (e) => {
    const eventSource = new EventSource(url);
});
```

### ENFORCE: Clear `promptResult.innerHTML = ''` before each new stream

```javascript
// CORRECT — clears previous response before new stream starts
form.addEventListener('submit', (e) => {
    e.preventDefault();
    promptResult.innerHTML = '';
    // ...open EventSource
});
```

### ENFORCE: Parse `event.data` as JSON — server sends `JSON.stringify({ promptResponse: '...' })`

```javascript
// CORRECT
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.promptResponse) { ... }
};

// WRONG — reading event.data as a raw string
eventSource.onmessage = (event) => {
    promptResult.innerHTML += event.data;
};
```

### ENFORCE: Use `+=` to accumulate SSE chunks, not `=`

```javascript
// CORRECT — each chunk is an incremental piece
promptResult.innerHTML += data.promptResponse;

// WRONG — replaces the entire content on each chunk
promptResult.innerHTML = data.promptResponse;
```

### ENFORCE: An event with no `promptResponse` key signals stream completion — re-enable the button

```javascript
// CORRECT
if (data.promptResponse) {
    form.querySelector('button').disabled = true;
    promptResult.innerHTML += data.promptResponse;
} else {
    // empty object {} = stream complete
    form.querySelector('button').disabled = false;
}
```

### ENFORCE: `onerror` handler present on `EventSource`

```javascript
// CORRECT
eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
};
```

---

## CSS Naming and Nesting

### ENFORCE: BEM-inspired naming — `.block` and `.block__element`

```css
/* CORRECT */
.prompt { ... }
.prompt__submit-button { ... }
.prompt__response-image { ... }
.prompt__response-loader { ... }

/* WRONG — modifier syntax not used in this codebase */
.prompt--active { ... }
.prompt__button--large { ... }
```

### ENFORCE: Native CSS nesting — no Sass or PostCSS

```css
/* CORRECT — native CSS nesting */
.prompt {
    max-width: var(--img-dim);

    .prompt__submit-button {
        display: flex;
        width: var(--img-dim);
    }
}

/* WRONG — Sass-style nesting with & */
.prompt {
    &__submit-button { ... }
}
```

### ENFORCE: Responsive overrides go in `media-queries.css`, not inline in `main.css`

```css
/* WRONG — @media block inside main.css */
.content {
    display: flex;
    @media (min-width: 1024px) {
        flex-direction: row;
    }
}

/* CORRECT — media-queries.css */
@media (min-width: 1024px) {
    .content {
        flex-direction: row;
    }
}
```

---

## CSS Custom Properties for Dimensions

### ENFORCE: Never hardcode `512px` — use `var(--img-dim)`

```css
/* CORRECT */
.prompt {
    max-width: var(--img-dim);
}
.prompt__submit-button {
    width: var(--img-dim);
}

/* WRONG */
.prompt {
    max-width: 512px;
}
```

### ENFORCE: New shared values added to `:root` in `main.css`

```css
/* CORRECT */
:root {
    --img-dim: 512px;
    --screen-tablet: 768px;
    /* add new tokens here */
}
```

### FLAG FOR REVIEW: PicoCSS variable overrides

PicoCSS classless styles provide base typography and form styling. Avoid overriding PicoCSS CSS variables (prefixed `--pico-*`) unless the change is intentional and documented with a comment.

---

## HTMx Indicator Pattern

### ENFORCE: Loading state toggling via `htmx-indicator` + CSS overrides — not inline JavaScript

```css
/* CORRECT — CSS manages visibility based on HTMx request state */
.prompt__response-image .prompt__figure {
    .prompt__response-placeholder.htmx-indicator,
    .gen-ai-image.htmx-indicator {
        opacity: 1;
    }
}

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

### ENFORCE: Spinner SVG loaded from `/svg/loaders/puff.svg`

```html
<!-- CORRECT -->
<img src="/svg/loaders/puff.svg" alt="loading" class="prompt__response-loader htmx-indicator" />

<!-- WRONG — path not served by express.static -->
<img src="./assets/loaders/puff.svg" />
```

---

## Code Review Checklist

### ENFORCE:
1. Partial files contain only HTML fragments — no `<html>`, `<head>`, or `<body>` tags
2. Asset paths in Twig templates use mount aliases (`pico/`, `htmx/`, `css/`, `js/`, `/svg/`)
3. `<script src="js/events.js">` is the last element inside `<body>`
4. All `res.render` calls for partials pass `generatedPrompt`, `imgUrl`, and `altText`
5. `res.render` uses `path.join('partials', 'generated-image')` with no `.twig` extension
6. HTMx "Generate Image" button has all four attributes: `hx-post`, `hx-include="#prompt-form"`, `hx-target`, `hx-swap="innerHTML"`, `hx-indicator`
7. SSE `form.submit` handler calls `e.preventDefault()` before opening `EventSource`
8. `promptResult.innerHTML = ''` clears content at the start of each form submission
9. `event.data` parsed with `JSON.parse` before reading `promptResponse`
10. SSE chunks accumulated with `+=`, not `=`
11. `eventSource.onerror` handler is present
12. CSS uses native nesting — no Sass/PostCSS syntax
13. `var(--img-dim)` used instead of hardcoded `512px`
14. Media query overrides in `media-queries.css`, not `main.css`
15. Spinner SVGs served from `/svg/loaders/puff.svg`

### FLAG FOR REVIEW:
1. `hx-ext="sse"` added anywhere — SSE streaming is handled by vanilla JS `EventSource`, not HTMx extension
2. `hx-swap="outerHTML"` on the image generation button — should be `innerHTML`
3. Missing `htmx-indicator` class on elements that should participate in loading state
4. PicoCSS variable overrides without an explanatory comment
5. New breakpoints hardcoded in `media-queries.css` instead of added to `:root` as named custom properties
