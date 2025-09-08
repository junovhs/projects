// match.js — scoring and matching

let _lastHQDeals = [], _lastJSONDeals = [], _lastThreshold = 150;

// Utility equality helpers
function arraysEqual(a, b){
  if (a.length !== b.length) return false;
  const A = a.slice().sort(), B = b.slice().sort();
  for (let i=0;i<A.length;i++){ if (A[i] !== B[i]) return false; }
  return true;
}
function moneyArraysEqual(a, b, tol){
  if (a.length !== b.length) return false;
  const A = a.slice().sort((x,y)=>x-y), B = b.slice().sort((x,y)=>x-y);
  for (let i=0;i<A.length;i++){ if (Math.abs(A[i]-B[i])>tol) return false; }
  return true;
}

// Strict matching = your “manual” 3 checks
function strictMatch(hqDeal, jsonDeal){
  if (hqDeal.vendor !== jsonDeal.vendor) return false;

  const jsAll = `${jsonDeal.title} ${jsonDeal.shopListing}`.trim();

  const numsHQ = [...extractMoneyValues(hqDeal.text), ...extractPercentageValues(hqDeal.text), ...extractSpecialNumericAll(hqDeal.text)].sort((a,b)=>a-b);
  const numsJS = [...extractMoneyValues(jsAll), ...extractPercentageValues(jsAll), ...extractSpecialNumericAll(jsAll)].sort((a,b)=>a-b);

  // Numbers: if present on both sides, they must be equal (within 1 cent for money)
  const moneyHQ = extractMoneyValues(hqDeal.text);
  const moneyJS = extractMoneyValues(jsAll);
  if (moneyHQ.length && moneyJS.length && !moneyArraysEqual(moneyHQ, moneyJS, 0.01)) return false;

  const pctHQ = extractPercentageValues(hqDeal.text);
  const pctJS = extractPercentageValues(jsAll);
  if (pctHQ.length && pctJS.length && !arraysEqual(pctHQ, pctJS)) return false;

  const spHQ = extractSpecialNumericAll(hqDeal.text);
  const spJS = extractSpecialNumericAll(jsAll);
  if (spHQ.length && spJS.length && !arraysEqual(spHQ, spJS)) return false;

  // Categories / keywords share at least one real word
  const kwHQ = extractNormalizedKeywords(hqDeal.text);
  const kwJS = extractNormalizedKeywords(jsAll);
  if (!(kwHQ.length && kwJS.length && keywordSetOverlap(kwHQ, kwJS).length)) return false;

  // Date exact match (or JSON has no date)
  if (jsonDeal.expiryDate){
    if (!sameExpiry(hqDeal.text, jsonDeal.expiryDate)) return false;
  }
  return true;
}

function sameExpiry(hqText, jsExpiryStr){
  const hq = extractNormalizedExpiry(hqText);
  const js = normalizeJSONExpiry(jsExpiryStr);
  if (!hq || !js) return false;
  return hq.ymd === js.ymd;
}

