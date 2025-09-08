
// app.js (enhanced)
// - Pre-deduplicate HQ lines before matching
// - Stores duplicates for UI panel

var matchedDeals = [];
var nonMatchedDeals = [];
window.hqDuplicates = [];

document.getElementById("compareButton").addEventListener("click", function() {
  var hqText = document.getElementById("hqDeals").value;
  var jsonText = document.getElementById("jsonDeals").value;
  var threshold = parseInt(document.getElementById("matchThreshold").value, 10);

  // Parse
  var hqDealsArr = parseHQDeals(hqText);
  var jsonDealsArr = parseJSONDeals(jsonText);

  // De-dupe HQ deals before we match
  const { unique, duplicates } = dedupeHQDeals(hqDealsArr);
  window.hqDuplicates = duplicates;

  matchedDeals = [];
  nonMatchedDeals = [];

  // Match
  var result = performMatching(unique, jsonDealsArr, threshold);
  matchedDeals = result.matched;
  nonMatchedDeals = result.nonMatched;

  renderAll();
});

document.getElementById("copyButton").addEventListener("click", copyNonMatchedToClipboard);
document.getElementById("matchedFilter").addEventListener("input", renderMatchedDeals);
document.getElementById("nonMatchedFilter").addEventListener("input", renderNonMatchedDeals);
