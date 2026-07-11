# gabozhang.com

Static personal site, hosted on GitHub Pages. Portfolio projects are edited
through a small CMS instead of hand-editing HTML.

## How adding/editing a project works

The portfolio grid on the homepage and each project's popup detail page are
**generated** — you never hand-edit them directly. The source of truth is
[data/projects.json](data/projects.json).

```
you edit in /admin  →  Decap CMS commits data/projects.json to `main`
                              │
                              ▼
              .github/workflows/build.yml runs on that push
                              │
                              ▼
         node scripts/build-portfolio.js regenerates:
           - the portfolio grid section in index.html
           - ajax/portfolio-ajax-project-N.html (one per project, the popup)
                              │
                              ▼
              bot commits the regenerated files to `main`
                              │
                              ▼
                 GitHub Pages serves the updated site
```

End to end this takes under a minute after you hit "save" in the CMS.

### Editing day-to-day

Go to `https://gabozhang.com/admin/`, log in with GitHub, and use the
**Projects** collection. It's a single form with one repeatable entry per
project — add, remove, reorder, or edit any field:

| Field | What it controls |
|---|---|
| Card title / subtitle | Text shown on the grid tile |
| Filter tags | Which tab(s) — Spotlight/Research/Article/Video/Decks — the project appears under |
| Cover image | Grid tile image (upload goes to `images/projects/`) |
| Detail page title | Popup heading (falls back to card title if blank) |
| Gallery images | Carousel images inside the popup |
| Description | The "Project Info" paragraph in the popup |
| Category label / Date / Link URL / Link display text | The "Project Details" list in the popup |

Reordering entries in the CMS changes their order on the site.

### Editing without the CMS

You can also edit [data/projects.json](data/projects.json) directly (by hand,
or by asking Claude Code) and push to `main` — the same GitHub Action rebuilds
the site either way. To preview the regenerated HTML locally before pushing:

```
node scripts/build-portfolio.js
```

### Things not to do

- Don't hand-edit the grid markup inside the
  `<!-- PORTFOLIO-GRID:START -->` / `<!-- PORTFOLIO-GRID:END -->` markers in
  `index.html`, or the numbered files in `ajax/` — the next build overwrites
  them from `data/projects.json`.
- Everything else on the site (About, Experience, Newsletter, etc.) is still
  plain hand-edited HTML, unrelated to this pipeline.

## How the CMS login (OAuth) works

Decap CMS's `github` backend needs to exchange a GitHub login for an API
token, and that exchange requires a client secret that can't be exposed in
the browser. [cms-oauth-worker/](cms-oauth-worker/) is a small Cloudflare
Worker that holds that secret and does the exchange on the CMS's behalf.

```
1. You open /admin and click "Login with GitHub"
2. Decap CMS opens a popup to  <worker-url>/auth
3. The Worker redirects the popup to GitHub's OAuth authorize screen
4. You approve access; GitHub redirects the popup to <worker-url>/callback?code=...
5. The Worker exchanges that code + its stored CLIENT_SECRET for an access
   token (server-to-server call to GitHub, never visible to the browser)
6. The Worker's callback page posts the token back to the /admin tab via
   window.postMessage, using the standard Decap/Netlify CMS handshake
7. Decap CMS stores the token and uses it to read/write files in the repo
   directly through GitHub's API — that's what "Save" in the CMS actually does
```

Setup (one-time) is documented in
[cms-oauth-worker/README.md](cms-oauth-worker/README.md): register a GitHub
OAuth App, deploy the Worker with `wrangler`, and point `admin/config.yml`'s
`base_url` at the deployed Worker URL.

The Worker never stores anything — it's a stateless relay for a single
request/response exchange. Since this is a public repo with a single admin,
it intentionally skips persisted OAuth `state` validation (see the note at
the bottom of `cms-oauth-worker/README.md` for why, and how to harden it with
Workers KV if you ever want to).
