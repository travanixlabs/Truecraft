# Truecraft Property Services — website

Static marketing site for Truecraft Property Services (Perth, WA). Implemented from
the Claude Design source `Truecraft Website.dc.html`
([design project](https://claude.ai/design/p/6e661f05-26a4-48e4-aa39-cf7c97bcc969)).

No build step, no framework, no dependencies — open `index.html` or serve the folder.

```
python -m http.server 8000     # then http://localhost:8000
```

## Layout

| Path                   | What it is                                                          |
| ---------------------- | ------------------------------------------------------------------- |
| `index.html`           | The whole page — nav, hero, services, past work, reviews, quote form |
| `assets/css/styles.css`| All styling; design tokens live in `:root`                           |
| `assets/js/site.js`    | Sticky nav, hero parallax, marquee, scroll reveal, counter, form     |
| `uploads/`             | Photography and the logo                                             |

## Notes on the port

The design source is a Claude Design component (`x-dc` + `support.js` runtime) with
inline styles, `style-hover` attributes and a `DCLogic` class. That runtime is not
shipped here — the markup, styles and behaviour were rewritten as plain HTML/CSS/JS:

- Inline styles → classes in `styles.css`, values carried over verbatim.
- `style-hover` / `style-focus` → real `:hover` / `:focus` rules.
- The JS breakpoint switching (`applyBreakpoint`, 860px) → CSS media queries, so the
  mobile nav and call bar are correct on first paint instead of after hydration.
- Hero height `calc(100vh - 61px)` (a design-canvas artefact) → `100svh`.
- Added: skip link, `aria-expanded` on the menu button, focus-visible outlines,
  lazy-loaded gallery images, Open Graph tags and `HomeAndConstructionBusiness`
  JSON-LD.

### The quote form is not connected

`index.html` renders a real form with client-side validation, but nothing is posted
anywhere — on submit it just confirms locally. Point the `<form>` at an endpoint (or a
form service) and replace the marked block in `assets/js/site.js` to make it live.

Same for the Google reviews panel: the 5.0 rating and skeleton feed are placeholders,
matching the design's "goes live on approval" state.

## Assets

| File | Used for |
| --- | --- |
| `IMG_9924.jpeg` | Logo — nav, hero, favicon |
| `IMG_4944.jpg` | Hero background **and** the Carports card |
| `26558.jpg` | Patios card, and the video poster |
| `pergola-gable.jpg` | Pergolas card |
| `decking-composite-pool.jpg` | Decking card |
| `IMG_4775.jpg` | Wall cladding card |
| `shed-colorbond.jpg` | Sheds card |
| `fencing-colorbond.jpg` | Fencing card |
| `balustrade-glass-stair.jpg` | Balustrading card |
| `deck-subframe-before-after.jpg` | Past work, card 1 |
| `shed-build.mp4` | Past work, card 2 |
| `IMG_2047.jpg` | Past work, card 3 |

Originals live in the design project (several are also renamed copies of WhatsApp
exports — the slugged names here are what `index.html` references).

Three were full-resolution phone photos and were downscaled and recompressed with
ffmpeg (`-q:v 3`, metadata stripped) so the page isn't shipping 19 MB:

| File | Was | Now |
| --- | --- | --- |
| `IMG_4944.jpg` | 3908×2931, 2.8 MB | 2400×1800, 705 KB |
| `IMG_4775.jpg` | 5712×4284, 6.4 MB | 1600×1200, 396 KB |
| `IMG_2047.jpg` | 4028×5371, 5.2 MB | 1200×1600, 369 KB |

The other nine files are byte-identical to the design project's copies.
