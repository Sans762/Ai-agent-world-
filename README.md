# Namo Agent World — one repo, one Worker, one URL

Namo is a **single responsive pixel-town office** with six AI roles, one Cloudflare Worker API and one Cloudflare D1 task database. The same URL works on phones and desktops. There is **no separate mobile edition**.

**[คู่มือติดตั้งภาษาไทยสำหรับ GitHub + Cloudflare](docs/GITHUB-CLOUDFLARE-TH.md)**

## Current features

- 16-bit-style top-down pixel town, twelve buildings, rooms, grass, roads, desks, chairs and moving agent sprites.
- Touch controls, zoom, pans and a common responsive layout for mobile and desktop.
- Task lifecycle stored in a central Cloudflare D1 database after deployment and owner sign-in.
- Gemini AI generation when an optional Gemini API key is set as a Worker secret and quota is available.
- Manual ChatGPT and Claude task handoff, **not an automatic free API connection**.

## Structure

- `public/` — the same Pixel Town UI served to every device.
- `src/worker.js` — task/AI API from the same Worker URL.
- `migrations/` — D1 database schema.
- `wrangler.toml` — Cloudflare Worker and static assets configuration.
- `.github/workflows/test.yml` — automated checks on GitHub pushes/PRs.

## Test locally

```bash
npm test
node --check public/app.js
node --check src/worker.js
```

## Deploy from GitHub with Cloudflare Builds

1. Source repository: [`Sans762/Ai-agent-world-`](https://github.com/Sans762/Ai-agent-world-). Do not commit API keys or passwords.
2. Cloudflare dashboard → **Workers & Pages** → **Create application** → **GitHub** → choose `Sans762/Ai-agent-world-`, production branch `main`, Worker name `namo-agent-world`, root `/`, deploy command `npx wrangler deploy`.
3. Create a **D1** database `namo-world-db`, add the D1 binding `DB` with its actual `database_id` to `wrangler.toml`, and apply `migrations/0001_tasks.sql` (or Wrangler remote migrations). Commit the binding change to GitHub so Cloudflare redeploys.
4. In the Cloudflare Worker, configure the secret `OWNER_KEY` (strong password, at least 12 characters); optionally add `GEMINI_API_KEY`.
5. Open the resulting `https://namo-agent-world.<your-account>.workers.dev` URL on **both** mobile and PC. The real URL is assigned by Cloudflare, not invented by this repository.

See [full step-by-step instructions](docs/GITHUB-CLOUDFLARE-TH.md). There is no live hosted instance in this source repository, and the existing ChatGPT conversation is not automatically embedded in the site.
