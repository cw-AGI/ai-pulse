/** SEA Telecom watch config — Vietnam + Cambodia × vendor matrix */
export const VENDORS = [
  { id: "Huawei", terms: ["huawei"] },
  { id: "Ericsson", terms: ["ericsson"] },
  { id: "Nokia", terms: ["nokia"] },
  { id: "Samsung", terms: ["samsung", "samsung networks"] },
  { id: "ZTE", terms: ["zte"] },
];

export const COUNTRIES = [
  {
    id: "VN",
    label: "Vietnam",
    terms: [
      "vietnam", "viet nam", "việt nam", "hanoi", "ha noi", "ho chi minh",
      "saigon", "vnpt", "viettel", "mobifone", "vinaphone",
    ],
  },
  {
    id: "KH",
    label: "Cambodia",
    terms: [
      "cambodia", "cambodian", "phnom penh", "khmer", "cellcard",
      "smart axiata", "metfone", "seatel",
    ],
  },
];

/** English-first local / regional feeds */
export const LOCAL_FEEDS = [
  ["VnExpress Int'l", "VN", "https://e.vnexpress.net/rss/news.rss"],
  ["Vietnam News", "VN", "https://vietnamnews.vn/rss/home.rss"],
  ["Khmer Times", "KH", "https://www.khmertimeskh.com/feed/"],
  ["The Phnom Penh Post", "KH", "https://www.phnompenhpost.com/rss"],
];

/** Google News RSS search templates (en). {vendor} {country} telecom */
export const GNEWS_QUERIES = [];
for (const v of VENDORS) {
  for (const c of COUNTRIES) {
    GNEWS_QUERIES.push(`${v.id} ${c.label} telecom`);
    GNEWS_QUERIES.push(`${v.id} ${c.label} 5G`);
  }
}

/** Social discovery via Google News site: search (no API keys) */
export const SOCIAL_GNEWS_QUERIES = [];
for (const v of VENDORS) {
  for (const c of COUNTRIES) {
    SOCIAL_GNEWS_QUERIES.push(`site:reddit.com ${v.id} ${c.label} telecom`);
    SOCIAL_GNEWS_QUERIES.push(`site:x.com ${v.id} ${c.label}`);
    SOCIAL_GNEWS_QUERIES.push(`site:twitter.com ${v.id} ${c.label}`);
    SOCIAL_GNEWS_QUERIES.push(`site:facebook.com ${v.id} ${c.label} telecom`);
  }
}

export const REDDIT_SUBS = [
  "VietNam", "cambodia", "telecom", "networking", "5G", "cellular",
];
