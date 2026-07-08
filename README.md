# AIPulse v3.1 — SEA Telecom Watch

Local-first daily aggregator for **Vietnam + Cambodia** telecom news across **Huawei, Ericsson, Nokia, Samsung, ZTE**.

## Quick start

```bash
cd "/Users/cw/llm-workspace/个人工具箱/AI news fetch"

# Fetch once (writes data.json)
node fetch-data.mjs
# or
./run-daily.sh

# View
python3 -m http.server 8766
# open http://127.0.0.1:8766/
```

## Daily schedule (local)

```bash
# crontab -e — run every day at 08:00
0 8 * * * /Users/cw/llm-workspace/个人工具箱/AI\ news\ fetch/run-daily.sh >> /tmp/aipulse-fetch.log 2>&1
```

`run-daily.sh` = fetch `data.json` + **push new VN/KH headlines to Telegram** (Hermes).

### Telegram push (Vietnam + Cambodia)

```bash
./push-tele-telegram.sh    # push only (after fetch)
./run-daily.sh             # fetch + push
```

Route: `~/llm-workspace/bin/notify.sh` → `hermes send --to telegram`.  
Dedup: `.tele-notify-state.json` (same URL never sent twice).

```bash
export AIPULSE_NOTIFY_MAX=8              # max items per country per message
export AIPULSE_NOTIFY_TARGET=telegram    # or telegram:chat_id:topic_id
```

> GitHub Actions updates the web page only; **Telegram runs on your Mac** (cron / `run-daily.sh`).

## Curated intel (agent / web research)

Automated fetch **plus** hand-picked items in `curated/sea-telecom.json` — merged every run.

- UI badge: **Curated** + source site (Reuters, Developing Telecoms, …)
- `collectFrom`: `web-search`, `web-fetch`, `agent-analysis`
- See `curated/README.md` for how agents add entries


Non-English titles/snippets are translated to **English** at fetch time. English sources are kept as-is; originals are stored in `title_orig` / `snippet_orig`.

| Provider | Env var | Notes |
|----------|---------|-------|
| **DeepL** (recommended) | `DEEPL_AUTH_KEY` | Best for Vietnamese |
| **MyMemory** (fallback) | — | Free, no key; used when DeepL absent |

```bash
export DEEPL_AUTH_KEY=your-deepl-free-key
export AIPULSE_TRANSLATE_MAX=50   # optional cap per run
node fetch-data.mjs
```

## Sources (telecom column)

| Type | Coverage |
|------|----------|
| **Local RSS** | VnExpress Int'l, Vietnam News, Khmer Times, Phnom Penh Post |
| **Google News** | Vendor × country matrix (EN queries) |
| **Social discovery** | Reddit, X, Facebook via `site:` Google News RSS (no API keys) |
| **Reddit** | r/VietNam, r/cambodia, r/telecom, … filtered by vendor+country |
| **Global telecom** | RCR, Light Reading, HN, Bluesky, Mastodon (SEA-matched only) |

> **Facebook / X**: Direct APIs require keys or paid access. Phase 1 uses Google News `site:` discovery — coverage is partial but zero-config.

## Data fields (tele items)

```json
{
  "src": "local|gnews|reddit|x|facebook|hn|…",
  "title": "English headline",
  "title_orig": "Vietnamese original (if translated)",
  "snippet": "English summary",
  "country": "VN",
  "vendor": "Huawei",
  "lang": "vi",
  "url": "…",
  "time": 1710000000000
}
```

## UI filters

- **Country chips**: Vietnam, Cambodia
- **Vendor chips**: Huawei, Ericsson, Nokia, Samsung, ZTE
- **Social hot**: Reddit, X, Facebook, Bluesky, Mastodon
- Cards show **English primary** + italic original subtitle

## Files

| File | Role |
|------|------|
| `fetch-data.mjs` | Main aggregator |
| `sea-telecom-config.mjs` | VN/KH feeds, vendor matrix, queries |
| `sea-telecom.mjs` | Classification, translation, SEA pipeline |
| `run-daily.sh` | Cron wrapper (fetch + Telegram) |
| `push-tele-telegram.mjs` | Format VN/KH items for Telegram |
| `push-tele-telegram.sh` | Send via Hermes (`notify.sh`) |
| `data.json` | Daily snapshot (generated) |
| `index.html` | Frontend |
