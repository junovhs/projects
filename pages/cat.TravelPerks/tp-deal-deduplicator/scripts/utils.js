
// utils.js (enhanced)
// - Fuzzy vendor canonicalization (token/Jaccard + optional Levenshtein)
// - Safer ISO date normalization (date-only, timezone-agnostic)
// - HQ duplicate detection to reduce false "new" items
// - More robust HQ parsing (accepts 'v', 'vendor', flexible separators)

// === Supplier Mapping Placeholders (kept, expanded) ===
const knownSuppliers = [
  "Abercrombie & Kent",
  "Adventures by Disney",
  "African Travel",
  "Ama Waterways",
  "American Airline Vacations",
  "American Cruise Line",
  "Aulani, A Disney Resort & Spa",
  "Avalon Waterways",
  "Azamara",
  "Beaches",
  "BlueSky Tours",
  "Breathless",
  "Carnival",
  "Celebrity Cruises",
  "CIE Tours",
  "Club Med",
  "Collette",
  "CroisiEurope",
  "Crystal Cruises",
  "Cunard",
  "Delta Vacations",
  "Disney Cruise Line",
  "Disneyland",
  "DisneyWorld",
  "Dreams",
  "El Dorado Spa Resorts & Hotels",
  "Emerald Cruises",
  "Excellence Resorts",
  "Explora Journeys",
  "Four Seasons Yachts",
  "Funjet",
  "G Adventures",
  "Globus Journeys",
  "Great Safaris",
  "Hard Rock Hotels",
  "Holland America Line",
  "Hurtigruten",
  "Iberostar Hotels & Resorts",
  "Karisma Hotels & Resorts",
  "Lindblad Expeditions & National Geographic",
  "MSC Cruises",
  "Norwegian",
  "Oceania Cruises",
  "Outrigger Hotels & Resorts",
  "Palace Resorts",
  "Paul Gauguin Cruises",
  "Ponant",
  "Princess",
  "Project Expedition",
  "Regent Seven Seas Cruises",
  "Ritz-Carlton Yacht Collection",
  "RIU Hotels & Resorts",
  "Riverside Cruises",
  "Riviera River Cruises",
  "Rocky Mountaineer",
  "Royal Caribbean",
  "Sandals",
  "Scenic Eclipse Ocean Voyages",
  "Scenic River",
  "Seabourn",
  "Secrets",
  "Shore Excursions Group",
  "Silversea",
  "Southwest Vacations",
  "Star Clippers",
  "Tauck Cruises",
  "Tauck Tours",
  "TourSales.com",
  "Trafalgar",
  "UnCruise Adventures",
  "Uniworld",
  "United Vacations",
  "Viking Ocean",
  "Viking River",
  "Viator",
  "Virgin Voyages",
  "Villas of Distinction",
  "Windstar",
  "Zoëtry Wellness & Spa Resorts",
  // Not in original list but seen in aliasMapping
  "Atlas Ocean Voyages"
];

