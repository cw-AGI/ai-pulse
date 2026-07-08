# Curated intel — agent / web research

Items here are **merged with automated RSS/social fetch** into the **Telecom** column at `fetch-data.mjs` run time.

## Add an entry

Edit `sea-telecom.json` → append to `items`:

```json
{
  "title": "Headline in English",
  "url": "https://…",
  "snippet": "1–2 sentence summary (optional)",
  "country": "VN",
  "vendor": "Huawei",
  "sourceLabel": "Reuters",
  "collectFrom": "web-search",
  "collectedBy": "cursor",
  "collectedAt": "2026-07-08T12:00:00Z",
  "time": 1740000000000
}
```

| Field | Meaning |
|-------|---------|
| `sourceLabel` | **Where the story was found** (Reuters, Developing Telecoms, …) — shown as UI badge |
| `collectFrom` | How it was gathered: `web-search`, `web-fetch`, `agent-analysis`, `pm-note` |
| `collectedBy` | Who added it: `cursor`, `claude`, `pm`, … |
| `country` | `VN` or `KH` |
| `vendor` | Huawei / Ericsson / Nokia / Samsung / ZTE (optional) |

Cards show **Curated** + source site tag (e.g. `Reuters`).

Then run `node fetch-data.mjs` or `./run-daily.sh`.
