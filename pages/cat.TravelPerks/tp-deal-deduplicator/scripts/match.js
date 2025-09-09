// match.js — scoring, matching, orchestration

// Dependencies expected on window from utils.js:
// - cleanVendorName
// - parseHQDeals
// - parseJSONDeals
// - extractMoney, extractPercentages, extractNumbers
// - detectOngoing, detectExclusive
// - parseDateRangeFromText
// - normalizeText

// -------------------- Tunables --------------------
const DATE_TOLERANCE_DAYS = 5;     // how far apart dates can be and still get partial credit
const KEYWORD_WEIGHT      = 1.5;   // weight per overlapping keyword
const LISTING_BONUS       = 0.6;   // listing overlap is usually weaker than title overlap
const EXCLUSIVE_BONUS     = 35;    // if both sides are exclusive
const ONGOING_BONUS       = 40;    // if both sides indicate ongoing
const EXACT_END_BONUS     = 60;
const CLOSE_END_BONUS     = 45;
const EXACT_START_BONUS   = 30;
const CLOSE_START_BONUS   = 20;

const HARD_REJECT_ON_MONEY_MISMATCH   = true; // if both sides mention $$ and no overlap → reject
const HARD_REJECT_ON_PERCENT_MISMATCH = true; // if both sides mention % and no overlap → reject

// -------------------- Helpers --------------------
const _TOKEN_RE = /[\p{L}\p{N}]+/gu;
const _STOP = new Set([
  "the","and","of","a","an","for","to","on","in","with","your","now","our",
  "deal","deals","sale","offer","offers","bonus","special","save","up","off",
  "rates","rate","cruise","cruises","voyage","voyages","line","lines","guest","guests",
  "call","details","book","booking","get","free","included","including","all","inclusive"
]);

function tokenize(s) {
  const out = [];
  const str = String(s || "").toLowerCase();
  let m;
  while ((m = _TOKEN_RE.exec(str)) !== null) {
    const t = m[0];
    if (!_STOP.has(t) && t.length > 1) out.push(t);
  }
  return out;
}

