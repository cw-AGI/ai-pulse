/** Load agent-curated SEA telecom items → merge into tele column */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyText } from "./sea-telecom.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(DIR, "data.json")) ? DIR : join(DIR, "..");

const DEFAULT_PATH = join(ROOT, "curated", "sea-telecom.json");

export function loadCuratedSea(path = process.env.AIPULSE_CURATED || DEFAULT_PATH) {
  if (!existsSync(path)) {
    console.warn("curated: no file at", path);
    return [];
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const items = Array.isArray(raw) ? raw : (raw.items || []);
    return items.map(normalizeCurated).filter(Boolean);
  } catch (e) {
    console.warn("curated: parse error", e.message);
    return [];
  }
}

function normalizeCurated(it) {
  if (!it?.title || !it?.url) return null;
  const blob = `${it.title} ${it.snippet || ""}`;
  const cls = classifyText(blob, it.country || null);
  const country = it.country || cls.country;
  const vendor = it.vendor || cls.vendor;
  const time = it.time || (it.collectedAt ? Date.parse(it.collectedAt) : Date.now());
  const sourceLabel = it.sourceLabel || it.sourceSite || "Research";
  const collectFrom = it.collectFrom || "agent-research";

  return {
    src: "curated",
    title: it.title,
    url: it.url,
    snippet: (it.snippet || "").slice(0, 240),
    time,
    lang: "en",
    country,
    countries: (it.countries && it.countries.length) ? it.countries : (cls.countries.length ? cls.countries : (country ? [country] : [])),
    vendor,
    vendors: it.vendors || cls.vendors,
    sourceLabel,
    collectFrom,
    collectedBy: it.collectedBy || "agent",
    collectedAt: it.collectedAt || new Date(time).toISOString(),
    meta: [
      ["from", collectFrom],
      ["source", sourceLabel],
      ...(it.collectedBy ? [[null, it.collectedBy]] : []),
    ],
  };
}

export function mergeCuratedIntoTele(tele, curated) {
  const curatedUrls = new Set(curated.map(i => i.url));
  const rest = tele.filter(i => !curatedUrls.has(i.url));
  return [...curated, ...rest].sort((a, b) => (b.time || 0) - (a.time || 0));
}
