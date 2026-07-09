export const JOB_SEARCH_QUERIES = [
  "AI Vietnam jobs",
  "machine learning Vietnam jobs",
  "LLM Vietnam jobs",
  "telecom Vietnam jobs",
  "5G Vietnam jobs",
  "network engineer Vietnam jobs",
  "AI China jobs",
  "machine learning China jobs",
  "LLM China jobs",
  "telecom China jobs",
  "5G China jobs",
  "network engineer China jobs",
];

export const JOB_PORTAL_SEARCHES = [
  {
    title: "Vietnam AI jobs - ITviec",
    snippet: "Vietnam · AI / machine learning engineering roles · ITviec search",
    url: "https://itviec.com/it-jobs?query=AI",
    country: "VN",
    countries: ["VN"],
    sourceLabel: "ITviec",
  },
  {
    title: "Vietnam telecom and 5G jobs - VietnamWorks",
    snippet: "Vietnam · telecom / 5G / network engineering roles · VietnamWorks search",
    url: "https://www.vietnamworks.com/viec-lam?q=5G%20telecom",
    country: "VN",
    countries: ["VN"],
    sourceLabel: "VietnamWorks",
  },
  {
    title: "Vietnam machine learning jobs - TopCV",
    snippet: "Vietnam · machine learning / data science roles · TopCV search",
    url: "https://www.topcv.vn/tim-viec-lam-machine-learning",
    country: "VN",
    countries: ["VN"],
    sourceLabel: "TopCV",
  },
  {
    title: "China AI jobs - Liepin",
    snippet: "China · AI / machine learning roles · Liepin search",
    url: "https://www.liepin.com/zhaopin/?key=AI",
    country: "CN",
    countries: ["CN"],
    sourceLabel: "Liepin",
  },
  {
    title: "China telecom and 5G jobs - Zhaopin",
    snippet: "China · telecom / 5G / network engineering roles · Zhaopin search",
    url: "https://sou.zhaopin.com/?kw=5G%20%E9%80%9A%E4%BF%A1",
    country: "CN",
    countries: ["CN"],
    sourceLabel: "Zhaopin",
  },
  {
    title: "China AI engineering jobs - BOSS Zhipin",
    snippet: "China · artificial intelligence / AI engineering roles · BOSS Zhipin search",
    url: "https://www.zhipin.com/web/geek/job?query=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD",
    country: "CN",
    countries: ["CN"],
    sourceLabel: "BOSS Zhipin",
  },
];

const COUNTRY_PATTERNS = [
  {
    id: "VN",
    terms: [
      "vietnam", "viet nam", "viet-nam", "việt nam", "hanoi", "ha noi",
      "ho chi minh", "hcmc", "saigon", "da nang", "viettel", "vnpt",
      "mobifone", "vinaphone",
    ],
  },
  {
    id: "CN",
    terms: [
      "china", "chinese", "mainland china", "beijing", "shanghai",
      "shenzhen", "guangzhou", "hangzhou", "chengdu", "hong kong",
      "中国", "北京", "上海", "深圳", "广州", "杭州", "成都", "香港",
    ],
  },
];

const JOB_DOMAIN_RE = /\b(ai|artificial intelligence|ml|machine learning|llm|large language model|nlp|deep learning|genai|generative ai|mlops|data scientist|data engineer|telecom|telecommunications|5g|6g|open ran|ran|radio access|wireless|rf engineer|core network|network engineer|lte|fiber|fibre|broadband|carrier network|operator network)\b|人工智能|机器学习|深度学习|大模型|算法工程师|数据科学|数据工程|通信|电信|无线|核心网|网络工程|光纤|宽带/i;

function jobText(job) {
  const meta = Array.isArray(job?.meta)
    ? job.meta.flatMap(pair => Array.isArray(pair) ? pair : []).filter(Boolean).join(" ")
    : "";
  return [
    job?.title,
    job?.snippet,
    job?.description,
    job?.company_name,
    job?.candidate_required_location,
    job?.location,
    meta,
  ].filter(Boolean).join(" ");
}

export function classifyJobCountries(job) {
  const text = jobText(job).toLowerCase();
  return COUNTRY_PATTERNS
    .filter(country => country.terms.some(term => text.includes(term.toLowerCase())))
    .map(country => country.id);
}

export function isTargetJob(job) {
  return classifyJobCountries(job).length > 0 && JOB_DOMAIN_RE.test(jobText(job));
}

export function countryLabel(id) {
  return id === "VN" ? "Vietnam" : id === "CN" ? "China" : id;
}