// Main scoring function
function compareDealScore(hqDeal, jsonDeal){
  if (hqDeal.vendor !== jsonDeal.vendor) {
    return { score: 0, reasons: ["Vendor mismatch"], flags: {} };
  }
  let reasons = [], score = 0, flags = {};

  reasons.push(`Vendor: ${hqDeal.vendor} (required)`);

  const jsAllText = `${jsonDeal.title} ${jsonDeal.shopListing}`.trim();
  const hqExp = extractNormalizedExpiry(hqDeal.text);
  const jsExp = normalizeJSONExpiry(jsonDeal.expiryDate);

  const hqPerc = extractPercentageValues(hqDeal.text);
  const jsPerc = extractPercentageValues(jsAllText);
  const hqMoney = extractMoneyValues(hqDeal.text);
  const jsMoney = extractMoneyValues(jsAllText);
  const hqSpecials = extractSpecialNumericAll(hqDeal.text);
  const jsSpecials = extractSpecialNumericAll(jsAllText);

  const hqOBC = hasOBC(hqDeal.text), jsOBC = hasOBC(jsAllText);
  const hqGrat = hasGratuity(hqDeal.text), jsGrat = hasGratuity(jsAllText);
  const hqKids = hasKids(hqDeal.text), jsKids = hasKids(jsAllText);

  function numbersOnBoth(){ 
    return (hqMoney.length && jsMoney.length) || (hqPerc.length && jsPerc.length) || (hqSpecials.length && jsSpecials.length);
  }

  // ------ Hard rejections on numeric contradictions ------
  if (hqPerc.length && jsPerc.length && !arraysEqual(hqPerc, jsPerc)){
    reasons.push("Percentage value mismatch - automatic rejection");
    return { score: 0, reasons, flags: {} };
  }
  if (hqSpecials.length && jsSpecials.length && !arraysEqual(hqSpecials, jsSpecials)){
    reasons.push("Special numeric value mismatch - automatic rejection");
    return { score: 0, reasons, flags: {} };
  }
  if (hqMoney.length && jsMoney.length && !moneyArraysEqual(hqMoney, jsMoney, 0.01)){
    reasons.push("Money value mismatch - automatic rejection");
    return { score: 0, reasons, flags: {} };
  }

  // ------ Build score ------

  // Numeric equality bonuses
  let numbersEqual = false;
  if (hqMoney.length && jsMoney.length && moneyArraysEqual(hqMoney, jsMoney, 0.01)){
    score += 60; numbersEqual = true;
    reasons.push(`Money match: $${hqMoney.map(x=>x.toFixed(2)).join(", $")} (+60)`);
  }
  if (hqPerc.length && jsPerc.length && arraysEqual(hqPerc, jsPerc)){
    score += 60; numbersEqual = true; reasons.push("Percentage match (+60)");
  }
  if (hqSpecials.length && jsSpecials.length && arraysEqual(hqSpecials, jsSpecials)){
    score += 60; numbersEqual = true; reasons.push("Special numeric match (+60)");
  }

  // One-sided numbers (present only on one side) → penalty, no synergy
  const numericOneSided = !numbersOnBoth() && ((hqMoney.length + hqPerc.length + hqSpecials.length) > 0 || (jsMoney.length + jsPerc.length + jsSpecials.length) > 0);
  if (numericOneSided){
    score -= 40; reasons.push("Numeric present on only one side (-40)");
    flags.numericOneSided = true;
  }

  // Presence flags
  if (hqOBC && jsOBC){ score += 35; reasons.push("OBC present (+35)"); }
  if (hqGrat && jsGrat){ score += 35; reasons.push("Gratuities present (+35)"); }
  if (hqKids && jsKids){ score += 35; reasons.push("Kids present (+35)"); }

  // Keywords
  const kwsHQ = extractNormalizedKeywords(hqDeal.text, {noExclusive:true});
  const kwsJS = extractNormalizedKeywords(jsAllText, {noExclusive:true});
  const commonKW = keywordSetOverlap(kwsHQ, kwsJS);
  if (commonKW.length){
    score += commonKW.length*15;
    reasons.push(`${commonKW.length} keyword(s) match (+${commonKW.length*15})`);
  }
  if (commonKW.includes("limited")) { score += 16; reasons.push("Limited-time phrase (+16)"); }

  // Date score
  let dateFlag = false, dateDiffDays = null;
  if (hqExp && jsExp){
    dateDiffDays = Math.round(Math.abs(hqExp.dateObj - jsExp.dateObj)/(1000*60*60*24));
    if (hqExp.ymd === jsExp.ymd){
      score += 50; reasons.push("Exact date match (+50)");
    } else if (dateDiffDays <= 5){
      score += 22; reasons.push("Date within 5 days (+22)"); dateFlag = true;
    } else {
      reasons.push("Date mismatch"); dateFlag = true;
    }
  }

  // Synergy bonuses
  if (numbersEqual && commonKW.length){
    score += 25; reasons.push("Synergy bonus: numeric+keyword (+25)");
  }
  if (numbersEqual && hqExp && jsExp && hqExp.ymd===jsExp.ymd && commonKW.length){
    score += 60; reasons.push("All-match synergy (+60)");
    flags.highConfidence = true;
  }

  // Exclusive flag (only in JSON)
  flags.exclusiveFlag = exclusiveFlag(hqDeal.text, jsAllText);

  // Clamp and return
  score = Math.max(0, Math.min(510, score));
  return { score, reasons, flags, commonKW, percentMatch: !!(hqPerc.length && jsPerc.length && arraysEqual(hqPerc, jsPerc)), moneyMatch: !!(hqMoney.length && jsMoney.length && moneyArraysEqual(hqMoney, jsMoney, 0.01)), numbersEqual, dateFlag, dateDiffDays, hqExp };
}

// Perform full matching and enforce unique assignment
function performMatching(hqDeals, jsonDeals, threshold){
  _lastHQDeals = hqDeals; _lastJSONDeals = jsonDeals; _lastThreshold = threshold;
  const candidate = [], nonMatched = [];

  hqDeals.forEach(hq => {
    let best = { score: 0 }, idx = null, isStrictMatch = false;

    jsonDeals.forEach((js, i) => {
      // 1) Try strict match (your 3 checks)
      if (strictMatch(hq, js)){
        best = { score: threshold + 100, reasons: ["Strict match: exact numbers, categories and dates"], jsonDeal: js };
        idx = i; isStrictMatch = true;
        return; // stop evaluating this HQ against other JSON
      }
      // 2) Otherwise, compute score
      if (!isStrictMatch){
        const res = compareDealScore(hq, js);
        if (res.score > best.score){ best = res; best.jsonDeal = js; idx = i; }
      }
    });

    if (best.score >= threshold){
      candidate.push({ hqDeal: hq, jsonDeal: best.jsonDeal, score: best.score, jsonIndex: idx, reasons: best.reasons, isStrictMatch });
    } else {
      nonMatched.push(hq);
    }
  });

  // Unique assignment by best score per JSON index
  const unique = {};
  candidate.forEach(c => {
    const existing = unique[c.jsonIndex];
    if (!existing || c.score > existing.score) unique[c.jsonIndex] = c;
  });

  // HQs that lost the tiebreak go to nonMatched
  candidate.forEach(c => { if (unique[c.jsonIndex] !== c) nonMatched.push(c.hqDeal); });

  return { matched: Object.values(unique), nonMatched };
}

// For hover: best match under the threshold
function findClosestMatch(hqDeal, jsonDeals, minThreshold){
  let best = { score: 0 }, idx = null;
  jsonDeals.forEach((js, i) => {
    const res = compareDealScore(hqDeal, js);
    if (res.score > best.score){ best = res; idx = i; best.jsonDeal = js; }
  });
  return (best.score > 0 && best.score < minThreshold) ? best : null;
}

// expose
window.performMatching = performMatching;
window.compareDealScore = compareDealScore;
window.findClosestMatch = findClosestMatch;
window.strictMatch = strictMatch;
