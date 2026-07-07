# CMS OAuth proxy

Lets the Decap CMS admin panel (`/admin`) log in with your GitHub account.
GitHub's OAuth token exchange needs a client secret, which can't live in the
browser, so this small Cloudflare Worker holds it instead and talks to GitHub
on the CMS's behalf.

You only need to set this up once.

## 1. Create a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: anything, e.g. `Personal Site CMS`
   - **Homepage URL**: `https://gabozhang.com` (your site's URL)
   - **Authorization callback URL**: `https://<your-worker-subdomain>.workers.dev/callback`
     (you'll get the exact `workers.dev` URL after step 2 below — you can edit
     this field again afterwards, GitHub lets you update it any time)
3. Click **Register application**, then **Generate a new client secret**.
4. Keep the **Client ID** and **Client secret** handy for step 3.

## 2. Install Wrangler and log in to Cloudflare

```
npm install -g wrangler
wrangler login
```

This opens a browser window to authorize Wrangler against your (free)
Cloudflare account.

## 3. Set the secrets and deploy

From inside this `cms-oauth-worker/` folder:

```
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler deploy
```

Each `secret put` command will prompt you to paste the value. `wrangler deploy`
prints the live URL, e.g. `https://personal-site-cms-auth.<you>.workers.dev`.

## 4. Wire it up

1. Go back to the GitHub OAuth App (step 1) and make sure **Authorization
   callback URL** is exactly `<worker-url>/callback`.
2. In [admin/config.yml](../admin/config.yml), set `base_url` to the worker
   URL (no trailing slash), e.g.:
   ```yaml
   backend:
     name: github
     repo: Gabo-szhj/Personal-Site
     branch: main
     base_url: https://personal-site-cms-auth.<you>.workers.dev
   ```
3. Commit and push that change.

## 5. Try it

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
