# CMS OAuth proxy

Lets the Decap CMS admin panel (`/admin`) log in with your GitHub account.
GitHub's OAuth token exchange needs a client secret, which can't live in the
browser, so this small Cloudflare Worker holds it instead and talks to GitHub
on the CMS's behalf.

You only need to set this up once.

## 1. Install Wrangler and log in to Cloudflare

```
npm install -g wrangler
wrangler login
```

This opens a browser window to authorize Wrangler against your (free)
Cloudflare account.

## 2. Deploy the Worker (to get its URL)

From inside this `cms-oauth-worker/` folder:

```
wrangler deploy
```

It's fine that `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` don't exist yet —
those are only read when someone actually logs in, not at deploy time. This
command prints the live URL, e.g.
`https://personal-site-cms-auth.<you>.workers.dev`. Keep that URL handy —
GitHub needs it in the next step, and you need it again in step 4.

## 3. Create a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: anything, e.g. `Personal Site CMS`
   - **Homepage URL**: `https://gabozhang.com` (your site's URL)
   - **Authorization callback URL**: the URL from step 2 plus `/callback`,
     e.g. `https://personal-site-cms-auth.<you>.workers.dev/callback`
3. Click **Register application**, then **Generate a new client secret**.
4. Keep the **Client ID** and **Client secret** handy for step 4.

## 4. Set the secrets

Still from inside `cms-oauth-worker/`:

```
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

Each command prompts you to paste the value. No redeploy needed — secrets
take effect immediately.

## 5. Wire it up

1. In [admin/config.yml](../admin/config.yml), set `base_url` to the worker
   URL from step 2 (no trailing slash), e.g.:
   ```yaml
   backend:
     name: github
     repo: Gabo-szhj/Personal-Site
     branch: main
     base_url: https://personal-site-cms-auth.<you>.workers.dev
   ```
2. Commit and push that change.

## 6. Try it

Visit `https://gabozhang.com/admin/` (or wherever the site is hosted), click
**Login with GitHub**, and you should be able to add/edit/reorder projects.
Saving in the CMS commits `data/projects.json` straight to the `main` branch;
the `Build portfolio` GitHub Action then regenerates the actual HTML within
about a minute.

## Notes

- This Worker only ever forwards your GitHub token to the CMS running in your
  own browser tab — it doesn't store anything.
- The GitHub OAuth scope requested is `repo`, matching what a git-backed CMS
  needs to read/write files in your repo. Since the repo is public and this
  is a personal single-admin site, this Worker skips persisted CSRF `state`
  validation (there's nowhere free to store it without adding Workers KV). If
  you want that hardening later, Cloudflare's Workers KV free tier covers it.
- If you ever change the Worker's name in `wrangler.toml`, its URL changes
  too — you'd need to update both the GitHub OAuth App's callback URL and
  `admin/config.yml`'s `base_url` to match.
