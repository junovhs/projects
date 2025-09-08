// utils.js — parsing, normalization, extraction helpers

// ---------- Vendor parsing ----------
function cleanVendorName(name) {
  if (!name) return "";
  const s = String(name).trim().replace(/\s+/g,' ');
  // canonicalize common aliases (small, focused set; extend as needed)
  const lower = s.toLowerCase();
  const aliases = {
    "rci": "Royal Caribbean",
    "royal": "Royal Caribbean",
    "royal caribbean international": "Royal Caribbean",
    "ncl": "Norwegian",
    "norwegian cruise line": "Norwegian",
    "disney cruise": "Disney Cruise Line",
    "disney cruises": "Disney Cruise Line",
    "celebrity": "Celebrity Cruises",
    "virgin": "Virgin Voyages",
    "american cruise lines": "American Cruise Line",
    "american cruise line": "American Cruise Line"
  };
  if (aliases[lower]) return aliases[lower];
  // Title-case basic
  return s.replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1));
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
  // 09/30/2025 or 9-30-25
  t.replace(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g, (_,m,d,y)=>{
    out.push(parseMDY(m,d,y)); return "";
  });
  // 2025-09-30
  t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_,y,m,d)=>{
    out.push(parseMDY(m,d,y)); return "";
  });
  // Sep 30, 2025
  t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2}),\s*(\d{2,4})\b/gi, (m,mon,d,y)=>{
    const monthMap = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
    out.push(parseMDY(monthMap[mon.toLowerCase()], d, y)); return "";
  });
  // De-duplicate by ymd
  const uniq = {}; const res = [];
  for (const it of out) if (!uniq[it.ymd]) { uniq[it.ymd]=1; res.push(it); }
  return res;
}

function extractNormalizedExpiry(text){
  const dates = extractAllDatesWithInfo(text);
  if (!dates.length) return null;
  // choose the last date in the text (common "ends MM/DD")
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

// ---------- Number extraction ----------
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
  String(text||"").replace(/(\d+)\s*%/g, (_,n)=>{ vals.push(Number(n)); return ""; });
  String(text||"").replace(/(\d+)\s*percent\b/gi, (_,n)=>{ vals.push(Number(n)); return ""; });
  return [...new Set(vals)].sort((a,b)=>a-b);
}

function extractSpecialNumericAll(text){
  const t = String(text||"").toLowerCase();
  const out = [];
  // 2nd / 3rd / 4th guest
  t.replace(/\b(1st|2nd|3rd|4th)\b/g, (m)=>{
    const map = { "1st":1, "2nd":2, "3rd":3, "4th":4 };
    out.push(map[m]);
    return "";
  });
  t.replace(/\b(first|second|third|fourth)\b/g, (m)=>{
    const map = { first:1, second:2, third:3, fourth:4 };
    out.push(map[m]);
    return "";
  });
  // "X for Y" or "buy X get Y"
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
  // remove money and percentages
  const noMoney = lower.replace(/\$\s*(?:\d{1,3}(?:,\\d{3})+|\d+)(?:\.\d+)?/g,"");
  const noPct = noMoney.replace(/\d+\s*%|\d+\s*percent/g,"");
  const clean = noPct.replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
  // normalize ordinals
  return clean.replace(/\b2nd\b/g,"second").replace(/\b3rd\b/g,"third").replace(/\b4th\b/g,"fourth");
}

function extractNormalizedKeywords(text, opts){
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

// ---------- Flags ----------
function exclusiveFlag(hqText, jsText){ return /\bexclusive\b/i.test(String(jsText||"")) && !/\bexclusive\b/i.test(String(hqText||"")); }

// Expose helpers for other modules (no module system here)
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
