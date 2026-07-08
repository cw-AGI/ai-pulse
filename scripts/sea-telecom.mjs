/** SEA Telecom pipeline — VN/KH × Huawei/Ericsson/Nokia/Samsung/ZTE */
import {
  VENDORS, COUNTRIES, LOCAL_FEEDS, NATIVE_FEEDS, GNEWS_NATIVE,
  GNEWS_QUERIES, SOCIAL_GNEWS_QUERIES, REDDIT_SUBS,
} from "./sea-telecom-config.mjs";

const DEEPL_KEY = process.env.DEEPL_AUTH_KEY || process.env.DEEPL_API_KEY || "";
const TRANSLATE_MAX = Number(process.env.AIPULSE_TRANSLATE_MAX || 50);
const TRANSLATE_DELAY = Number(process.env.AIPULSE_TRANSLATE_DELAY_MS || 350);

const decode = s => (s || "")
  .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1]) : "";
}
function pickLinkHref(block) {
  const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
  return m ? m[1] : "";
}

export function detectLang(text) {
  const t = text || "";
  if (/[\u1780-\u17FF]/.test(t)) return "km";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t)) return "vi";
  if (/[\u4e00-\u9fff]/.test(t)) return "zh";
  if (/^[A-Za-z0-9\s.,;:'"!?()\-–—%&@#+/]+$/.test(t.slice(0, 120))) return "en";
  return "en";
}

export function classifyText(text, feedCountry = null) {
  const blob = (text || "").toLowerCase();
  const vendors = VENDORS.filter(v => v.terms.some(term => blob.includes(term))).map(v => v.id);
  const countries = [];
  if (feedCountry) countries.push(feedCountry);
  for (const c of COUNTRIES) {
    if (c.terms.some(term => blob.includes(term))) countries.push(c.id);
  }
  const uniq = [...new Set(countries)];
  return {
    vendor: vendors[0] || null,
    vendors,
    country: uniq[0] || null,
    countries: uniq,
  };
}

export function matchesSeaFocus(item) {
  const blob = `${item.title || ""} ${item.snippet || ""} ${item.url || ""}`.toLowerCase();
  const hasVendor = VENDORS.some(v => v.terms.some(t => blob.includes(t)));
  const hasCountry = item.country || (item.countries || []).length ||
    COUNTRIES.some(c => c.terms.some(t => blob.includes(t)));
  if (item.src === "local" && item.country) {
    const telecomKw = /\b(5g|6g|telecom|telecommunications|open\s*ran|base\s*station|fiber\s*optic|vnpt|viettel|mobifone|vinaphone|cellcard|metfone|smart\s+axiata|seatel|huawei|ericsson|nokia|samsung|zte)\b/i;
    return hasVendor || telecomKw.test(blob);
  }
  if (item.src?.startsWith("native-") && item.country) {
    const telecomKw = /\b(5g|6g|telecom|mạng|viễn thông|华为|中兴|爱立信|诺基亚|三星|电信|基站|ăng-ten|trạm|cellcard|metfone|smart|huawei|ericsson|nokia|samsung|zte)\b/i;
    return hasVendor || telecomKw.test(blob);
  }
  return hasVendor && hasCountry;
}

function socialSrcFromUrl(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("reddit.com")) return "reddit";
  if (u.includes("x.com") || u.includes("twitter.com")) return "x";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  return "gnews";
}

function parseFeed(xml, src, feedCountry = null, forcedLang = null) {
  const out = [];
  const parts = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const raw of parts) {
    const title = pick(raw, "title");
    let url = pickLinkHref(raw) || pick(raw, "link") || pick(raw, "guid") || pick(raw, "id");
    const dateStr = pick(raw, "pubDate") || pick(raw, "published") || pick(raw, "updated");
    const snippet = decode(pick(raw, "description") || pick(raw, "summary")).slice(0, 240);
    if (!title) continue;
    const cls = classifyText(`${title} ${snippet}`, feedCountry);
    const lang = forcedLang || detectLang(`${title} ${snippet}`);
    out.push({
      src,
      title,
      url: url.trim(),
      time: dateStr ? (Date.parse(dateStr) || Date.now()) : Date.now(),
      snippet,
      meta: feedCountry ? [["country", feedCountry]] : [],
      ...cls,
      lang,
    });
  }
  return out;
}

