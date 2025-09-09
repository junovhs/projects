// utils.js — parsing, normalization, extraction helpers

// ---------- Canonical suppliers and aliases (restored, production-safe) ----------
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
  // include any canonical not in the original list but referenced by aliases
  "Atlas Ocean Voyages"
];

const aliasMappingRaw = {
  "american airlines vacations": "American Airline Vacations",
  "american airline vacations": "American Airline Vacations",
  "american airlnes vacations": "American Airline Vacations",
  "royal": "Royal Caribbean",
  "rccl": "Royal Caribbean",
  "rcc": "Royal Caribbean",
  "rci": "Royal Caribbean",
  "royal caribbean": "Royal Caribbean",
  "norwegian": "Norwegian",
  "norwegian cruise": "Norwegian",
  "norwegian cruise line": "Norwegian",
  "ncl": "Norwegian",
  "disney cruise": "Disney Cruise Line",
  "disney cruises": "Disney Cruise Line",
  "disney cruise line": "Disney Cruise Line",
  "celebrity": "Celebrity Cruises",
  "celebrity cruises": "Celebrity Cruises",
  "virgin": "Virgin Voyages",
  "virgin voyages": "Virgin Voyages",
  "virgin cruise": "Virgin Voyages",
  "holland": "Holland America Line",
  "holland america": "Holland America Line",
  "holland america line": "Holland America Line",
  "hal": "Holland America Line",
  "princess": "Princess",
  "princess cruises": "Princess",
  "carnival": "Carnival",
  "carnival cruise": "Carnival",
  "carnival cruises": "Carnival",
  "msc": "MSC Cruises",
  "msc cruises": "MSC Cruises",

  "viking ocean": "Viking Ocean",
  "american cruise": "American Cruise Line",
  "american cruise line": "American Cruise Line",
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

// ----------------------- DO NOT EDIT BLOCK ABOVE -----------------------

// ---------- Text & vendor normalization ----------
const _WS = /\s+/g;
const _TRAILING_COLON = /\s*:\s*$/;
const _DIACRITICS = /[\u0300-\u036f]/g;

function normalizeWhitespace(s) {
  return String(s || "").replace(_WS, " ").trim();
}

// Remove diacritics, lowercase, collapse spaces, strip punctuation to aid matching
function _lcFold(s) {
  return normalizeWhitespace(
    String(s || "")
      .normalize("NFD")
      .replace(_DIACRITICS, "")
      .toLowerCase()
  );
}

// Build a lowercased alias map for fast lookup
const _aliasMap = (() => {
  const m = new Map();
  Object.keys(aliasMappingRaw).forEach(k => m.set(_lcFold(k), aliasMappingRaw[k]));
  return m;
})();

// Lowercased canonical variants to allow exact-insensitive matching
const _canonByLC = (() => {
  const m = new Map();
  knownSuppliers.forEach(c => m.set(_lcFold(c), c));
  return m;
})();

// Heuristic cleanup to catch things like "Carnival Cruise Line"
function _heuristicVendorCanonical(ns) {
  // Specific patterns: "* cruise line(s)?" → try to map root brand
  if (ns.includes("carnival")) return "Carnival";
  if (ns.includes("royal caribbean")) return "Royal Caribbean";
  if (ns.includes("msc")) return "MSC Cruises";
  if (ns.includes("celebrity")) return "Celebrity Cruises";
  if (ns.includes("princess")) return "Princess";
  if (ns.includes("holland america")) return "Holland America Line";
  if (ns.includes("norwegian")) return "Norwegian";
  // If it contains the exact lowercase of a known supplier token, prefer that
  for (const canon of knownSuppliers) {
    const c = _lcFold(canon);
    if (ns.includes(c)) return canon;
  }
  return "";
}

function cleanVendorName(vendorRaw) {
  const raw = normalizeWhitespace(String(vendorRaw || "").replace(_TRAILING_COLON, ""));
  if (!raw) return "";

  // 1) Direct canon exact-insensitive
  const rawLC = _lcFold(raw);
  if (_canonByLC.has(rawLC)) return _canonByLC.get(rawLC);

  // 2) Alias lookup
  if (_aliasMap.has(rawLC)) return _aliasMap.get(rawLC);

  // 3) Strip generic suffixes and try again
  let ns = rawLC
    .replace(/\b(cruise(?:s)?|cruise line(?:s)?|yachts?|hotels?|resorts?)\b/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(_WS, " ")
    .trim();

  if (_aliasMap.has(ns)) return _aliasMap.get(ns);
  if (_canonByLC.has(ns)) return _canonByLC.get(ns);

  // 4) Heuristic fallback
  const guess = _heuristicVendorCanonical(ns);
  if (guess) return guess;

  return raw; // last resort: return original, so UI still displays something
}

// ---------- Numeric extraction ----------
const _MONEY_RE = /\$[\s]*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{2})?/g; // $1,234 or $50
const _PCT_RE = /(\d{1,3})(?:\s*)%(?![\w])/g; // 10%, 75%
const _NUM_RE = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;

function extractMoney(text) {
  const out = [];
  const s = String(text || "");
  let m;
  while ((m = _MONEY_RE.exec(s)) !== null) {
    const val = Number(m[1].replace(/,/g, ""));
    if (!Number.isNaN(val)) out.push(val);
  }
  return out;
}

function extractPercentages(text) {
  const out = [];
  const s = String(text || "");
  let m;
  while ((m = _PCT_RE.exec(s)) !== null) {
    const val = Number(m[1]);
    if (!Number.isNaN(val)) out.push(val);
  }
  return out;
}

function extractNumbers(text) {
  const out = [];
  const s = String(text || "");
  let m;
  while ((m = _NUM_RE.exec(s)) !== null) {
    const val = Number(m[0].replace(/,/g, ""));
    if (!Number.isNaN(val)) out.push(val);
  }
  return out;
}

// ---------- Ongoing / Exclusive flags ----------
const _ONGOING_RE = /\b(on\s?-?\s?going|ongoing)\b/i;
const _EXCL_RE = /\b(exclusive|covert|secret)\b/i;

function detectOngoing(text) {
  return _ONGOING_RE.test(String(text || ""));
}

function detectExclusive(text) {
  return _EXCL_RE.test(String(text || ""));
}

// ---------- Date parsing (single + range) ----------
const _MON = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3, apr:4, april:4,
  may:5, jun:6, june:6, jul:7, july:7, aug:8, august:8,
  sep:9, sept:9, september:9, oct:10, october:10, nov:11, november:11, dec:12, december:12
};
const _RANGE_SEP = /\s*(?:to|through|thru|until|til|’til|–|—|-)\s*/i;

