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

## Missing image assets

Two files transferred from the design project. The remaining nine photos and the video
are larger than the 256 KiB the design API will return per file, so they were truncated
and are **not** in `uploads/`. Export them from the design project and drop them in —
the filenames below are exactly what `index.html` expects.

Present:

- `uploads/IMG_9924.jpeg` — logo (nav + hero + favicon)
- `uploads/shed-colorbond.jpg` — Sheds card

Still needed:

- `uploads/IMG_4944.jpg` — hero background **and** Carports card
- `uploads/26558.jpg` — Patios card, also the video poster
- `uploads/pergola-gable.jpg` — Pergolas card
- `uploads/decking-composite-pool.jpg` — Decking card
- `uploads/IMG_4775.jpg` — Wall cladding card
- `uploads/fencing-colorbond.jpg` — Fencing card
- `uploads/balustrade-glass-stair.jpg` — Balustrading card
- `uploads/deck-subframe-before-after.jpg` — Past work, card 1
- `uploads/IMG_2047.jpg` — Past work, card 3
- `uploads/shed-build.mp4` — Past work, card 2 (video)

Worth compressing them on the way in — several are multi-megabyte phone photos, and the
hero image is the largest thing on the page.
