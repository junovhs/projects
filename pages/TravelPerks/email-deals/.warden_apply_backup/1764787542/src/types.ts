export type Category = 
  | 'popular' 
  | 'luxury' 
  | 'expedition' 
  | 'tour' 
  | 'disney' 
  | 'resort' 
  | 'vacation';

export interface Partner {
  name: string;
  short: string;
  category: Category;
}

export interface Deal {
  id: string;
  displayName: string;
  title: string;
  description: string;
  exclusive: boolean;
  formattedExpiry: string;
  expiryDateObj: Date | null;
}

export interface RawDeal {
  status: string;
  shopOverline: string;
  title: string;
  shopListing: string;
  dealCategory?: number[];
  expiryDate?: string;
}

export interface AppState {
  popularPotm: string;
  luxuryPotm: string;
  spotlights: string[];
  activeThisWeek: string[];
  lastWeekPartners: string[];
  computedLineup: string[];
  deals: Deal[];
  filteredDeals: Deal[];
  selectedDeals: Deal[];
  supplierFilter: string | null;
  filterByRotator: boolean;
  filterExclusive: boolean;
}