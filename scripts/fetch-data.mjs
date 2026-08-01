#!/usr/bin/env node
/* ============================================================
   AIPulse 每日数据抓取（本地 cron 或 GitHub Actions，无跨域限制）
   零依赖（Node 20+ 内置 fetch）。聚合多源 → 写出同源 data.json。
   输出条目：{src,title,url,time(ms),snippet?,meta?,country?,vendor?,lang?,title_orig?}
   通讯栏 SEA：越南+柬埔寨 × Huawei/Ericsson/Nokia/Samsung/ZTE + 社交发现
   ============================================================ */
import { writeFileSync } from "node:fs";
import { makeFetchers } from "./sea-telecom.mjs";
import { loadCuratedSea, mergeCuratedIntoTele } from "./curated.mjs";
import {
  JOB_PORTAL_SEARCHES,
  JOB_SEARCH_QUERIES,
  classifyJobCountries,
  countryLabel,
  isTargetJob,
} from "./jobs-filter.mjs";

const UA = "AIPulse/3.1 (+local daily; sea-telecom)";
const GH_TOKEN = process.env.GITHUB_TOKEN || "";

// 关注的大类关键词（用于 HN / GitHub / 招聘过滤）
const NEWS_QUERIES = ["AI", "LLM", "large language model"];

// AI 实验室 / 媒体 RSS（浏览器拿不到、服务端可取）。失效的会自动跳过，可自行增删。
const FEEDS = [
  ["Hugging Face", "https://huggingface.co/blog/feed.xml"],
  ["BAIR", "https://bair.berkeley.edu/blog/feed.xml"],
  ["Google AI", "https://blog.google/technology/ai/rss/"],
  ["MIT News AI", "https://news.mit.edu/rss/topic/artificial-intelligence2"],
  ["The Gradient", "https://thegradient.pub/rss/"],
  ["OpenAI", "https://openai.com/news/rss.xml"],
  ["Anthropic", "https://www.anthropic.com/rss.xml"],
];

// 通讯/无线行业 RSS（5G/6G/Open RAN/运营商/设备商等）。同样失效自动跳过。
const TELECOM_FEEDS = [
  ["RCR Wireless", "https://www.rcrwireless.com/feed"],
  ["Telecoms.com", "https://www.telecoms.com/feed/"],
  ["Telecom Ramblings", "https://www.telecomramblings.com/feed/"],
  ["Light Reading", "https://www.lightreading.com/rss.xml"],
  ["Fierce Network", "https://www.fierce-network.com/rss.xml"],
  ["Mobile World Live", "https://www.mobileworldlive.com/feed/"],
  ["Telecompaper", "https://www.telecompaper.com/rss/news"],
];
const TELECOM_HN = ["5G", "6G", "Open RAN", "telecom", "Starlink", "fiber network"];

