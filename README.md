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

## Daily schedule (automatic)

**Vietnam time (Mac local clock = ICT):**

| Time | Script | Action |
|------|--------|--------|
| **08:20** | `run-morning-820.sh` | Fetch RSS + curated → `data.json` → **push GitHub** |
| **08:30** | `run-morning-830.sh` | Push **new** VN/KH items → **Telegram** (Hermes) |

One-time install (macOS launchd):

```bash
./install-schedule.sh
```

Log: `/tmp/aipulse-morning.log`

Manual full run: `./run-daily.sh` (= 820 + 830 back-to-back)

### crontab alternative

```bash
20 8 * * * /Users/cw/llm-workspace/个人工具箱/AI\ news\ fetch/run-morning-820.sh
30 8 * * * /Users/cw/llm-workspace/个人工具箱/AI\ news\ fetch/run-morning-830.sh
```

### Agent curated intel

Before 08:20, agents add web research to `curated/sea-telecom.json` — merged at fetch time.

### Native-language sources (vi / km / zh)

Auto-fetched and **translated to English** at 08:20 (DeepL or MyMemory):

| Lang | Sources |
|------|---------|
| **Vietnamese** | VnExpress, Bao Dau Tu, BBC Tiếng Việt, Google News VI |
| **Khmer** | AMS Economy, Post Khmer, Google News KH |
| **Chinese** | VietnamPlus 中文, 联合早报/C114 via Google News CN |

Cards show: English title + italic `title_orig` + `VI`/`KM`/`ZH` lang badge + source site tag.

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

## Tech stack column

- Sources: GitHub AI repos + **Agent Skills** + Hugging Face models
- Sort: **recent update first** (`pushed_at` / `lastModified`) — not total-star ranking
- Skill seeds always kept near top after the freshest updates: `anthropics/skills`, `obra/superpowers`, `vercel-labs/skills`, `VoltAgent/awesome-agent-skills`, `addyosmani/agent-skills`
- HF capped so it does not flood the column; Skill chip filters `src=skill`

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