function jaccard(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function daysBetweenISO(a, b) {
  if (!a || !b) return null;
  const A = new Date(a + "T00:00:00Z"), B = new Date(b + "T00:00:00Z");
  return Math.round((B - A) / 86400000);
}

function arrayIntersectNums(a = [], b = []) {
  if (!a.length || !b.length) return [];
  const A = new Set(a.map(n => Number(n)));
  const hits = [];
  for (const x of b) {
    const n = Number(x);
    if (A.has(n)) hits.push(n);
  }
  return hits;
}

// -------------------- Date scoring --------------------
function dateScore(hq, js) {
  const reasons = [];
  let score = 0, dateFlag = false;

  // Ongoing
  if (hq.ongoing && js.ongoing) {
    score += ONGOING_BONUS;
    reasons.push(`Both sides indicate ongoing (+${ONGOING_BONUS})`);
  }

  // End date
  if (hq.expiryDate && js.expiryDate) {
    const diff = Math.abs(daysBetweenISO(hq.expiryDate, js.expiryDate) ?? 999);
    if (diff === 0) {
      score += EXACT_END_BONUS; reasons.push(`End date exact match (+${EXACT_END_BONUS})`);
    } else if (diff <= DATE_TOLERANCE_DAYS) {
      score += CLOSE_END_BONUS; reasons.push(`End dates within ${DATE_TOLERANCE_DAYS} days (+${CLOSE_END_BONUS})`);
    } else {
      dateFlag = true; reasons.push(`End dates differ by ${diff} days`);
    }
  } else if (hq.expiryDate || js.expiryDate) {
    reasons.push("Only one side has an end date");
  }

  // Start date
  if (hq.startDate && js.startDate) {
    const diff = Math.abs(daysBetweenISO(hq.startDate, js.startDate) ?? 999);
    if (diff === 0) {
      score += EXACT_START_BONUS; reasons.push(`Start date exact match (+${EXACT_START_BONUS})`);
    } else if (diff <= DATE_TOLERANCE_DAYS) {
      score += CLOSE_START_BONUS; reasons.push(`Start dates within ${DATE_TOLERANCE_DAYS} days (+${CLOSE_START_BONUS})`);
    } else {
      dateFlag = true; reasons.push(`Start dates differ by ${diff} days`);
    }
  } else if (hq.startDate || js.startDate) {
    reasons.push("Only one side has a start date");
  }

  return { scoreDelta: score, reasons, dateFlag };
}

// -------------------- Numeric checks --------------------
function numericChecks(hq, js) {
  const reasons = [];
  let score = 0;
  let reject = false;
  let numberFlag = false;

  // Money
  const hm = hq.moneyValues || [], jm = js.moneyValues || [];
  if (hm.length && jm.length) {
    const inter = arrayIntersectNums(hm, jm);
    if (!inter.length && HARD_REJECT_ON_MONEY_MISMATCH) {
      reasons.push("Money value mismatch – automatic rejection");
      reject = true; numberFlag = true;
    } else if (inter.length) {
      score += inter.length * 25;
      reasons.push(`Shared money values ${inter.join(", ")} (+${inter.length * 25})`);
    }
  }

  // Percentages
  const hp = hq.percents || [], jp = js.percents || [];
  if (!reject && hp.length && jp.length) {
    const inter = arrayIntersectNums(hp, jp);
    if (!inter.length && HARD_REJECT_ON_PERCENT_MISMATCH) {
      reasons.push("Percentage mismatch – automatic rejection");
      reject = true; numberFlag = true;
    } else if (inter.length) {
      score += inter.length * 20;
      reasons.push(`Shared percents ${inter.join("%, ")}% (+${inter.length * 20})`);
    }
  }

  // General numbers (not hard-rejecting; just bonus if overlap)
  if (!reject) {
    const hn = hq.numbers || [], jn = js.numbers || [];
    const inter = arrayIntersectNums(hn, jn);
    if (inter.length) {
      score += Math.min(30, inter.length * 5);
      reasons.push(`Shared numbers ${inter.join(", ")} (+${Math.min(30, inter.length * 5)})`);
    }
  }

  return { reject, numberFlag, scoreDelta: score, reasons };
}

// -------------------- Keyword / text scoring --------------------
function keywordScore(hq, js) {
  const reasons = [];
  let score = 0;

  const hTitleT = tokenize(hq.title);
  const jTitleT = tokenize(js.title);
  const hListT  = tokenize(hq.shopListing);
  const jListT  = tokenize(js.shopListing);

  const titleJac = jaccard(hTitleT, jTitleT);
  const listJac  = jaccard(hListT,  jListT);

  if (titleJac > 0) {
    const add = Math.round(titleJac * 100 * KEYWORD_WEIGHT);
    score += add;
    reasons.push(`Title keyword overlap ${(titleJac*100).toFixed(0)}% (+${add})`);
  }
  if (listJac > 0) {
    const add = Math.round(listJac * 100 * KEYWORD_WEIGHT * LISTING_BONUS);
    score += add;
    reasons.push(`Listing keyword overlap ${(listJac*100).toFixed(0)}% (+${add})`);
  }

  return { scoreDelta: score, reasons };
}

// -------------------- Strict match check --------------------
function strictMatch(hqDeal, jsonDeal) {
  // Vendor must match exactly after canonicalization (UI already gates, but keep guard)
  if (hqDeal.vendor !== jsonDeal.vendor) return false;

  // If both have end dates, require exact match
  if (hqDeal.expiryDate && jsonDeal.expiryDate) {
    if (hqDeal.expiryDate !== jsonDeal.expiryDate) return false;
  }

  // If both sides have any money/percent sets, require at least one overlap in each type
  const hm = hqDeal.moneyValues || [], jm = jsonDeal.moneyValues || [];
  if (hm.length && jm.length && arrayIntersectNums(hm, jm).length === 0) return false;

  const hp = hqDeal.percents || [], jp = jsonDeal.percents || [];
  if (hp.length && jp.length && arrayIntersectNums(hp, jp).length === 0) return false;

  // Titles should be reasonably close
  const titleJac = jaccard(tokenize(hqDeal.title), tokenize(jsonDeal.title));
  if (titleJac < 0.25) return false;

  return true;
}

// -------------------- Main scoring --------------------
function compareDealScore(hqDeal, jsonDeal) {
  const reasons = [];
  const flags = {
    vendor: false,
    numberFlag: false,
    dateFlag: false,
    exclusiveFlag: false
  };
  let score = 0;

  // Vendor gate
  if (hqDeal.vendor !== jsonDeal.vendor) {
    return { score: 0, reasons: ["Vendor mismatch"], flags };
  }
  flags.vendor = true;

  // Exclusives
  const exclHQ = !!hqDeal.exclusive;
  const exclJS = !!jsonDeal.exclusive;
  if (exclHQ && exclJS) {
    score += EXCLUSIVE_BONUS;
    flags.exclusiveFlag = true;
    reasons.push(`Exclusive on both sides (+${EXCLUSIVE_BONUS})`);
  } else if (exclHQ || exclJS) {
    flags.exclusiveFlag = true;
    reasons.push("Exclusive mentioned on one side");
  }

  // Numbers (may reject)
  const num = numericChecks(hqDeal, jsonDeal);
  reasons.push(...num.reasons);
  flags.numberFlag = num.numberFlag;
  if (num.reject) return { score: 0, reasons, flags };
  score += num.scoreDelta;

  // Dates
  const d = dateScore(hqDeal, jsonDeal);
  score += d.scoreDelta;
  reasons.push(...d.reasons);
  if (d.dateFlag) flags.dateFlag = true;

  // Keywords
  const kw = keywordScore(hqDeal, jsonDeal);
  score += kw.scoreDelta;
  reasons.push(...kw.reasons);

  return { score, reasons, flags };
}

// -------------------- Orchestration --------------------
function performMatching(hqText, jsonText, threshold = 120) {
  const hqDeals = parseHQDeals(hqText);
  const jsDeals = parseJSONDeals(jsonText);

  const matched = [];
  const nonMatched = [];

  for (const hq of hqDeals) {
    let best = null;
    let bestScore = -1;
    let bestReasons = [];
    let bestFlags = {};

    for (const js of jsDeals) {
      // Quick vendor gate for perf
      if (hq.vendor !== js.vendor) continue;

      // Strict path
      if (strictMatch(hq, js)) {
        const reasons = ["Strict match: vendor, title, numbers/dates aligned (+999)"];
        matched.push({
          hqDeal: hq,
          jsonDeal: js,
          score: 999,
          reasons,
          flags: { vendor: true, numberFlag: false, dateFlag: false, exclusiveFlag: (hq.exclusive && js.exclusive) },
          perfect: true
        });
        best = null; // nothing else to do for this HQ deal
        break;
      }

      // Scored path
      const { score, reasons, flags } = compareDealScore(hq, js);
      if (score > bestScore) {
        bestScore = score;
        best = js;
        bestReasons = reasons;
        bestFlags = flags;
      }
    }

    if (best) {
      if (bestScore >= threshold) {
        matched.push({
          hqDeal: hq,
          jsonDeal: best,
          score: bestScore,
          reasons: bestReasons,
          flags: bestFlags,
          perfect: false
        });
      } else {
        nonMatched.push({
          hqDeal: hq,
          closestJson: best,
          score: bestScore,
          reasons: bestReasons,
          flags: bestFlags
        });
      }
    } else if (best === null && matched.length && matched[matched.length - 1]?.hqDeal === hq) {
      // already pushed via strict path; nothing
    } else {
      // No candidate at all (likely vendor missing in JSON universe)
      nonMatched.push({
        hqDeal: hq,
        closestJson: null,
        score: 0,
        reasons: ["No candidate with matching vendor found"],
        flags: { vendor: false, numberFlag: false, dateFlag: false, exclusiveFlag: false }
      });
    }
  }

  return { matched, nonMatched };
}

// -------------------- Expose --------------------
window.strictMatch = strictMatch;
window.compareDealScore = compareDealScore;
window.performMatching = performMatching;

// End of match.js
