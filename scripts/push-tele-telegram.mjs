#!/usr/bin/env node
/** Push new Vietnam / Cambodia telecom items to stdout (for Hermes Telegram). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(DIR, "data.json")) ? DIR : join(DIR, "..");
const DATA = process.env.AIPULSE_DATA || join(ROOT, "data.json");
const STATE = process.env.AIPULSE_NOTIFY_STATE || join(ROOT, ".tele-notify-state.json");
const MAX_PER_COUNTRY = Number(process.env.AIPULSE_NOTIFY_MAX || 8);
const MAX_TOTAL = Number(process.env.AIPULSE_NOTIFY_MAX_TOTAL || 15);

const COUNTRY_LABELS = {
  VN: "🇻🇳 Vietnam",
  KH: "🇰🇭 Cambodia",
};

function loadState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); }
  catch { return { seen: {}, lastPush: null }; }
}

function saveState(state) {
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

function itemCountry(it) {
  return it.country || (it.countries && it.countries[0]) || null;
}

function srcLabel(src) {
  return { reddit: "Reddit", x: "X", facebook: "Facebook", gnews: "News", local: "Local", hn: "HN", bsky: "Bluesky", masto: "Mastodon" }[src] || src;
}

function clip(s, n = 120) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function buildMessage(items, generatedAt) {
  const date = generatedAt ? new Date(generatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const lines = [`📡 AIPulse SEA Telecom · ${date}`, ""];
  for (const code of ["VN", "KH"]) {
    const group = items.filter(it => itemCountry(it) === code);
    if (!group.length) continue;
    lines.push(`${COUNTRY_LABELS[code]} (${group.length})`);
    group.slice(0, MAX_PER_COUNTRY).forEach(it => {
      const vendor = it.vendor ? `[${it.vendor}] ` : "";
      const src = srcLabel(it.src);
      lines.push(`• ${vendor}${clip(it.title, 100)}`);
      lines.push(`  ${src} · ${it.url}`);
    });
    if (group.length > MAX_PER_COUNTRY) lines.push(`  … +${group.length - MAX_PER_COUNTRY} more`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function main() {
  if (!existsSync(DATA)) {
    console.error("push-tele: data.json not found:", DATA);
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const tele = (data.tele || [])
    .filter(it => ["VN", "KH"].includes(itemCountry(it)))
    .sort((a, b) => (b.time || 0) - (a.time || 0));

  const state = loadState();
  const seen = state.seen || {};
  const fresh = tele.filter(it => it.url && !seen[it.url]).slice(0, MAX_TOTAL);

  if (!fresh.length) {
    if (process.env.AIPULSE_NOTIFY_VERBOSE) console.error("push-tele: no new VN/KH items");
    return;
  }

  const msg = buildMessage(fresh, data.meta?.generatedAt);
  const now = new Date().toISOString();
  for (const it of fresh) {
    if (it.url) seen[it.url] = { at: now, title: clip(it.title, 80), country: itemCountry(it) };
  }
  saveState({ seen, lastPush: now, count: fresh.length });
  process.stdout.write(msg);
}

main();
