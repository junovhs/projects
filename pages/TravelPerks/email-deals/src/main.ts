import { ALL_PARTNERS } from "./data";
import { computeLineup, parseDeals, sortDeals } from "./logic";
import type { AppState } from "./types";
import * as UI from "./ui";

const state: AppState = {
  popularPotm: "",
  luxuryPotm: "",
  spotlights: [],
  activeThisWeek: [],
  lastWeekPartners: [],
  computedLineup: [],
  deals: [],
  filteredDeals: [],
  selectedDeals: [],
  supplierFilter: null,
  filterByRotator: false,
  filterExclusive: false
};

function saveState() {
  try {
    localStorage.setItem("hotdeals_state", JSON.stringify({
      popularPotm: state.popularPotm,
      luxuryPotm: state.luxuryPotm,
      spotlights: state.spotlights,
      activeThisWeek: state.activeThisWeek,
      lastWeekPartners: state.lastWeekPartners,
      computedLineup: state.computedLineup
    }));
  } catch (e) {
    console.error("Save failed", e);
  }
}

function refreshUI() {
  UI.renderActiveThisWeek(state, (name) => {
    state.activeThisWeek = state.activeThisWeek.filter((n) => n !== name);
    refreshUI();
    saveState();
  });

  UI.renderSpotlights(state, (name) => {
    state.spotlights = state.spotlights.filter((s) => s !== name);
    state.activeThisWeek = state.activeThisWeek.filter((s) => s !== name);
    refreshUI();
    saveState();
  });

  UI.renderResults(state);

  UI.renderLastWeekSelector(state, (name) => {
    if (state.lastWeekPartners.includes(name)) {
      state.lastWeekPartners = state.lastWeekPartners.filter((n) => n !== name);
    } else if (state.lastWeekPartners.length < 4) {
      state.lastWeekPartners.push(name);
    }
    refreshUI();
    saveState();
  });

  if (state.deals.length > 0) {
    filterAndRenderDeals();
  }
}

function filterAndRenderDeals() {
  let filtered = [...state.deals];

  if (state.filterByRotator && state.computedLineup.length > 0) {
    filtered = filtered.filter((d) => state.computedLineup.includes(d.displayName));
  }
  if (state.supplierFilter) {
    filtered = filtered.filter((d) => d.displayName === state.supplierFilter);
  }
  if (state.filterExclusive) {
    filtered = filtered.filter((d) => d.exclusive);
  }

  state.filteredDeals = filtered;
  state.selectedDeals = sortDeals(filtered);

  UI.renderDealList(state, (id) => {
    state.selectedDeals = state.selectedDeals.filter((d) => d.id !== id);
    UI.renderDealList(state, () => { }); // Re-bind not needed for simple remove
  });

  UI.renderSupplierChips(state, (name) => {
    state.supplierFilter = name;
    filterAndRenderDeals();
  });
}

function loadState() {
  try {
    const saved = localStorage.getItem("hotdeals_state");
    if (!saved) return;
    const data = JSON.parse(saved);

    state.popularPotm = data.popularPotm || "";
    state.luxuryPotm = data.luxuryPotm || "";
    state.spotlights = data.spotlights || [];
    state.activeThisWeek = data.activeThisWeek || [];
    state.lastWeekPartners = data.lastWeekPartners || [];
    state.computedLineup = data.computedLineup || [];

    const popSelect = UI.$("#popular-potm") as HTMLSelectElement;
    const luxSelect = UI.$("#luxury-potm") as HTMLSelectElement;
    if (popSelect) popSelect.value = state.popularPotm;
    if (luxSelect) luxSelect.value = state.luxuryPotm;

    refreshUI();
  } catch (e) {
    console.error("Load failed", e);
  }
}

function setupSelects() {
  const popSelect = UI.$("#popular-potm") as HTMLSelectElement;
  const luxSelect = UI.$("#luxury-potm") as HTMLSelectElement;
  const spotSelect = UI.$("#spotlight-select") as HTMLSelectElement;

  ALL_PARTNERS.filter((p) => p.category === "popular").forEach((p) => {
    popSelect?.add(new Option(p.short, p.name));
  });
  ALL_PARTNERS.filter((p) => ["luxury", "expedition"].includes(p.category)).forEach((p) => {
    luxSelect?.add(new Option(p.short, p.name));
  });
  ALL_PARTNERS.forEach((p) => {
    spotSelect?.add(new Option(p.short, p.name));
  });

  popSelect?.addEventListener("change", () => {
    state.popularPotm = popSelect.value;
    if (state.popularPotm && !state.activeThisWeek.includes(state.popularPotm)) {
      state.activeThisWeek.push(state.popularPotm);
    }
    refreshUI();
    saveState();
  });

  luxSelect?.addEventListener("change", () => {
    state.luxuryPotm = luxSelect.value;
    if (state.luxuryPotm && !state.activeThisWeek.includes(state.luxuryPotm)) {
      state.activeThisWeek.push(state.luxuryPotm);
    }
    refreshUI();
    saveState();
  });

  spotSelect?.addEventListener("change", () => {
    const val = spotSelect.value;
    if (val && !state.spotlights.includes(val)) {
      state.spotlights.push(val);
      state.activeThisWeek.push(val);
      refreshUI();
      saveState();
    }
    spotSelect.value = "";
  });
}

function setupButtons() {
  UI.$("#compute-btn")?.addEventListener("click", () => {
    if (state.activeThisWeek.length === 0) {
      alert("Please select at least one POTM or Spotlight as active this week");
      return;
    }
    state.computedLineup = computeLineup(state);
    refreshUI();
    saveState();
  });

  UI.$("#copy-names-btn")?.addEventListener("click", async (e) => {
    const btn = e.target as HTMLElement;
    await navigator.clipboard.writeText(state.computedLineup.join("\n"));
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });

  UI.$("#copy-deals-btn")?.addEventListener("click", async (e) => {
    if (state.selectedDeals.length === 0) return;
    const btn = e.target as HTMLElement;
    const text = state.selectedDeals.map((d) => `${d.displayName}\n${d.exclusive ? "EXCLUSIVE: " : ""}${d.title}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

function setupFilters() {
  UI.$("#json-file")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const uploadArea = UI.$("#upload-area");
    const uploadText = uploadArea?.querySelector(".upload-text");
    if (uploadText) uploadText.innerHTML = `<span class="file-name">${file.name}</span>`;
    uploadArea?.classList.add("has-file");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        state.deals = parseDeals(json);
        const filterEl = UI.$("#deal-filters");
        if (filterEl) filterEl.style.display = "block";
        const listEl = UI.$("#deal-list-container");
        if (listEl) listEl.style.display = "block";
        filterAndRenderDeals();
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  });

  UI.$("#filter-rotator")?.addEventListener("change", (e) => {
    state.filterByRotator = (e.target as HTMLInputElement).checked;
    filterAndRenderDeals();
  });

  UI.$("#filter-exclusive")?.addEventListener("change", (e) => {
    state.filterExclusive = (e.target as HTMLInputElement).checked;
    filterAndRenderDeals();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSelects();
  setupButtons();
  setupFilters();
  loadState();
});