// ---------- 基础工具 ----------
async function withTimeout(p, ms = 20000) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  try { return await p(c.signal); } finally { clearTimeout(id); }
}
async function getJSON(url, headers = {}) {
  return withTimeout(async (signal) => {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json", ...headers }, signal });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  });
}
async function getRedditJSON(url) {
  return getJSON(url, {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
}
async function getText(url, headers = {}) {
  return withTimeout(async (signal) => {
    const r = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.text();
  });
}
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
function pickLinkHref(block) {            // Atom: <link href="..."/>
  const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
  return m ? m[1] : "";
}

// ---------- 解析 RSS / Atom ----------
function parseFeed(xml, src) {
  const out = [];
  const parts = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const raw of parts) {
    const b = raw;
    const title = pick(b, "title");
    let url = pickLinkHref(b) || pick(b, "link") || pick(b, "guid") || pick(b, "id");
    const dateStr = pick(b, "pubDate") || pick(b, "published") || pick(b, "updated") || pick(b, "dc:date");
    if (!title) continue;
    out.push({ src, title, url: url.trim(), time: dateStr ? (Date.parse(dateStr) || Date.now()) : Date.now(),
      snippet: pick(b, "description") || pick(b, "summary") ? (pick(b, "description") || pick(b, "summary")).slice(0, 220) : "", meta: [] });
  }
  return out;
}

// ---------- 各数据源 ----------
async function srcHNStories() {
  const since = Math.floor(Date.now() / 1000) - 4 * 86400;   // 近 4 天
  const all = [];
  for (const q of NEWS_QUERIES) {
    try {
      const d = await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since},points>15&hitsPerPage=40`);
      (d.hits || []).forEach(h => { if (h.title) all.push({ src: "hn", title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        time: h.created_at_i * 1000, meta: [["pts", h.points || 0], ["cmt", h.num_comments || 0]] }); });
    } catch (e) { console.warn("HN", q, e.message); }
  }
  return all;
}
async function srcDevto() {
  try {
    const d = await getJSON(`https://dev.to/api/articles?tag=ai&per_page=25&top=2`);
    return (d || []).map(a => ({ src: "dev", title: a.title, url: a.url, time: Date.parse(a.published_at) || Date.now(),
      meta: [["likes", a.positive_reactions_count || 0], ["cmt", a.comments_count || 0]] }));
  } catch (e) { console.warn("devto", e.message); return []; }
}
async function srcArxiv() {
  try {
    const url = "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=40";
    const xml = await getText(url);
    return xml.split(/<entry[\s>]/i).slice(1).map(raw => {
      const title = pick(raw, "title"); const id = pick(raw, "id");
      const pub = pick(raw, "published"); const sum = pick(raw, "summary");
      return title ? { src: "arxiv", title, url: id.trim(), time: Date.parse(pub) || Date.now(), snippet: sum.slice(0, 200), meta: [] } : null;
    }).filter(Boolean);
  } catch (e) { console.warn("arxiv", e.message); return []; }
}
async function srcFeeds() {
  const res = await Promise.allSettled(FEEDS.map(([name, url]) => getText(url).then(x => parseFeed(x, "dev").map(i => ({ ...i, source: name })))));
  const cut = Date.now() - 30 * 86400 * 1000;   // 近 30 天
  return res.flatMap(r => r.status === "fulfilled" ? r.value : []).filter(i => i.time > cut);
}
function mapGhRepo(r, src = "gh", extraMeta = []) {
  return {
    src,
    title: r.full_name,
    url: r.html_url,
    time: Date.parse(r.pushed_at) || Date.now(),
    snippet: r.description || "",
    meta: [["star", r.stargazers_count], [null, r.language || ""], ...extraMeta],
  };
}
function repoBlob(r) {
  const topics = Array.isArray(r.topics) ? r.topics.join(" ") : "";
  return `${r.full_name || ""} ${r.description || ""} ${topics}`.toLowerCase();
}
function isSkillRepo(r) {
  const t = repoBlob(r);
  const topics = Array.isArray(r.topics) ? r.topics.map(x => String(x).toLowerCase()) : [];
  if (topics.some(x => /agent-?skills?|claude-skills?|cursor-skills?/.test(x))) return true;
  return /(agent[- ]?skills?|claude[- ]?skills?|cursor[- ]?skills?|skill\.md|agentskills\.io|awesome-agent-skills)/.test(t)
    || (/\bsuperpowers\b/.test(t) && /\bskill/.test(t))
    || (/\bskills?\b/.test(t) && /(claude|cursor|codex|anthropic|agentic|llm|ai coding)/.test(t));
}
async function ghSearch(query, { sort = "updated", perPage = 30 } = {}) {
  const headers = { "Accept": "application/vnd.github+json", ...(GH_TOKEN ? { "Authorization": "Bearer " + GH_TOKEN } : {}) };
  const q = encodeURIComponent(query);
  const d = await getJSON(`https://api.github.com/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=${perPage}`, headers);
  return d.items || [];
}
async function srcGitHub() {
  // 热门 AI 仓池 + 按最近 push 置顶（合并阶段统一按 time 排序）
  const since = new Date(Date.now() - 21 * 86400 * 1000).toISOString().slice(0, 10);
  const out = [], seen = new Set();
  const queries = [
    `AI stars:>500 pushed:>${since}`,
    `LLM OR "large language model" stars:>300 pushed:>${since}`,
  ];
  for (const q of queries) {
    try {
      const items = await ghSearch(q, { sort: "updated", perPage: 40 });
      for (const r of items) {
        if (!r?.html_url || seen.has(r.html_url)) continue;
        if ((r.stargazers_count || 0) < 300) continue;
        seen.add(r.html_url);
        out.push(mapGhRepo(r, "gh"));
      }
    } catch (e) { console.warn("github", q, e.message); }
  }
  return out;
}
async function ghRepo(fullName) {
  const headers = { "Accept": "application/vnd.github+json", ...(GH_TOKEN ? { "Authorization": "Bearer " + GH_TOKEN } : {}) };
  return getJSON(`https://api.github.com/repos/${fullName}`, headers);
}
async function srcSkills() {
  // 种子仓（确认热门，始终保留）+ 搜索补充近期有更新的 skill
  const seedNames = [
    "anthropics/skills",
    "obra/superpowers",
    "vercel-labs/skills",
    "VoltAgent/awesome-agent-skills",
    "addyosmani/agent-skills",
  ];
  const queries = [
    "topic:agent-skills",
    "\"agent skills\" stars:>80",
    "\"claude skills\" OR \"cursor skills\" stars:>50",
    "superpowers in:name,description stars:>200",
    "awesome-agent-skills stars:>50",
  ];
  const seeds = [], rest = [], seen = new Set();
  for (const full of seedNames) {
    try {
      const r = await ghRepo(full);
      if (!r?.html_url || seen.has(r.html_url)) continue;
      seen.add(r.html_url);
      seeds.push(mapGhRepo(r, "skill", [["kind", "skill"], ["seed", "1"]]));
    } catch (e) { console.warn("skill-seed", full, e.message); }
  }
  for (const q of queries) {
    try {
      const items = await ghSearch(q, { sort: "updated", perPage: 30 });
      for (const r of items) {
        if (!r?.html_url || seen.has(r.html_url)) continue;
        if (!isSkillRepo(r)) continue;
        if ((r.stargazers_count || 0) < 30) continue;
        seen.add(r.html_url);
        rest.push(mapGhRepo(r, "skill", [["kind", "skill"]]));
      }
    } catch (e) { console.warn("skills", q, e.message); }
  }
  return { seeds, items: [...seeds, ...rest] };
}
async function srcHF() {
  // 热度池防刷；时间用 lastModified，合并后按更新置顶
  try {
    const d = await getJSON(`https://huggingface.co/api/models?sort=likes7d&direction=-1&limit=40`);
    const arr = Array.isArray(d) ? d : [];
    if (!arr.length) throw new Error("empty likes7d");
    return arr
      .filter(m => (m.likes || 0) >= 20 || (m.downloads || 0) >= 10000)
      .map(m => ({ src: "hf", title: m.id || m.modelId, url: `https://huggingface.co/${m.id || m.modelId}`,
        time: m.lastModified ? Date.parse(m.lastModified) : Date.now(), meta: [["likes", m.likes || 0], ["dl", fmtNum(m.downloads || 0)]] }));
  } catch (e) {
    try {
      const d = await getJSON(`https://huggingface.co/api/models?sort=likes&direction=-1&limit=30`);
      return (Array.isArray(d) ? d : [])
        .filter(m => (m.likes || 0) >= 50)
        .map(m => ({ src: "hf", title: m.id || m.modelId, url: `https://huggingface.co/${m.id || m.modelId}`,
          time: m.lastModified ? Date.parse(m.lastModified) : Date.now(), meta: [["likes", m.likes || 0], ["dl", fmtNum(m.downloads || 0)]] }));
    } catch (e2) { console.warn("hf", e2.message); return []; }
  }
}
async function srcJobs() {
  const out = [], seen = new Set();
  // 主力：Remotive 公共招聘 API（结构化、稳定，免 key）。结果只保留越南 / 中国的 AI 与通信岗位。
  for (const q of JOB_SEARCH_QUERIES) {
    try {
      const d = await getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`);
      (d.jobs || []).forEach(j => { if (!j.url || seen.has(j.url)) return; seen.add(j.url);
        const item = { src: "job", title: j.title,
          snippet: ["Remotive", j.company_name, j.candidate_required_location, j.salary].filter(Boolean).join(" · "),
          url: j.url, time: Date.parse(j.publication_date) || Date.now(),
          meta: [[null, j.job_type || ""]] };
        const countries = classifyJobCountries(item);
        if (isTargetJob(item)) out.push({ ...item, countries, country: countries[0],
          meta: [["region", countries.map(countryLabel).join("/")], ...item.meta] });
      });
    } catch (e) { console.warn("remotive", q, e.message); }
  }
  // 补充：HN 当月「Who is hiring」帖内的越南 / 中国 AI 与通信岗位
  try {
    const s = await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("Ask HN: Who is hiring")}&tags=story&hitsPerPage=10`);
    const hit = (s.hits || [])
      .filter(h => /^Ask HN: Who is hiring\?/i.test(h.title || ""))
      .sort((a, b) => b.created_at_i - a.created_at_i)[0];
    const hnQueries = ["Vietnam", "Viet Nam", "China", "Hong Kong", "Shanghai", "Shenzhen", "Beijing", "Hanoi", "Ho Chi Minh"];
    if (hit) for (const q of hnQueries) {
      try {
        const c = await getJSON(`https://hn.algolia.com/api/v1/search?tags=comment,story_${hit.objectID}&query=${encodeURIComponent(q)}&hitsPerPage=40`);
        (c.hits || []).forEach(h => { if (!h.comment_text || seen.has(h.objectID)) return; seen.add(h.objectID);
          const txt = decode(h.comment_text);
          const item = { src: "job", title: txt.split(/[|·\n]| - |\. /)[0].slice(0, 80), snippet: txt.slice(0, 240),
            url: `https://news.ycombinator.com/item?id=${h.objectID}`, time: h.created_at_i * 1000, meta: [] };
          const countries = classifyJobCountries(item);
          if (isTargetJob(item)) out.push({ ...item, countries, country: countries[0],
            meta: [["region", countries.map(countryLabel).join("/")]] });
        });
      } catch (e) {}
    }
  } catch (e) { console.warn("jobs-hn", e.message); }
  JOB_PORTAL_SEARCHES.forEach(entry => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    out.push({ src: "job", ...entry, time: Date.now(),
      meta: [["region", entry.countries.map(countryLabel).join("/")], ["source", entry.sourceLabel]] });
  });
  return out;
}
const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : "" + n;

async function srcTelecomFeeds() {
  const res = await Promise.allSettled(TELECOM_FEEDS.map(([name, url]) =>
    getText(url).then(x => parseFeed(x, "tele").map(i => ({ ...i, source: name })))));
  const cut = Date.now() - 30 * 86400 * 1000;
  return res.flatMap(r => r.status === "fulfilled" ? r.value : []).filter(i => i.time > cut);
}
async function srcTelecomHN() {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const all = [];
  for (const q of TELECOM_HN) {
    try {
      const d = await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since},points>8&hitsPerPage=15`);
      (d.hits || []).forEach(h => { if (h.title) all.push({ src: "hn", title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        time: h.created_at_i * 1000, meta: [["pts", h.points || 0], ["cmt", h.num_comments || 0]] }); });
    } catch (e) { console.warn("telecomHN", q, e.message); }
  }
  return all;
}

// ---------- 社交热帖：Bluesky（AT Protocol 公开 API）/ Mastodon（公开话题）----------
async function srcBluesky(q, max = 15) {
  try {
    const d = await getJSON(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=${max}&lang=en`);
    return (d.posts || []).map(p => {
      const text = (p.record && p.record.text || "").trim(), handle = p.author && p.author.handle, rkey = (p.uri || "").split("/").pop();
      if (!text || !handle) return null;
      return { src: "bsky", title: text.length > 90 ? text.slice(0, 90) + "…" : text, author: handle,
        snippet: text.length > 90 ? text : "", url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        time: Date.parse((p.record && p.record.createdAt) || p.indexedAt) || Date.now(),
        meta: [["likes", p.likeCount || 0], [null, "↻ " + (p.repostCount || 0)]] };
    }).filter(Boolean);
  } catch (e) { console.warn("bsky", q, e.message); return []; }
}
async function srcMastodon(tag, max = 12) {
  try {
    const d = await getJSON(`https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${max}`);
    return (d || []).map(s => { const text = decode(s.content || ""); if (!text) return null;
      return { src: "masto", title: text.length > 90 ? text.slice(0, 90) + "…" : text, author: s.account && s.account.acct,
        snippet: text.length > 90 ? text : "", url: s.url || s.uri, time: Date.parse(s.created_at) || Date.now(),
        meta: [["likes", s.favourites_count || 0], [null, "↻ " + (s.reblogs_count || 0)]] };
    }).filter(Boolean);
  } catch (e) { console.warn("masto", tag, e.message); return []; }
}

async function srcReddit(subs, max = 10) {
  const out = [];
  for (const sub of subs) {
    try {
      const d = await getRedditJSON(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=${max}`);
      (d.data && d.data.children || []).forEach(ch => { const p = ch.data; if (!p || p.stickied) return;
        out.push({ src: "reddit", title: p.title, author: "r/" + p.subreddit,
          snippet: (p.selftext || "").slice(0, 200), url: "https://www.reddit.com" + p.permalink,
          time: (p.created_utc || 0) * 1000 || Date.now(), meta: [["pts", p.ups || 0], ["cmt", p.num_comments || 0]] });
      });
    } catch (e) { console.warn("reddit", sub, e.message); }
  }
  return out;
}

// ---------- SEA 通讯（VN/KH × 五厂商）----------
const { buildSeaTelecom, matchesSeaFocus } = makeFetchers(getText, getJSON);

// ---------- 合并 / 去重 / 截断 ----------
function dedupe(items) {
  const seen = new Set();
  return items.filter(i => { const k = (i.url || i.title); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

(async () => {
  const [hn, dev, arxiv, feeds, gh, skillsPack, hf, jobs, teleFeeds, teleHN, teleSea, bskyAI, bskyTele, mastoAI, mastoTele, redditAI, redditTele] = await Promise.all([
    srcHNStories(), srcDevto(), srcArxiv(), srcFeeds(), srcGitHub(), srcSkills(), srcHF(), srcJobs(), srcTelecomFeeds(), srcTelecomHN(),
    buildSeaTelecom(),
    Promise.all([srcBluesky("AI"), srcBluesky("LLM")]).then(a => a.flat()),
    Promise.all([srcBluesky("5G"), srcBluesky("telecom")]).then(a => a.flat()),
    Promise.all([srcMastodon("AI"), srcMastodon("MachineLearning")]).then(a => a.flat()),
    Promise.all([srcMastodon("telecom"), srcMastodon("5G")]).then(a => a.flat()),
    srcReddit(["MachineLearning", "LocalLLaMA", "artificial"]),
    srcReddit(["telecom", "networking"])
  ]);
  const news = dedupe([...hn, ...dev, ...arxiv, ...feeds, ...bskyAI, ...mastoAI, ...redditAI]).sort((a, b) => b.time - a.time).slice(0, 90);
  // 技术栈：最近更新置顶；热门 skill 种子仓保送进榜；限制 HF 占比避免刷屏
  const byTime = (a, b) => (b.time || 0) - (a.time || 0);
  const skillSeeds = skillsPack?.seeds || [];
  const skillItems = skillsPack?.items || [];
  const skillFresh = dedupe(skillItems).sort(byTime).slice(0, 20);
  const ghPool = dedupe(gh).sort(byTime).slice(0, 25);
  const hfPool = dedupe(hf).sort(byTime).slice(0, 12);
  const pool = dedupe([...skillFresh, ...ghPool, ...hfPool]).sort(byTime);
  const seedUrls = new Set(skillSeeds.map(i => i.url));
  const freshest = pool.filter(i => !seedUrls.has(i.url)).slice(0, 8); // 最新动态先占前排
  const rest = pool.filter(i => !seedUrls.has(i.url) && !freshest.includes(i));
  const tech = dedupe([...freshest, ...skillSeeds.sort(byTime), ...rest]).slice(0, 60);
  const jobsList = dedupe(jobs).sort((a, b) => b.time - a.time).slice(0, 45);
  const teleGlobal = dedupe([...teleFeeds, ...teleHN, ...bskyTele, ...mastoTele, ...redditTele])
    .filter(i => matchesSeaFocus(i));
  const curated = loadCuratedSea();
  const teleMerged = mergeCuratedIntoTele(
    dedupe([...teleSea, ...teleGlobal]).sort((a, b) => b.time - a.time),
    curated,
  );
  const telecom = teleMerged.slice(0, 140);

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      keywords: NEWS_QUERIES,
      jobs: {
        countries: ["VN", "CN"],
        focus: ["AI", "machine learning", "LLM", "telecom", "5G", "network engineering"],
      },
      seaTelecom: {
        countries: ["VN", "KH"],
        vendors: ["Huawei", "Ericsson", "Nokia", "Samsung", "ZTE"],
        translate: !!(process.env.DEEPL_AUTH_KEY || process.env.DEEPL_API_KEY),
        curated: curated.length,
      },
      counts: { news: news.length, tech: tech.length, jobs: jobsList.length, tele: telecom.length },
    },
    news, tech, jobs: jobsList, tele: telecom,
  };

  writeFileSync("data.json", JSON.stringify(data, null, 0));
  console.log(`data.json written: news=${news.length} tech=${tech.length} jobs=${jobsList.length} tele=${telecom.length} (sea=${teleSea.length} curated=${curated.length})`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
