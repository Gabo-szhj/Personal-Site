# CLAUDE.md

Context for working in this repo. See [README.md](README.md) for the
user-facing explanation of the CMS pipeline and OAuth flow — this file is the
"why/how it's built" notes for future Claude Code sessions.

## What this repo is

Gabo Zhang's personal site: a static Bootstrap template (originally a
hand-edited HTML/CSS/jQuery portfolio theme), hosted on **GitHub Pages** at
the custom domain in `CNAME`. No frontend build step for the site itself —
`index.html`, `css/`, `js/`, `vendor/` are served as-is.

Repo: `Gabo-szhj/Personal-Site`, default branch `main`.

## Why the CMS pipeline exists

Originally, adding a portfolio project meant hand-editing a ~20-item hardcoded
`<div>` grid in `index.html` plus creating a matching
`ajax/portfolio-ajax-project-N.html` popup fragment — every project touched
two files. The user wanted to add/edit projects without touching code, so
this was layered on top (2026-07):

- **`data/projects.json`** is now the single source of truth for all
  portfolio projects (one JSON object per project — title, images,
  description, category tags, link, etc.)
- **`scripts/build-portfolio.js`** (plain Node, no dependencies) reads that
  JSON and regenerates:
  - the grid markup between the `<!-- PORTFOLIO-GRID:START -->` /
    `<!-- PORTFOLIO-GRID:END -->` markers in `index.html`
  - all `ajax/portfolio-ajax-project-N.html` files (wiped and rewritten every
    run, numbered by array order — this is also why the old orphan
    `portfolio-ajax-project-21.html`, unreferenced by any grid item, got
    deleted the first time the script ran)
- **`.github/workflows/build.yml`** runs that script on every push that
  touches `data/projects.json`, then commits the regenerated `index.html` /
  `ajax/*` straight back to `main` (commit message includes `[skip ci]` so it
  doesn't retrigger itself)
- **`admin/`** is a [Decap CMS](https://decapcms.org/) instance (backend
  `github`, single file collection pointed at `data/projects.json`, list
  widget with `summary: "{{title}}"`) — this is the actual editing UI at
  `/admin`
- **`cms-oauth-worker/`** is a small Cloudflare Worker that proxies the GitHub
  OAuth handshake, since Decap's `github` backend needs a client-secret
  exchange that can't happen in the browser. Implements the standard
  Decap/Netlify CMS `postMessage` handshake (`authorization:github:success:…`).

This design was chosen deliberately over two alternatives:
- **A local-only admin form** (no CMS, no OAuth) — simpler but only editable
  from one machine and still requires manual git commit/push. Rejected: user
  chose the hosted CMS option when asked.
- **Client-side rendering** (fetch `projects.json` at page load, no build
  step) — avoids the GitHub Actions round-trip but requires re-wiring
  Isotope (portfolio filter) + Magnific Popup (ajax modals) + Owl Carousel
  init timing around async data, which is fiddly to get right and hard to
  visually verify without a browser automation tool. Rejected in favor of
  regenerating plain static HTML, so the existing jQuery plugin wiring in
  `js/theme.js` needed **zero changes**.

## Data model (`data/projects.json`)

Single JSON file, top-level `{ "projects": [...] }`. Per-project fields and
what they drive:

| Field | Used for |
|---|---|
| `title`, `subtitle` | Grid tile heading/subheading |
| `categories` | Array of `spotlight`/`research`/`articles`/`videos`/`decks` — becomes the tile's filter classes for Isotope |
| `coverImage` | Grid tile image; also the fallback popup image if `images` is empty |
| `detailTitle` | Popup `<h2>`; falls back to `title` if omitted |
| `images` | Popup carousel slides (Owl Carousel) |
| `description` | Popup "Project Info" paragraph |
| `categoryLabel`, `date`, `url`, `urlLabel` | Popup "Project Details" list |

No `id`/slug field — deliberately removed after the initial migration since
nothing consumed it (ajax filenames are derived from array index, not an id),
and keeping unused fields in a Decap `list` widget schema risks them being
silently dropped on next CMS save.

## Gotchas / conventions

- **Never hand-edit** the grid block inside the `PORTFOLIO-GRID` markers or
  any `ajax/portfolio-ajax-project-*.html` file — the next build overwrites
  them. Edit `data/projects.json` instead.
- `scripts/build-portfolio.js` has zero npm dependencies on purpose (just
  `fs`/`path`) so CI needs nothing but `actions/setup-node`.
- There's **no Node.js in this dev environment** (checked: not on PATH, not
  under Program Files). The build script was validated by porting its exact
  logic to Python and diffing the output against the original hand-written
  HTML byte-for-byte (only whitespace/formatting differences, no data loss) —
  see git history around 2026-07-06 for that verification. If you change
  `build-portfolio.js`, you likely need the same workaround, or ask the user
  to run it (GitHub Actions has Node 20 and will run it for real on push).
- The repo's workflow permissions must be "Read and write" (Settings →
  Actions → General) or `build.yml`'s auto-commit step will fail to push.
- `admin/config.yml`'s `base_url` must point at the deployed
  `cms-oauth-worker` URL — it starts as a `REPLACE-ME` placeholder.
- `.cpanel.yml` in the repo root appears to be legacy/unused; the user
  confirmed GitHub Pages is the real deployment target.

## Outstanding manual setup (as of 2026-07-06)

These require the user's own account logins, so they were left as a
checklist rather than done automatically:

1. Create the GitHub OAuth App + deploy `cms-oauth-worker` via `wrangler`
   (steps in `cms-oauth-worker/README.md`)
2. Replace `base_url` in `admin/config.yml` with the deployed worker URL
3. Enable "Read and write permissions" for Actions in repo settings
