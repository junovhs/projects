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
  "viking": "Viking Ocean",
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

// Lower-case alias keys once for robust, case-insensitive lookups
const aliasMapping = {};
for (const k in aliasMappingRaw) { aliasMapping[k.toLowerCase()] = aliasMappingRaw[k]; }

// ---------- Vendor parsing & normalization ----------
function _basicNormalizeVendor(raw){
  return String(raw||"")
    .trim()
    .replace(/\s+/g,' ')
    .replace(/[.:]+$/,'') // trailing colon/dot
    .toLowerCase();
}

function cleanVendorName(name) {
  if (!name) return "";
  const lower = _basicNormalizeVendor(name);

  // direct alias hit
  if (aliasMapping[lower]) return aliasMapping[lower];

  // exact match against knownSuppliers (case-insensitive)
  for (const s of knownSuppliers){
    if (lower === s.toLowerCase()) return s;
  }

  // soft contains match against canonical list (safer than global fuzzy)
  for (const s of knownSuppliers){
    const canon = s.toLowerCase();
    if (lower.includes(canon) || canon.includes(lower)) return s;
  }

  // fall back to simple Title Case of original
  return String(name).trim().replace(/\s+/g,' ').replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1));
}

// ---------- HQ parser ----------
function parseHQDeals(text) {
  const lines = String(text||"").split(/\r?\n/);
  const out = [];
  let currentVendor = null;

  const vendorRe = /^\s*v(?:endor)?\s*[:\-]?\s*(.+?)(?:\s*:)?\s*$/i;
  const dealRe   = /^\s*(?:d|ed)\s*[:\-]?\s*(.+?)\s*$/i;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let m = vendorRe.exec(trimmed);
    if (m) { currentVendor = cleanVendorName(m[1]); continue; }

    m = dealRe.exec(trimmed);
    if (m && currentVendor) {
      const text = m[1].trim();
      out.push({ vendor: currentVendor, text, original: raw });
      continue;
    }
  }
  return out;
}

// ---------- JSON parser ----------
function parseJSONDeals(text) {
  try {
    const arr = JSON.parse(text || "[]");
    return (Array.isArray(arr)?arr:[]).map(o => ({
      vendor: cleanVendorName(o.vendor||""),
      title: String(o.title||"").trim(),
      shopListing: String(o.shopListing||o.listing||"").trim(),
      expiryDate: o.expiryDate || o.expiry || null
    }));
  } catch(e) {
    alert("Invalid JSON");
    return [];
  }
}

// ---------- Date helpers ----------
function pad2(n){ return String(n).padStart(2,"0"); }

function parseMDY(m, d, y){
  y = String(y);
  if (y.length===2) y = (Number(y)>=70 ? "19" : "20") + y;
  const yNum = Number(y), mNum = Number(m), dNum = Number(d);
  const dateObj = new Date(Date.UTC(yNum, mNum-1, dNum));
  return { ymd: `${yNum}-${pad2(mNum)}-${pad2(dNum)}`, dateObj, display: formatDate(dateObj) };
}

function extractAllDatesWithInfo(text){
  const t = String(text||"");
  const out = [];
  t.replace(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g, (_,m,d,y)=>{ out.push(parseMDY(m,d,y)); return ""; });
  t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_,y,m,d)=>{ out.push(parseMDY(m,d,y)); return ""; });
  t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2}),\s*(\d{2,4})\b/gi, (m,mon,d,y)=>{
    const monthMap = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
    out.push(parseMDY(monthMap[mon.toLowerCase()], d, y)); return "";
  });
  const uniq = {}; const res = [];
  for (const it of out) if (!uniq[it.ymd]) { uniq[it.ymd]=1; res.push(it); }
  return res;
}

function extractNormalizedExpiry(text){
  const dates = extractAllDatesWithInfo(text);
  if (!dates.length) return null;
  return dates[dates.length-1];
}

