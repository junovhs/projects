import { ALL_PARTNERS, PRIORITY_TIERS, SUPPLIER_ALIASES } from "./data";
import type { AppState, Deal, RawDeal } from "./types";

export function isLux(name: string): boolean {
  const p = ALL_PARTNERS.find((partner) => partner.name === name);
  return !!p && ["luxury", "expedition"].includes(p.category);
}

function pickRandomLux(exclude: Set<string>, currentLineup: string[]): string | null {
  const candidates = ALL_PARTNERS.filter((p) =>
    ["luxury", "expedition"].includes(p.category) &&
    !currentLineup.includes(p.name) &&
    !exclude.has(p.name)
  );

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].name;
}

function fillSlots(
  lineup: string[],
  candidates: string[],
  exclude: Set<string>,
  limit: number
): void {
  const shuffled = [...candidates].sort(() => 0.5 - Math.random());

  for (const name of shuffled) {
    if (lineup.length >= limit) break;
    if (!lineup.includes(name) && !exclude.has(name)) {
      lineup.push(name);
    }
  }
}

export function computeLineup(state: AppState): string[] {
  const lineup: string[] = [];
  const exclude = new Set([...state.lastWeekPartners]);

  // 1. Add manual selections
  state.activeThisWeek.forEach((name) => {
    if (!lineup.includes(name)) lineup.push(name);
  });

  // 2. Ensure at least one Lux partner if possible
  const hasLuxAlready = lineup.some((name) => isLux(name));
  if (!hasLuxAlready && lineup.length < 4) {
    const randomLux = pickRandomLux(exclude, lineup);
    if (randomLux) lineup.push(randomLux);
  }

  // 3. Populate from Priority Tiers
  for (const tier of PRIORITY_TIERS) {
    if (lineup.length >= 4) break;
    fillSlots(lineup, tier, exclude, 4);
  }

  // 4. Fallback to Popular category
  if (lineup.length < 4) {
    const popularNames = ALL_PARTNERS
      .filter((p) => p.category === "popular")
      .map((p) => p.name);
    fillSlots(lineup, popularNames, exclude, 4);
  }

  return lineup.slice(0, 4);
}

export function normalizeSupplier(name: string): string {
  const key = (name || "").toLowerCase().trim()
    // biome-ignore lint/complexity/noUselessEscapeInRegex: Escape required for slash in literal
    .replace(/[.,\/#!$%\^&*;:{}=\-_`~()']/g, "")
    .replace(/\s+/g, " ").trim();
  return SUPPLIER_ALIASES[key] || name;
}

function formatDate(dStr: string | undefined): string {
  if (!dStr) return "";
  const clean = String(dStr).toLowerCase().trim();
  if (["call for details", "contact us", "ongoing"].includes(clean)) {
    return "Ongoing";
  }
  try {
    const d = new Date(dStr);
    if (Number.isNaN(d.getTime())) return "";
    return `Ends ${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return "";
  }
}

function parseSingleDeal(deal: RawDeal): Deal | null {
  const { status, shopOverline, title, shopListing, dealCategory, expiryDate } = deal;

  if (!shopOverline || !title || !shopListing || status !== "live") return null;

  const displayName = normalizeSupplier(shopOverline);
  const isExclusive = Array.isArray(dealCategory) && dealCategory.includes(39542);
  const formattedExpiry = formatDate(expiryDate);

  let expiryDateObj: Date | null = null;
  if (formattedExpiry && formattedExpiry !== "Ongoing" && expiryDate) {
    const tmp = new Date(expiryDate);
    if (!Number.isNaN(tmp.getTime())) expiryDateObj = tmp;
  }

  return {
    id: crypto.randomUUID(),
    displayName,
    title: String(title),
    description: String(shopListing),
    exclusive: isExclusive,
    formattedExpiry,
    expiryDateObj
  };
}

export function parseDeals(arr: unknown[]): Deal[] {
  if (!Array.isArray(arr)) return [];
  const out: Deal[] = [];

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const deal = parseSingleDeal(item as RawDeal);
    if (deal) out.push(deal);
  }
  return out;
}

export function sortDeals(deals: Deal[]): Deal[] {
  const fallback = new Date("2099-12-31");
  return [...deals].sort((a, b) => {
    const cmp = a.displayName.localeCompare(b.displayName);
    if (cmp !== 0) return cmp;

    const exclA = a.exclusive ? 1 : 0;
    const exclB = b.exclusive ? 1 : 0;
    if (exclA !== exclB) return exclB - exclA;

    const dateA = (a.expiryDateObj || fallback).getTime();
    const dateB = (b.expiryDateObj || fallback).getTime();
    return dateA - dateB;
  });
}