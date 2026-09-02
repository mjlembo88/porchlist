export type StandKind = "stand" | "bakery" | "market";
export type AccessType = "walk-up" | "preorder" | "markets" | "check-page" | "seasonal";
export type PinQuality = "exact" | "approx" | "none";
export type PlanId = "free" | "basic" | "plus" | "premium";

export type SeedStand = {
  id: string;
  name: string;
  kind: StandKind;
  access: AccessType;
  county: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  pinQuality: PinQuality;
  hours: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  products: string[];
  notes: string | null;
  sourceNotes: string | null;
  featured: boolean;
};

export type FarmStand = SeedStand & {
  listed: boolean;
  plan: PlanId;
  claimStatus: "unclaimed" | "pending" | "claimed";
  claimedName: string | null;
  ownerUserId: string | null;
  latestSpecial: string | null;
  venmoUsername: string | null;
  zelleHandle: string | null;
  zelleDestination: string | null;
  cashappCashtag: string | null;
  paypalMeSlug: string | null;
  pickupWindows: string | null;
  ratingAvg: number;
  reviewCount: number;
};

export type InventoryItem = {
  id: string;
  standId: string;
  name: string;
  unit: string;
  priceCents: number;
  status: "in" | "low" | "out";
  photo: string | null;
  preorderable: boolean;
  maxQty: number | null;
  decrementOnSale: boolean;
};

export type TicketLine = {
  id: string;
  itemId: string | null;
  name: string;
  unit: string | null;
  qty: number;
  priceCents: number;
};

export type TicketStatus = "open" | "accepted" | "paid" | "void";

export type Ticket = {
  id: string;
  standId: string;
  source: "walkup" | "preorder";
  status: TicketStatus;
  customerName: string | null;
  pickupWindow: string | null;
  note: string | null;
  discountCents: number;
  taxCents: number;
  customCents: number;
  customLabel: string | null;
  tender: string | null;
  tenderedCents: number | null;
  changeCents: number | null;
  totalCents: number;
  receivedAt: string | null;
  createdAt: string;
  lines: TicketLine[];
};

export type Special = {
  id: string;
  standId: string;
  standName: string;
  title: string;
  body: string;
  createdAt: string;
};

export type Review = {
  id: string;
  standId: string;
  nickname: string;
  rating: number;
  body: string;
  hidden: boolean;
  createdAt: string;
  reply: { id: string; body: string; createdAt: string } | null;
  flagged: boolean;
};

export type FlagItem = {
  id: string;
  reviewId: string;
  standId: string;
  standName: string;
  reason: string;
  status: "pending" | "kept" | "removed";
  createdAt: string;
  nickname: string;
  body: string;
};

export type OwnerRequest = {
  id: string;
  standId: string;
  standName: string;
  userId: string;
  name: string;
  phone: string | null;
  note: string | null;
  status: "pending" | "approved" | "denied";
  createdAt: string;
};

export type OwnedStand = {
  id: string;
  name: string;
  city: string | null;
  plan: PlanId;
};

export type PendingAccess = {
  id: string;
  standId: string;
  standName: string;
  createdAt: string;
};

export type CustomerRow = {
  id: string;
  nickname: string;
  phone: string | null;
  lastStandId: string | null;
  updatedAt: string;
};

export type AppFeatures = {
  shopperCheckout: boolean;
  guestOrders: boolean;
  shopperMessages: boolean;
};

export const KIND_LABEL: Record<StandKind, string> = {
  stand: "Farm stand",
  bakery: "Bakery",
  market: "Market",
};

export const DEMO_STAND_ID = "three-dog-farm";
export const APP_NAME = "StandStrong";

export const ACCESS_LABEL: Record<string, string> = {
  "walk-up": "Walk up",
  preorder: "Preorder",
  markets: "Markets",
  "check-page": "Check page",
  seasonal: "Seasonal",
};

export const SLOGAN = "Stand strong and Farm on";
export const TAGLINE = "Farm stands near you";

export function mapTicketStatus(raw: string): TicketStatus {
  if (raw === "paid" || raw === "fulfilled") return "paid";
  if (raw === "void" || raw === "declined") return "void";
  if (raw === "accepted") return "accepted";
  return "open";
}

export function ticketStatusLabel(status: TicketStatus) {
  if (status === "open") return "New";
  if (status === "accepted") return "Accepted";
  if (status === "paid") return "Fulfilled";
  return "Declined";
}

export function formatRating(avg: number) {
  if (!Number.isFinite(avg) || avg <= 0) return "New";
  return avg.toFixed(1);
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isOpenToday(hours: string | null) {
  if (!hours) return true;
  let h = hours.toLowerCase();
  h = h
    .replace(/sundays?/g, "sun")
    .replace(/mondays?/g, "mon")
    .replace(/tuesdays?/g, "tue")
    .replace(/wednesdays?/g, "wed")
    .replace(/thursdays?/g, "thu")
    .replace(/fridays?/g, "fri")
    .replace(/saturdays?/g, "sat");
  if (/daily|every day|7 days/.test(h)) return true;
  const today = new Date().getDay();
  const open = new Set<number>();
  if (/\bweekends?\b/.test(h)) {
    open.add(0);
    open.add(6);
  }
  const rangeRe = /\b(sun|mon|tue|wed|thu|fri|sat)\b\s*[–-]\s*\b(sun|mon|tue|wed|thu|fri|sat)\b/g;
  for (const m of h.matchAll(rangeRe)) {
    const a = DAYS.indexOf(m[1] as (typeof DAYS)[number]);
    const b = DAYS.indexOf(m[2] as (typeof DAYS)[number]);
    if (a < 0 || b < 0) continue;
    if (a <= b) {
      for (let i = a; i <= b; i++) open.add(i);
    } else {
      for (let i = a; i <= 6; i++) open.add(i);
      for (let i = 0; i <= b; i++) open.add(i);
    }
  }
  const stripped = h.replace(rangeRe, " ");
  DAYS.forEach((d, i) => {
    if (new RegExp(`\\b${d}\\b`).test(stripped)) open.add(i);
  });
  if (open.size === 0) return true;
  return open.has(today);
}