function normalizeJSONExpiry(expiryStr){
  if (!expiryStr) return null;
  const d = new Date(expiryStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear(), m = d.getUTCMonth()+1, day = d.getUTCDate();
  const dateObj = new Date(Date.UTC(y, m-1, day));
  return { ymd: `${y}-${pad2(m)}-${pad2(day)}`, dateObj, display: formatDate(dateObj) };
}

function formatDate(d){
  const y = d.getUTCFullYear(), m = d.getUTCMonth()+1, day = d.getUTCDate();
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[m-1]} ${pad2(day)}, ${y}`;
}

// ---------- Money / numeric extraction (robust thousands) ----------
function extractMoneyValues(text){
  const vals = [];
  const MONEY_NUM = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)';
  const DEC = '(?:\\.\\d+)?';
  const rx = [
    new RegExp('\\$\\s*(' + MONEY_NUM + ')' + DEC, 'gi'),
    new RegExp('(' + MONEY_NUM + ')' + DEC + '\\s*(usd|dollars?)', 'gi'),
    new RegExp('(' + MONEY_NUM + ')' + DEC + '\\s*(€|eur|euro|euros)', 'gi'),
    new RegExp('(€)\\s*(' + MONEY_NUM + ')' + DEC, 'gi'),
  ];
  for (let i=0;i<rx.length;i++){
    let m; while ((m = rx[i].exec(text)) !== null){
      const raw = (i===3 ? m[2] : m[1]);
      const num = parseFloat(String(raw).replace(/,/g,''));
      if (!Number.isNaN(num)) vals.push(num);
    }
  }
  return [...new Set(vals)].sort((a,b)=>a-b);
}

function extractPercentageValues(text){
  const vals = [];
  String(text||"").replace(/(\d+)\s*%/g, (_,n)=>{ vals.append?vals.append(Number(n)):vals.push(Number(n)); return ""; });
  String(text||"").replace(/(\d+)\s*percent\b/gi, (_,n)=>{ vals.push(Number(n)); return ""; });
  return [...new Set(vals)].sort((a,b)=>a-b);
}

function extractSpecialNumericAll(text){
  const t = String(text||"").toLowerCase();
  const out = [];
  t.replace(/\b(1st|2nd|3rd|4th)\b/g, (m)=>{ const map = { "1st":1, "2nd":2, "3rd":3, "4th":4 }; out.push(map[m]); return ""; });
  t.replace(/\b(first|second|third|fourth)\b/g, (m)=>{ const map = { first:1, second:2, third:3, fourth:4 }; out.push(map[m]); return ""; });
  t.replace(/buy\s+(\d+)\s+get\s+(\d+)/g, (_,a,b)=>{ out.push(Number(a), Number(b)); return ""; });
  t.replace(/(\d+)\s*for\s*\$?\s*(\d+)/g, (_,a,b)=>{ out.push(Number(a), Number(b)); return ""; });
  return [...new Set(out)].sort((a,b)=>a-b);
}

function hasOBC(text){ return /\bonboard\s*credit\b|\bobc\b/i.test(text||""); }
function hasGratuity(text){ return /\bgratuities?\b|\bpre[-\s]?paid gratuities\b|\bppg\b/i.test(text||""); }
function hasKids(text){ return /\bkids?\b|\bchild\b|\bchildren\b|\b3rd guest\b|\b4th guest\b/i.test(text||""); }

// ---------- Keyword normalization ----------
const STOP = new Set(("and or the a an of on to in for with by at from up as per your our their his her its is are be this that those these get take make offer save bonus limited time instant discount deposit balcony suite oceanview guest voyage sailing cruise cruises amenity ends exclusive select departures select").split(/\s+/));

function normalizeForKeywords(text){
  const lower = String(text||"").toLowerCase();
  const noMoney = lower.replace(/\$\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g,"");
  const noPct = noMoney.replace(/\d+\s*%|\d+\s*percent/g,"");
  const clean = noPct.replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
  return clean.replace(/\b2nd\b/g,"second").replace(/\b3rd\b/g,"third").replace(/\b4th\b/g,"fourth");
}

function extractNormalizedKeywords(text){
  const s = normalizeForKeywords(text);
  const parts = s.split(/\s+/).filter(w => w && !STOP.has(w));
  return [...new Set(parts)];
}

function keywordSetOverlap(set1, set2){
  const s2 = new Set(set2);
  const out = [];
  for (const w of set1){ if (s2.has(w)) out.push(w); }
  return out;
}

function exclusiveFlag(hqText, jsText){ return /\bexclusive\b/i.test(String(jsText||"")) && !/\bexclusive\b/i.test(String(hqText||"")); }

// Expose helpers
window.knownSuppliers = knownSuppliers;
window.cleanVendorName = cleanVendorName;
window.parseHQDeals = parseHQDeals;
window.parseJSONDeals = parseJSONDeals;
window.extractNormalizedExpiry = extractNormalizedExpiry;
window.normalizeJSONExpiry = normalizeJSONExpiry;
window.extractMoneyValues = extractMoneyValues;
window.extractPercentageValues = extractPercentageValues;
window.extractSpecialNumericAll = extractSpecialNumericAll;
window.hasOBC = hasOBC;
window.hasGratuity = hasGratuity;
window.hasKids = hasKids;
window.extractAllDatesWithInfo = extractAllDatesWithInfo;
window.extractNormalizedKeywords = extractNormalizedKeywords;
window.keywordSetOverlap = keywordSetOverlap;
window.exclusiveFlag = exclusiveFlag;
window.formatDate = formatDate;
