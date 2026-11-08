# PIA Desk Web v0.4 — Public-safe frontend

This is a standalone, responsive static frontend under `public/pia/index.html`. It does NOT contain store inventory, KPI targets or Google access tokens.

## Features

- Mobile bottom navigation and desktop sidebar
- Inventory categories: Smartphone, Notebook, Gadget; brand and availability filters
- Item search by name or SKU, manual pricing estimate, local Attach Rate tracker
- Private on-device CSV/JSON import from an authorized Google Sheets export (Inventory tab)
- On-device storage and JSON backup; no server requests and no POS updates

## Publish

Option A: If this GitHub repository is already connected to Cloudflare Worker Git deployment, redeploy the Worker. Static assets use `public/` in `wrangler.toml`; the page is served at **<your verified Worker base URL>/pia/**.

Option B: Deploy only `public/pia` as a separate static site using Vercel or another static host. Root directory: `public/pia`.

**Do not upload inventory files, company data, passwords, or private Sheets credentials into this public repository.** Private Google Sheets cannot be auto-read from a static public page without a secure authenticated backend. CSV must be downloaded with permission and imported manually on-device. Clearing browser site data loses entries unless backed up.

This is an unofficial personal sales helper, not a BaNANA/COM7 system. Verify all sale prices, promo eligibility, Care terms and stock with the store POS before committing a sale.
