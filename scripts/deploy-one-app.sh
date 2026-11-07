#!/usr/bin/env bash
# One Cloudflare Worker + Static Assets + D1 = one app, one URL, one database.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v npm >/dev/null; then
  echo 'Please run this from GitHub Codespaces or another environment with Node.js + npm.' >&2
  exit 1
fi
printf '\nNAMO AGENT WORLD — SINGLE DEPLOYMENT\n'
printf 'This deploys BOTH the pixel town and the task/AI API to one workers.dev address.\n'
printf 'You will authenticate with Cloudflare in your browser. Never paste passwords in chat.\n\n'
npm install
npx wrangler login
if ! grep -q 'binding = "DB"' wrangler.toml; then
  npx wrangler d1 create namo-world-db --binding DB --update-config
else
  echo 'Using the existing D1 DB binding in wrangler.toml.'
fi
npx wrangler d1 migrations apply namo-world-db --remote
printf '\nConfigure the OWNER_KEY for the shared workspace (minimum 12 strong characters).\n'
npx wrangler secret put OWNER_KEY
printf '\nSet GEMINI_API_KEY only if you wish to enable the Gemini cloud agent.\n'
read -r -p 'Enable Gemini now? [y/N]: ' gemini
if [[ "$gemini" =~ ^[yY]$ ]]; then
  npx wrangler secret put GEMINI_API_KEY
fi
npx wrangler deploy
printf '\nDONE. Open the workers.dev URL printed above on both phone and PC, then sign in with the SAME OWNER_KEY.\n'
