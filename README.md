# AIPulse v3.1 — SEA Telecom Watch

AI + telecom intelligence dashboard. **Live:** https://cw-agi.github.io/ai-pulse/

## Features

- **AI Frontier / Tech / Jobs** — aggregated from HN, GitHub, HF, dev.to, arXiv, etc.
- **Telecom (SEA)** — Vietnam + Cambodia × Huawei / Ericsson / Nokia / Samsung / ZTE
- Country tabs, vendor chips, bilingual cards (EN primary + original subtitle)
- Social discovery: Reddit, X, Facebook (via Google News `site:`)

## Local dev

```bash
git clone https://github.com/cw-AGI/ai-pulse.git
cd ai-pulse

# Fetch once (writes data.json at repo root)
node scripts/fetch-data.mjs

# Preview
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

## Daily update

| Mode | How |
|------|-----|
| **GitHub Actions** | Auto-runs daily at 00:00 UTC → commits `data.json` |
| **Local cron** | `scripts/run-daily.sh` |

Optional translation (vi/km → en):

```bash
export DEEPL_AUTH_KEY=your-key
node scripts/fetch-data.mjs
```

Add `DEEPL_AUTH_KEY` as a GitHub Actions secret for server-side translation.

## Files

| Path | Role |
|------|------|
| `index.html` | Frontend (GitHub Pages entry) |
| `data.json` | Daily snapshot |
| `scripts/fetch-data.mjs` | Main aggregator |
| `scripts/sea-telecom-config.mjs` | VN/KH feeds, vendor matrix |
| `scripts/sea-telecom.mjs` | Classification + translation |
| `scripts/run-daily.sh` | Local cron wrapper |
| `.github/workflows/update-data.yml` | Daily fetch workflow |