const aliasMapping = {
  "american airlines vacations": "American Airline Vacations",
  "american airline vacations": "American Airline Vacations",
  "american airlnes vacations": "American Airline Vacations",
  "aa vacations": "American Airline Vacations",
  "american airlines vacation": "American Airline Vacations",
  "american cruise lines": "American Cruise Line",
  "american cruise line": "American Cruise Line",

  "royal": "Royal Caribbean",
  "rccl": "Royal Caribbean",
  "rcc": "Royal Caribbean",
  "royal caribbean": "Royal Caribbean",
  "royal caribbean international": "Royal Caribbean",

  "norwegian": "Norwegian",
  "norwegian cruise": "Norwegian",
  "norwegian cruise line": "Norwegian",
  "ncl": "Norwegian",

  "disney cruise": "Disney Cruise Line",
  "disney cruises": "Disney Cruise Line",
  "disney cruise line": "Disney Cruise Line",

  "celebrity": "Celebrity Cruises",
  "celebrity cruises": "Celebrity Cruises",
  "celebrity cruise line": "Celebrity Cruises",

  "virgin": "Virgin Voyages",
  "virgin voyages": "Virgin Voyages",
  "virgin cruise": "Virgin Voyages",

  "holland": "Holland America Line",
  "holland america": "Holland America Line",
  "holland america line": "Holland America Line",

  "princess": "Princess",
  "princess cruises": "Princess",
  "carnival": "Carnival",
  "carnival cruise": "Carnival",
  "carnival cruises": "Carnival",

  "msc": "MSC Cruises",
  "msc cruises": "MSC Cruises",

  "viking": "Viking Ocean",
  "viking ocean": "Viking Ocean",
  "viking cruises": "Viking Ocean",

  "atlas": "Atlas Ocean Voyages",
  "atlas ocean": "Atlas Ocean Voyages",
  "atlas ocean voyages": "Atlas Ocean Voyages",

  "azamara": "Azamara",
  "crystal": "Crystal Cruises",
  "crystal cruises": "Crystal Cruises",
  "cunard": "Cunard",
  "cunard cruises": "Cunard",
  "emerald": "Emerald Cruises",
  "emerald cruises": "Emerald Cruises",
  "explora": "Explora Journeys",
  "explora journeys": "Explora Journeys",
  "four seasons": "Four Seasons Yachts",
  "four seasons yachts": "Four Seasons Yachts",
  "four seasons yacht": "Four Seasons Yachts",
  "funjet": "Funjet",
  "fun jet": "Funjet",
  "oceania": "Oceania Cruises",
  "oceania cruises": "Oceania Cruises",
  "paul gauguin": "Paul Gauguin Cruises",
  "paul gauguin cruises": "Paul Gauguin Cruises",
  "ponant": "Ponant",
  "ponant cruises": "Ponant",
  "regent": "Regent Seven Seas Cruises",
  "regent seven seas": "Regent Seven Seas Cruises",
  "seven seas": "Regent Seven Seas Cruises",
  "ritz-carlton": "Ritz-Carlton Yacht Collection",
  "ritz carlton": "Ritz-Carlton Yacht Collection",
  "ritz-carlton yacht": "Ritz-Carlton Yacht Collection",
  "seabourn": "Seabourn",
  "seabourn cruises": "Seabourn",
  "silversea": "Silversea",
  "silversea cruises": "Silversea",
  "star clippers": "Star Clippers",
  "star clipper": "Star Clippers",
  "tauck": "Tauck Cruises",
  "tauck cruises": "Tauck Cruises",
  "windstar": "Windstar",
  "viking river": "Viking River",
  "viking river cruises": "Viking River",
  "avalon": "Avalon Waterways",
  "avalon waterways": "Avalon Waterways",
  "ama": "Ama Waterways",
  "ama waterways": "Ama Waterways",
  "croisieurope": "CroisiEurope",
  "croisi europe": "CroisiEurope",
  "croisi-europe": "CroisiEurope",
  "riverside": "Riverside Cruises",
  "riverside cruises": "Riverside Cruises",
  "riviera": "Riviera River Cruises",
  "riviera river": "Riviera River Cruises",
  "riviera river cruises": "Riviera River Cruises",
  "tauck tours": "Tauck Tours",
  "tauck tour": "Tauck Tours",
  "uniworld": "Uniworld",
  "uniworld cruises": "Uniworld",
  "scenic river": "Scenic River",
  "lindblad": "Lindblad Expeditions & National Geographic",
  "lindblad expeditions": "Lindblad Expeditions & National Geographic",
  "national geographic": "Lindblad Expeditions & National Geographic",
  "hurtigruten": "Hurtigruten",
  "hurtigruten cruises": "Hurtigruten",
  "adventures by disney": "Adventures by Disney",
  "disneyland": "Disneyland",
  "disney land": "Disneyland",
  "disneyworld": "DisneyWorld",
  "disney world": "DisneyWorld",
  "aulani": "Aulani, A Disney Resort & Spa",
  "a disney resort": "Aulani, A Disney Resort & Spa",
  "aulani, a disney resort & spa": "Aulani, A Disney Resort & Spa",
  "sandals": "Sandals",
  "beaches": "Beaches",
  "breathless": "Breathless",
  "club med": "Club Med",
  "clubmed": "Club Med",
  "el dorado": "El Dorado Spa Resorts & Hotels",
  "el dorado spa": "El Dorado Spa Resorts & Hotels",
  "dreams": "Dreams",
  "dreams resorts": "Dreams",
  "excellence": "Excellence Resorts",
  "excellence resorts": "Excellence Resorts",
  "hard rock": "Hard Rock Hotels",
  "hard rock hotels": "Hard Rock Hotels",
  "iberostar": "Iberostar Hotels & Resorts",
  "iberostar hotels": "Iberostar Hotels & Resorts",
  "karisma": "Karisma Hotels & Resorts",
  "outrigger": "Outrigger Hotels & Resorts",
  "outrigger hotels": "Outrigger Hotels & Resorts",
  "palace": "Palace Resorts",
  "palace resorts": "Palace Resorts",
  "riu": "RIU Hotels & Resorts",
  "riu hotels": "RIU Hotels & Resorts",
  "secrets": "Secrets",
  "delta": "Delta Vacations",
  "delta vacations": "Delta Vacations",
  "southwest": "Southwest Vacations",
  "southwest vacations": "Southwest Vacations",
  "united": "United Vacations",
  "united vacations": "United Vacations",
  "villas": "Villas of Distinction",
  "villas of distinction": "Villas of Distinction",
  "zoëtry": "Zoëtry Wellness & Spa Resorts",
  "zoeetry": "Zoëtry Wellness & Spa Resorts",
  "bluesky": "BlueSky Tours",
  "blue sky tours": "BlueSky Tours",
  "cie": "CIE Tours",
  "cie tours": "CIE Tours",
  "collette": "Collette",
  "great safaris": "Great Safaris",
  "project expedition": "Project Expedition",
  "project expeditions": "Project Expedition",
  "shore excursions": "Shore Excursions Group",
  "shore excursions group": "Shore Excursions Group",
  "toursales": "TourSales.com",
  "tour sales": "TourSales.com",
  "trafalgar": "Trafalgar"
};