function gnewsUrl(query, lang = "en") {
  if (lang === "vi") return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=vi&gl=VN&ceid=VN:vi`;
  if (lang === "zh") return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  if (lang === "km") return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=KH&ceid=KH:en`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translateDeepL(text, from) {
  const body = new URLSearchParams({
    text,
    target_lang: "EN",
    ...(from && from !== "en" ? { source_lang: from.toUpperCase() } : {}),
  });
  const r = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${DEEPL_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const d = await r.json();
  return d.translations?.[0]?.text || text;
}

async function translateMyMemory(text, from) {
  const pairMap = { vi: "vi|en", zh: "zh-CN|en", km: "km|en" };
  const pair = pairMap[from] || `${from}|en`;
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${pair}`);
  if (!r.ok) throw new Error(`MyMemory ${r.status}`);
  const d = await r.json();
  if (d.responseStatus !== 200 && d.responseStatus !== "200") throw new Error("MyMemory quota");
  return d.responseData?.translatedText || text;
}

async function translateOne(text, from) {
  if (!text || from === "en" || detectLang(text) === "en") return text;
  if (DEEPL_KEY) {
    try { return await translateDeepL(text, from); } catch (e) { console.warn("DeepL", e.message); }
  }
  try { return await translateMyMemory(text, from === "km" ? "km" : from); }
  catch (e) { console.warn("MyMemory", e.message); return text; }
}

export async function enrichEnglish(items) {
  let used = 0;
  const out = [];
  for (const it of items) {
    const lang = it.lang || detectLang(`${it.title} ${it.snippet}`);
    if (lang === "en" || used >= TRANSLATE_MAX) {
      out.push({ ...it, lang: lang === "en" ? "en" : lang });
      continue;
    }
    const titleOrig = it.title;
    const snippetOrig = it.snippet || "";
    let title = titleOrig;
    let snippet = snippetOrig;
    try {
      title = await translateOne(titleOrig, lang);
      if (snippetOrig) snippet = await translateOne(snippetOrig, lang);
      used++;
      if (TRANSLATE_DELAY) await sleep(TRANSLATE_DELAY);
    } catch (e) {
      console.warn("translate", e.message);
    }
    out.push({
      ...it,
      lang,
      title_orig: titleOrig !== title ? titleOrig : undefined,
      snippet_orig: snippetOrig && snippetOrig !== snippet ? snippetOrig : undefined,
      title,
      snippet,
    });
  }
  return out;
}

export function makeFetchers(getText, getJSON) {
  async function getRedditJSON(url) {
    return getJSON(url, {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
  }

  async function srcNativeFeeds() {
    const cut = Date.now() - 14 * 86400 * 1000;
    const feeds = NATIVE_FEEDS.filter(([, , , url]) => url);
    const res = await Promise.allSettled(feeds.map(async ([name, country, lang, url]) => {
      try {
        const xml = await getText(url);
        return parseFeed(xml, `native-${lang}`, country, lang).map(i => ({
          ...i, source: name, sourceLabel: name, collectFrom: "native-rss",
        }));
      } catch (e) {
        console.warn("native-feed", name, e.message);
        return [];
      }
    }));
    return res.flatMap(r => r.status === "fulfilled" ? r.value : [])
      .filter(i => i.time > cut && matchesSeaFocus(i));
  }

  async function srcGNewsNative() {
    const cut = Date.now() - 14 * 86400 * 1000;
    const res = await Promise.allSettled(GNEWS_NATIVE.map(({ q, country, lang }) =>
      getText(gnewsUrl(q, lang)).then(xml =>
        parseFeed(xml, `native-${lang}`, country, lang).map(i => ({
          ...i,
          sourceLabel: lang === "zh" ? "Google News CN" : lang === "vi" ? "Google News VI" : "Google News",
          collectFrom: "native-gnews",
          meta: [["query", q.slice(0, 36)]],
        })),
      )));
    return res.flatMap(r => r.status === "fulfilled" ? r.value : [])
      .filter(i => i.time > cut && matchesSeaFocus(i));
  }

  async function srcLocalFeeds() {
    const cut = Date.now() - 14 * 86400 * 1000;
    const res = await Promise.allSettled(LOCAL_FEEDS.map(async ([name, country, url]) => {
      try {
        const xml = await getText(url);
        return parseFeed(xml, "local", country).map(i => ({ ...i, source: name }));
      } catch (e) {
        console.warn("local-feed", name, e.message);
        return [];
      }
    }));
    return res.flatMap(r => r.status === "fulfilled" ? r.value : [])
      .filter(i => i.time > cut && matchesSeaFocus(i));
  }

  async function srcGNews(queries, social = false) {
    const cut = Date.now() - 14 * 86400 * 1000;
    const batch = queries.slice(0, social ? 24 : 20);
    const res = await Promise.allSettled(batch.map(q =>
      getText(gnewsUrl(q)).then(xml => {
        const src = social ? "social" : "gnews";
        return parseFeed(xml, src).map(i => {
          const s = social ? socialSrcFromUrl(i.url) : "gnews";
          return { ...i, src: s, meta: [["query", q.slice(0, 40)]] };
        });
      })));
    return res.flatMap(r => r.status === "fulfilled" ? r.value : [])
      .filter(i => i.time > cut && matchesSeaFocus(i));
  }

  async function srcRedditSEA() {
    const vendorTerms = VENDORS.map(v => v.id);
    const countryTerms = ["vietnam", "cambodia", "vnpt", "viettel", "cellcard"];
    const out = [];

    async function fromJson(sub) {
      const d = await getRedditJSON(`https://www.reddit.com/r/${sub}/top.json?t=month&limit=25`);
      (d.data?.children || []).forEach(ch => pushPost(ch.data));
    }
    async function fromRss(sub) {
      const xml = await getText(`https://www.reddit.com/r/${sub}/top/.rss?t=month`);
      parseFeed(xml, "reddit").forEach(pushPostRss);
    }
    function pushPost(p) {
      if (!p || p.stickied) return;
      const blob = `${p.title} ${p.selftext || ""}`.toLowerCase();
      const hitVendor = vendorTerms.some(v => blob.includes(v.toLowerCase()));
      const hitCountry = countryTerms.some(c => blob.includes(c));
      if (!hitVendor || !hitCountry) return;
      const cls = classifyText(blob);
      out.push({
        src: "reddit",
        title: p.title,
        author: "r/" + p.subreddit,
        snippet: (p.selftext || "").slice(0, 220),
        url: p.permalink?.startsWith("http") ? p.permalink : "https://www.reddit.com" + p.permalink,
        time: (p.created_utc || 0) * 1000 || Date.now(),
        meta: [["pts", p.ups || 0], ["cmt", p.num_comments || 0]],
        lang: detectLang(p.title),
        ...cls,
      });
    }
    function pushPostRss(i) {
      const blob = `${i.title} ${i.snippet}`.toLowerCase();
      const hitVendor = vendorTerms.some(v => blob.includes(v.toLowerCase()));
      const hitCountry = countryTerms.some(c => blob.includes(c));
      if (!hitVendor || !hitCountry) return;
      const cls = classifyText(blob);
      const sub = (i.url || "").match(/reddit\.com\/r\/([^/]+)/i);
      out.push({ ...i, src: "reddit", author: sub ? "r/" + sub[1] : "reddit", ...cls });
    }

    for (const sub of REDDIT_SUBS) {
      try { await fromJson(sub); }
      catch (e) {
        console.warn("reddit-sea", sub, e.message, "→ trying RSS");
        try { await fromRss(sub); } catch (e2) { console.warn("reddit-rss", sub, e2.message); }
      }
    }
    return out;
  }

  async function buildSeaTelecom() {
    console.log("SEA telecom: fetching local + native(vi/km/zh) + gnews + social + reddit…");
    const [local, native, gnewsNative, gnews, social, reddit] = await Promise.all([
      srcLocalFeeds(),
      srcNativeFeeds(),
      srcGNewsNative(),
      srcGNews(GNEWS_QUERIES, false),
      srcGNews(SOCIAL_GNEWS_QUERIES, true),
      srcRedditSEA(),
    ]);
    const raw = [...local, ...native, ...gnewsNative, ...gnews, ...social, ...reddit];
    console.log(`SEA telecom raw: local=${local.length} native=${native.length} gnewsNative=${gnewsNative.length} gnews=${gnews.length} social=${social.length} reddit=${reddit.length}`);
    const enriched = await enrichEnglish(raw);
    return enriched.sort((a, b) => b.time - a.time);
  }

  return { buildSeaTelecom, matchesSeaFocus, classifyText };
}
