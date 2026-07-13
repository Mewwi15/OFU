#!/usr/bin/env bash
# Deploy the customer web store (ofu-shop.vercel.app).
#
# `expo export` WIPES dist/ — so the Vercel project link, the SPA rewrite
# config, and the node_modules un-ignore must be recreated on every deploy.
# Fonts live under dist/assets/node_modules/**, which Vercel's default upload
# ignore list silently drops — without the .vercelignore negation the site
# ships without Mitr/Ionicons and every icon renders as tofu.
set -euo pipefail
cd "$(dirname "$0")/.."

npx expo export --platform web

# JS chunk filenames are NOT content-hashed across builds (entry-<hash>.js kept
# its name while its contents changed) — NEVER serve /_expo/static as immutable
# or browsers keep poisoned entries for a year (white-screen: "Unexpected token
# '<'" + "Requiring unknown module"). must-revalidate = cheap ETag 304s.
# /assets/* filenames DO carry a real content md5 → immutable is safe there.
cat > dist/vercel.json <<'JSON'
{
  "rewrites": [{ "source": "/((?!_expo/|assets/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/_expo/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
JSON

# Bust the boot scripts' URLs per deploy so any client that ever stored them
# under an immutable policy refetches (recovers the 2026-07-13 poisoning too).
sed -i '' "s|\(/_expo/static/js/web/[^\"]*\.js\)\"|\1?v=$(date +%s)\"|g" dist/index.html

cat > dist/.vercelignore <<'TXT'
!assets/node_modules
!assets/node_modules/**
TXT

cd dist
npx vercel link --yes --project ofu-shop
# CLI v55 prints JSON to stdout — fish the deployment URL out by pattern.
out=$(npx vercel deploy 2>&1)
url=$(echo "$out" | grep -o 'https://ofu-shop-[a-z0-9]*-mewwis-projects\.vercel\.app' | head -1)
[ -z "$url" ] && { echo "deploy URL not found in output:"; echo "$out" | tail -5; exit 1; }
echo "deployed: $url"
npx vercel promote "$url" --yes
echo "live: https://ofu-shop.vercel.app"