// --- Vendor fuzzy normalization ---
function _normalizeVendorTokens(v) {
  return v.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(cruises?|cruise\s*line|vacations?|resorts?|hotels?|group|collection|yachts?|yacht|international|the|by|and|\.com)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function _jaccardSim(aTokens, bTokens) {
  const A = new Set(aTokens), B = new Set(bTokens);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

// Lightweight Levenshtein for edge cases
function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Exported: vendor similarity in [0,1]
function vendorSimilarity(a, b) {
  const at = _normalizeVendorTokens(a);
  const bt = _normalizeVendorTokens(b);
  const j = _jaccardSim(at, bt);
  if (j >= 0.66) return j; // good enough on tokens
  // try Levenshtein on collapsed strings
  const as = at.join(""), bs = bt.join("");
  const maxLen = Math.max(as.length, bs.length) || 1;
  const lev = _levenshtein(as, bs);
  return Math.max(j, 1 - lev / maxLen);
}

// Returns canonical vendor name (with fuzzy fallback)
function getCanonicalVendor(vendor) {
  if (!vendor) return "";
  const raw = vendor.trim();
  const vendorLower = raw.toLowerCase();

  // 1) Hard alias hits
  if (aliasMapping[vendorLower]) return aliasMapping[vendorLower];

  // 2) Exact name in known list
  for (const supplier of knownSuppliers) {
    if (supplier.toLowerCase() === vendorLower) return supplier;
  }

  // 3) Fuzzy to alias targets and known suppliers
  const candidates = [...new Set([
    ...Object.values(aliasMapping),
    ...knownSuppliers
  ])];
  let best = raw, bestScore = 0;
  for (const c of candidates) {
    const s = vendorSimilarity(raw, c);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return bestScore >= 0.72 ? best : raw;
}

// Parse HQ deals text into an array of objects { vendor, text, original }
function parseHQDeals(text) {
  const lines = text.split('\n');
  const deals = [];
  let currentVendor = "";
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // vendor lines: v ... , v: ..., vendor: ...
    const vm = trimmed.match(/^v(?:endor)?\s*[:\-]?\s*(.+)$/i);
    if (vm) {
      currentVendor = getCanonicalVendor(vm[1].replace(/\s*:\s*$/, "").trim());
      return;
    }
    // deal lines: d ... or ed ... (with flexible separators)
    const dm = trimmed.match(/^(ed|d)\s*[:\-]?\s*(.+)$/i);
    if (dm) {
      const marker = dm[1].toLowerCase(); // "d" or "ed"
      const dealText = dm[2].trim();
      deals.push({ vendor: currentVendor, text: dealText, original: trimmed, marker });
    }
  });
  return deals;
}

// Parse JSON deals into an array of objects
function parseJSONDeals(jsonText) {
  try {
    const jsonData = JSON.parse(jsonText);
    return jsonData.map(item => ({
      vendor: getCanonicalVendor(item.shopOverline || ""),
      expiryDate: item.expiryDate,
      title: item.title || "",
      shopListing: item.shopListing || ""
    }));
  } catch (e) {
    alert("Invalid JSON input.");
    return [];
  }
}

// Extract all normalized dates from a string
function extractAllDatesWithInfo(text) {
  const dates = [];
  const isoRegex = /(\d{4})-(\d{2})-(\d{2})/g;
  let match;
  while ((match = isoRegex.exec(text)) !== null) {
    let ymd = `${match[1]}-${match[2]}-${match[3]}`;
    let dObj = new Date(ymd + "T00:00:00Z"); // prevent TZ shifts
    if (!isNaN(dObj)) dates.push({ raw: match[0], display: formatDate(dObj), ymd, dateObj: dObj });
  }
  const usRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  while ((match = usRegex.exec(text)) !== null) {
    let year = match[3].length === 2 ? "20" + match[3] : match[3];
    let mm = String(match[1]).padStart(2, '0'),
        dd = String(match[2]).padStart(2, '0');
    let dObj = new Date(`${year}-${mm}-${dd}T00:00:00Z`);
    if (!isNaN(dObj)) {
      dates.push({ raw: match[0], display: formatDate(dObj), ymd: `${year}-${mm}-${dd}`, dateObj: dObj });
    }
  }
  const rangeRegex = /(\d{1,2})[\/\-](\d{1,2})\s*-\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  while ((match = rangeRegex.exec(text)) !== null) {
    let month = match[3], day = match[4], year = match[5].length === 2 ? "20" + match[5] : match[5];
    let mm = String(month).padStart(2, '0'),
        dd = String(day).padStart(2, '0');
    let dObj = new Date(`${year}-${mm}-${dd}T00:00:00Z`);
    if (!isNaN(dObj)) {
      dates.push({ raw: match[0], display: formatDate(dObj), ymd: `${year}-${mm}-${dd}`, dateObj: dObj, isRange: true });
    }
  }
  return dates;
}

// Choose last date (latest) out of parsed results
function selectLatestDate(dates) {
  if (!dates.length) return null;
  return dates.reduce((latest, d) => (!latest || d.dateObj > latest.dateObj) ? d : latest, null);
}

// Returns { ymd, dateObj, display, raw } for latest date
function extractNormalizedExpiry(text) {
  const dates = extractAllDatesWithInfo(text);
  const latest = selectLatestDate(dates);
  return latest ? { ...latest } : null;
}

// Normalize expiry from JSON ISO (timezone-agnostic date-only)
function normalizeJSONExpiry(dateStr) {
  if (!dateStr) return null;
  // Prefer the first 10 chars if ISO-like string present to avoid TZ to previous/next day
  const m = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  const ymd = m ? m[1] : null;
  let dObj;
  if (ymd) {
    dObj = new Date(ymd + "T00:00:00Z");
  } else {
    // Fallback to Date parser (still normalized to date-only in UTC for ymd)
    dObj = new Date(dateStr);
    if (isNaN(dObj)) return null;
  }
  const year = dObj.getUTCFullYear();
  const mm = String(dObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dObj.getUTCDate()).padStart(2, '0');
  const finalYMD = ymd || `${year}-${mm}-${dd}`;
  return { ymd: finalYMD, dateObj: new Date(finalYMD + "T00:00:00Z"), display: formatDate(new Date(finalYMD + "T00:00:00Z")), original: dateStr };
}

// Format date for display (M D, YYYY)
function formatDate(dateObj) {
  if (!dateObj) return "N/A";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Use UTC to avoid local TZ date drift
  return `${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;
}

// Extract percentage values from text
function extractPercentageValues(text) {
  const vals = [];
  let match;
  // Match patterns like 50%, 50 %, 50 percent, 50percent
  const regex = /(\d+)(?:\s*)(?:%|percent)/gi;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) vals.push(num);
  }
  return [...new Set(vals)].sort((a, b) => a - b);
}

// Enhanced extraction of monetary values (e.g., 180 euro, 180 dollars, $180, 180€)
function extractMoneyValues(text) {
  const vals = [];
  let match;

  const regexes = [
    /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?/g,
    /(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?\s*(usd|dollars?|euro|euros|eur)/gi,
    /(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?\s*(€)/g,
    /(€)\s*(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?/g,
  ];
  
  regexes.forEach(regex => {
    while ((match = regex.exec(text)) !== null) {
      let num;
      let raw;
      if (regex === regexes[3]) {
        raw = match[2] + (match[3] || "");
      } else {
        raw = match[1] + (match[2] || "");
      }
      num = parseFloat(raw.replace(/,/g, ""));
      if (!isNaN(num)) vals.push(num);
    }
  });

  return [...new Set(vals)].sort((a, b) => a - b);
}

// Extract special numeric phrases (for 2, etc.)
function extractSpecialNumericAll(text) {
  let t = text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "");
  const out = [];
  const wordNum = {
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9
  };
  let m;
  const forNumRegex = /for\s+(two|three|four|five|six|seven|eight|nine|\d+)/gi;
  while ((m = forNumRegex.exec(t)) !== null) {
    let val = m[1];
    if (wordNum[m[1]?.toLowerCase()]) val = wordNum[m[1].toLowerCase()];
    out.push(Number(val));
  }
  const buyGetRegex = /buy\s+(\d+)\s+get\s+(\d+)/gi;
  while ((m = buyGetRegex.exec(t)) !== null) {
    out.push(Number(m[1]), Number(m[2]));
  }
  const xForYRegex = /(\d+)\s*for\s*[$]?\s*(\d+)/gi;
  while ((m = xForYRegex.exec(t)) !== null) {
    out.push(Number(m[1])), out.push(Number(m[2]));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// Exclusive flag detection
function exclusiveFlag(hqText, jsText) {
  return /\bexclusive\b/i.test(jsText) && !/\bexclusive\b/i.test(hqText);
}

// Special word replacements (2nd->second, etc.)
const specialWordReplacements = {
  "2nd": "second",
  "3rd": "third",
  "4th": "fourth",
  "1st": "first",
  "nd": "",
  "rd": "",
  "th": "",
  "st": ""
};

// Opaque synonym check
function hasOpaqueSynonym(text1, text2) {
  const set = ["opaque", "covert", "secret", "hidden"];
  const t1 = text1.toLowerCase(), t2 = text2.toLowerCase();
  return set.some(word => t1.includes(word) && set.some(w2 => t2.includes(w2)));
}

// Half-off detection
function isHalfOffDeal(text) {
  const t = text.toLowerCase();
  return /(50\s*%|50\s*percent)\s*(off|reduced|discount)/.test(t) || t.includes("half off");
}

// Gratuity detection
function hasGratuity(text) {
  const lower = text.toLowerCase();
  const terms = [
    "pre paid gratuities",
    "pre-paid gratuities",
    "prepaid gratuities",
    "free gratuities",
    "free grat",
    "gratuities",
    "ppg"
  ];
  return terms.some(term => lower.includes(term));
}

// Onboard credit detection
function hasOBC(text) {
  const lower = text.toLowerCase();
  const terms = ["onboard credit", "on board credit", "obc", "on-board credit", "dining credit"];
  return terms.some(term => lower.includes(term));
}

// Kids detection
function hasKids(text) {
  const lower = text.toLowerCase();
  const terms = [
    " kid ",
    " kids ",
    " child ",
    " children ",
    "3rd guest",
    "third guest",
    "4th guest",
    "fourth guest"
  ];
  return terms.some(term => lower.includes(term)) || /\b(kid|kids|child|children)\b/.test(lower);
}

// --- Synonym Dictionaries ---
const keywordSynonyms = {
  "opaque": ["covert", "secret", "hidden"],
  "covert": ["opaque", "secret", "hidden"],
  "secret": ["opaque", "covert", "hidden"],
  "hidden": ["opaque", "covert", "secret"],
  "limited time": ["24 hour", "48 hour", "24-hour", "48-hour", "24hr", "48hr", "limited time offer", "limited time only"],
  "24 hour": ["24-hour", "24hr", "limited time"],
  "24-hour": ["24 hour", "24hr", "limited time"],
  "24hr": ["24 hour", "24-hour", "limited time"],
  "48 hour": ["48-hour", "48hr", "limited time"],
  "48-hour": ["48 hour", "48hr", "limited time"],
  "48hr": ["48 hour", "48-hour", "limited time"],
  "free": ["complimentary", "complementary", "compliment", "gratis"],
  "complimentary": ["free", "complementary", "compliment", "gratis"],
  "complementary": ["free", "complimentary", "compliment", "gratis"],
  "compliment": ["free", "complimentary", "complementary", "gratis"],
  "half off": ["50% off", "50% reduced", "50% discount", "50 percent off", "50 percent reduced", "50 percent discount"],
  "50% off": ["half off", "50% reduced", "50% discount", "50 percent off", "50 percent reduced", "50 percent discount"],
  "50% reduced": ["half off", "50% off", "50% discount", "50 percent off", "50 percent reduced", "50 percent discount"],
  "50% discount": ["half off", "50% off", "50% reduced", "50 percent off", "50 percent reduced", "50 percent discount"],
  "50 percent off": ["half off", "50% off", "50% reduced", "50% discount", "50 percent reduced", "50 percent discount"],
  "50 percent discount": ["half off", "50% off", "50% reduced", "50% discount", "50 percent off", "50 percent reduced"],
  "50 percent reduced": ["half off", "50% off", "50% reduced", "50% discount", "50 percent off", "50 percent discount"],
  "up to": ["up to"],
  "per person": ["per person", "pp", "p.p.", "p/p"],
  "onboard credit": ["on board credit", "on-board credit", "obc", "dining credit"],
  "dining credit": ["onboard credit", "obc", "on board credit", "on-board credit"],
  "obc": ["onboard credit", "on board credit", "on-board credit", "dining credit"],
  "limited time offer": ["limited time", "24 hour", "48 hour", "24-hour", "48-hour"],
  "limited time only": ["limited time", "24 hour", "48 hour", "24-hour", "48-hour"],
  "reduced deposit": ["low deposit", "reduced dep", "reduced deposits", "reduced-deposit", "low-deposit", "nrd", "non-refundable deposit", "nrd deposit"]
};

// Normalize single keyword
function normalizeKeyword(word) {
  const w = word.trim().toLowerCase();
  for (let canon in keywordSynonyms) {
    const set = [canon, ...keywordSynonyms[canon]];
    if (set.includes(w)) return canon;
  }
  if (/(^|[\s\-])50(\s*%|\s*percent)?\s*(reduced|discount|off)/.test(w) || w === "50%" || w === "50 percent")
    return "half off";
  if (["complimentary", "complementary", "compliment", "gratis"].includes(w)) return "free";
  return w;
}

// Return synonyms list for a word
function synonymsFor(word) {
  const w = word.toLowerCase();
  if (keywordSynonyms[w]) return [w, ...keywordSynonyms[w]];
  const canon = normalizeKeyword(word);
  return (canon !== w) ? [canon] : [w];
}

// Extract normalized keywords (excludes "exclusive" if noExclusive=true)
function extractNormalizedKeywords(text, { noExclusive = false } = {}) {
  let t = text.toLowerCase();
  t = t.replace(/\b(up\s+to)\b/gi, "upto");
  t = t.replace(/\b(per\s+person)\b/gi, "perperson");
  Object.entries(specialWordReplacements).forEach(([k, v]) => {
    t = t.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  });
  t = t.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "");
  t = t.replace(/\b(complimentary|complementary|compliment|gratis)\b/g, "free");
  t = t.replace(/\b(24|48)[\s\-]?(hour|hr)[\s\-]?(sale)?/gi, (m, n, unit) => `${n}${unit}sale`);
  t = t.replace(/\b(24|48)[\s\-]?(hour|hr)/gi, (m, n, unit) => `${n}${unit}`);
  // remove currency numbers
  t = t.replace(/\$\s*\d{1,3}(?:,\d{3})+|\$\s*\d+(?:\.\d+)?/g, ' ');
  t = t.replace(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(usd|dollars?|euro|euros|eur)/gi, ' ');
  t = t.replace(/(€)\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g, ' ');
  if (!/50\s*%|half off/.test(t)) {
    t = t.replace(/\d+\s*%/g, ' ');
    t = t.replace(/\d+\s*percent/gi, ' ');
  }
  // normalize time-limited phrases
  t = t.replace(/((24|48)[\s\-]?(hour|hr)|limited[\s\-]?time|limited[\s\-]?time[\s\-]?offer|limited[\s\-]?time[\s\-]?only)/gi, "limitedtime");
  t = t.replace(/\bdining credit\b/gi, "diningcredit");
  t = t.replace(/\bon[\s\-]?board credit\b/gi, "onboardcredit");
  t = t.replace(/\bobc\b/gi, "onboardcredit");
  t = t.replace(/\bon-board credit\b/gi, "onboardcredit");
  t = t.replace(/(50\s*%|50\s*percent)\s*(off|reduced|discount)/g, "halfoff");
  t = t.replace(/half[\s\-]?off/g, "halfoff");
  // remove internal codes e.g. (PEM/OB7) or P3P etc
  t = t.replace(/\([^)]*\)/g, " ");
  t = t.replace(/\b[a-z]{1,4}\d+[a-z0-9/]*\b/gi, " ");
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  const words = t.split(/\s+/).filter(w => w.length > 1);
  const ngrams = [];
  for (let i = 0; i < words.length; i++) {
    let single = words[i].trim();
    if (!single) continue;
    if (noExclusive && single === "exclusive") continue;
    if (/^\d+$/.test(single)) continue;
    ngrams.push(normalizeKeyword(single));
    if (i + 1 < words.length) {
      let bi = normalizeKeyword(words[i] + " " + words[i + 1]);
      if (bi && bi !== ngrams[ngrams.length - 1]) ngrams.push(bi);
    }
  }
  const out = [];
  const seen = {};
  ngrams.forEach(kw => {
    if (!seen[kw] && kw.length > 1) {
      seen[kw] = 1;
      out.push(kw);
    }
  });
  return noExclusive ? out.filter(w => w !== "exclusive") : out;
}

// Keyword set overlap using synonyms
function keywordSetOverlap(arr1, arr2) {
  const set1 = arr1;
  const set2 = arr2;
  const usedIdx2 = new Set();
  const matches = [];
  for (let i = 0; i < set1.length; i++) {
    let kw = set1[i];
    for (let j = 0; j < set2.length; j++) {
      if (usedIdx2.has(j)) continue;
      const syn1 = synonymsFor(kw), syn2 = synonymsFor(set2[j]);
      if (syn1.some(x => syn2.includes(x))) {
        matches.push(syn1[0]);
        usedIdx2.add(j);
        break;
      }
    }
  }
  return [...new Set(matches)];
}

// ---- HQ duplicate detection ----
// Computes a light-weight "fingerprint" for a deal line to catch dupes
function dealFingerprint(text) {
  const kws = extractNormalizedKeywords(text, { noExclusive: true }).sort();
  const money = extractMoneyValues(text).join(",");
  const perc = extractPercentageValues(text).join(",");
  const flags = [
    hasOBC(text) ? "obc" : "",
    hasGratuity(text) ? "grat" : "",
    hasKids(text) ? "kids" : "",
    isHalfOffDeal(text) ? "half" : ""
  ].filter(Boolean).join("|");
  return `${kws.join("|")}||${money}||${perc}||${flags}`;
}

// Returns { unique: [], duplicates: [{original, duplicateOf}...] }
function dedupeHQDeals(hqDeals) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];
  for (const d of hqDeals) {
    const vendKey = _normalizeVendorTokens(d.vendor).join(" ");
    const fp = vendKey + "||" + dealFingerprint(d.text);
    if (seen.has(fp)) {
      duplicates.push({ duplicateOf: seen.get(fp), original: d });
    } else {
      seen.set(fp, d);
      unique.push(d);
    }
  }
  return { unique, duplicates };
}