function normalizeYY(yy) {
  yy = Number(yy);
  return yy < 80 ? 2000 + yy : 1900 + yy;
}
function toISODate(y, m, d) {
  if (!y || !m || !d) return null;
  const pad = n => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseSingleDateToken(token, fallbackYear) {
  if (!token) return { y:null, m:null, d:null };
  let t = String(token)
    .replace(/[()]/g, " ")
    .replace(/,/, " ")
    .replace(/\s+/g, " ")
    .trim();

  // yyyy-mm-dd or yyyy/mm/dd or yyyy.mm.dd
  let mISO = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (mISO) {
    const [_, y, m, d] = mISO.map(Number);
    return { y, m, d };
  }

  // mm/dd[/yy|yyyy] OR mm.dd[.yy|yyyy]
  let mNum = t.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (mNum) {
    let m = Number(mNum[1]), d = Number(mNum[2]);
    let y = mNum[3] ? Number(mNum[3]) : (fallbackYear || null);
    if (y && y < 100) y = normalizeYY(y);
    return { y, m, d };
  }

  // MonthName d[ yy|yyyy]
  let mName = t.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (mName) {
    let mon = _MON[mName[1].toLowerCase()];
    if (!mon) return { y:null, m:null, d:null };
    let d = Number(mName[2]);
    let y = mName[3] ? Number(mName[3]) : (fallbackYear || null);
    if (y && y < 100) y = normalizeYY(y);
    return { y, m:mon, d };
  }

  return { y:null, m:null, d:null };
}

function parseDateRangeFromText(text, now = new Date()) {
  if (!text) return { startDate: null, endDate: null, ongoing: false, raw: "" };
  const raw = String(text);

  // ongoing?
  const ongoing = _ONGOING_RE.test(raw);

  const normalized = raw
    .replace(/[—–]/g, "-")
    .replace(/\b(?:to|through|thru|until|til|’til)\b/gi, "-")
    .replace(/\s+/g, " ");

  // Prefer explicit "Ends ..." if found (for listings that say "Ends 10/29")
  let endsMatch = normalized.match(/\bEnds?\s+([A-Za-z]+\s+\d{1,2}(?:\s+\d{2,4})?|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\b/i);

  const tokenRe = /(?:\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|[A-Za-z]+\s+\d{1,2}(?:\s+\d{2,4})?)/;
  const rangeRe = new RegExp(`(${tokenRe.source})${_RANGE_SEP.source}(${tokenRe.source})`, "i");
  let rangeMatch = normalized.match(rangeRe);

  if (rangeMatch) {
    let [, a, b] = rangeMatch;

    const bParts = parseSingleDateToken(b);
    const aParts = parseSingleDateToken(a, bParts.y || now.getFullYear());

    // infer years
    let endY = bParts.y ?? aParts.y ?? now.getFullYear();
    let startY = aParts.y ?? endY;

    // Cross-year: "12/20 - 1/10/2026" => start 2025
    if (aParts.m && bParts.m && (aParts.y == null || bParts.y != null)) {
      if (aParts.y == null && bParts.y != null && aParts.m > bParts.m) {
        startY = endY - 1;
      }
    }

    const startDate = (aParts.m && aParts.d) ? toISODate(startY, aParts.m, aParts.d) : null;
    const endDate   = (bParts.m && bParts.d) ? toISODate(endY, bParts.m, bParts.d)   : null;

    return { startDate, endDate, ongoing, raw };
  }

  if (endsMatch) {
    const b = endsMatch[1];
    const bParts = parseSingleDateToken(b, now.getFullYear());
    const endY = bParts.y ?? now.getFullYear();
    const endDate = (bParts.m && bParts.d) ? toISODate(endY, bParts.m, bParts.d) : null;
    return { startDate: null, endDate, ongoing, raw };
  }

  const single = normalized.match(tokenRe);
  if (single) {
    const bParts = parseSingleDateToken(single[0], now.getFullYear());
    const endY = bParts.y ?? now.getFullYear();
    const endDate = (bParts.m && bParts.d) ? toISODate(endY, bParts.m, bParts.d) : null;
    return { startDate: null, endDate, ongoing, raw };
  }

  return { startDate: null, endDate: null, ongoing, raw };
}

// ---------- Parsing HQ / JSON ----------

// HQ format:
// v  Vendor Name:
// d  Deal text...
// ed Exclusive deal text...
const _VENDOR_RE = /^\s*v\s+(.+?)\s*:?\s*$/i;
const _DEAL_RE = /^\s*d\s+(.+?)\s*$/i;
const _EXCL_DEAL_RE = /^\s*ed\s+(.+?)\s*$/i;

function _buildDealBase(vendorCanon, text, isExclusive, source) {
  const dr = parseDateRangeFromText(text);
  const money = extractMoney(text);
  const pcts = extractPercentages(text);
  const nums = extractNumbers(text);
  return {
    vendor: vendorCanon,
    title: String(text || "").trim(),
    shopListing: "",
    startDate: dr.startDate || null,
    expiryDate: dr.endDate || null,
    ongoing: dr.ongoing || false,
    exclusive: !!(isExclusive || detectExclusive(text)),
    moneyValues: money,
    percents: pcts,
    numbers: nums,
    source: source || "hq",
    raw: text
  };
}

function parseHQDeals(text) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  let currentVendor = "";

  for (const line of lines) {
    if (!line || !line.trim()) continue;

    const mV = line.match(_VENDOR_RE);
    if (mV) {
      currentVendor = cleanVendorName(mV[1]);
      continue;
    }

    const mED = line.match(_EXCL_DEAL_RE);
    if (mED) {
      if (!currentVendor) continue; // cannot place deal without vendor context
      out.push(_buildDealBase(currentVendor, mED[1], true, "hq"));
      continue;
    }

    const mD = line.match(_DEAL_RE);
    if (mD) {
      if (!currentVendor) continue;
      out.push(_buildDealBase(currentVendor, mD[1], false, "hq"));
      continue;
    }
  }

  return out;
}

function parseJSONDeals(text) {
  let arr;
  try { arr = JSON.parse(text || "[]"); }
  catch(e) { alert("Invalid JSON"); return []; }

  const items = (Array.isArray(arr) ? arr : []);
  const out = [];

  for (const o of items) {
    const vendorCanon = cleanVendorName(o.vendor || o.shopOverline || "");

    const title = String(o.title || "").trim();
    const listing = String(o.shopListing || o.listing || "").trim();

    // Prefer explicit expiryDate if it looks ISO
    let explicitEnd = null;
    if (o.expiryDate) {
      const iso = String(o.expiryDate).slice(0,10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) explicitEnd = iso;
    } else if (o.expiry) {
      const iso = String(o.expiry).slice(0,10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) explicitEnd = iso;
    }

    // Parse any dates from combined text (title + listing + potentially shown expiry)
    const blob = [title, listing, explicitEnd].filter(Boolean).join(" ");
    const dr = parseDateRangeFromText(blob);

    const startDate = dr.startDate || null;
    const expiryDate = explicitEnd || dr.endDate || null;
    const ongoing = dr.ongoing || detectOngoing(title) || detectOngoing(listing);

    const money = extractMoney(title + " " + listing);
    const pcts = extractPercentages(title + " " + listing);
    const nums = extractNumbers(title + " " + listing);

    out.push({
      vendor: vendorCanon,
      title,
      shopListing: listing,
      startDate,
      expiryDate,
      ongoing,
      exclusive: detectExclusive(title) || detectExclusive(listing),
      moneyValues: money,
      percents: pcts,
      numbers: nums,
      source: "json",
      raw: { title, listing }
    });
  }

  return out;
}

// ---------- General text helpers ----------
function normalizeText(s) {
  return normalizeWhitespace(
    String(s || "")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ---------- Exports to global (non-module environment) ----------
window.knownSuppliers = knownSuppliers;
window.aliasMappingRaw = aliasMappingRaw;

window.cleanVendorName = cleanVendorName;
window.parseHQDeals = parseHQDeals;
window.parseJSONDeals = parseJSONDeals;

window.extractMoney = extractMoney;
window.extractPercentages = extractPercentages;
window.extractNumbers = extractNumbers;

window.detectOngoing = detectOngoing;
window.detectExclusive = detectExclusive;

window.parseDateRangeFromText = parseDateRangeFromText;
window.normalizeText = normalizeText;
window.normalizeWhitespace = normalizeWhitespace;
