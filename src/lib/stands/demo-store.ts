import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_STANDS } from "./catalog";
import {
  DEMO_STAND_ID,
  type FarmStand,
  type InventoryItem,
  type Review,
  type Special,
  type Ticket,
  type TicketLine,
  type TicketStatus,
} from "./types";
import type { PlanId } from "./types";

type DemoState = {
  hydrated: boolean;
  stands: FarmStand[];
  items: InventoryItem[];
  reviews: Review[];
  specials: Special[];
  tickets: Ticket[];
  ensureSeed: () => void;
  listStands: () => FarmStand[];
  getBundle: (id: string) => {
    stand: FarmStand | null;
    items: InventoryItem[];
    specials: Special[];
    reviews: Review[];
  };
  addReview: (input: { standId: string; nickname: string; rating: number; body: string }) => Review;
  placeOrder: (input: {
    standId: string;
    source: "walkup" | "preorder";
    customerName: string;
    pickupWindow: string;
    note: string | null;
    phone?: string | null;
    lines: { itemId: string; name: string; unit: string; qty: number; priceCents: number }[];
  }) => Ticket;
  listDemoTickets: () => Ticket[];
  updateDemoOrder: (ticketId: string, status: TicketStatus) => void;
  upsertItem: (item: Omit<InventoryItem, "id"> & { id?: string }) => InventoryItem;
  setItemStatus: (id: string, status: InventoryItem["status"]) => void;
  removeItem: (id: string) => void;
  postSpecial: (standId: string, title: string, body: string) => void;
};

const PREMIUM = new Set(["three-dog-farm", "the-storehouse", "moore-market"]);
const PLUS = new Set(["beasley-farms", "southern-sunshine-farms"]);
const PICKUP = new Set(["three-dog-farm", "the-storehouse", "moore-market"]);

const SEED_ITEMS: [string, string, string, number, boolean, number][] = [
  ["beasley-farms", "U-pick bouquet", "bunch", 1200, false, 18],
  ["beasley-farms", "Tomatoes", "lb", 350, false, 24],
  ["beasley-farms", "Sunflowers", "bunch", 800, true, 12],
  ["three-dog-farm", "Eggs", "dozen", 600, true, 14],
  ["three-dog-farm", "Tomatoes", "lb", 300, false, 20],
  ["three-dog-farm", "Basil", "bunch", 300, false, 8],
  ["three-dog-farm", "Cucumber", "each", 150, false, 30],
  ["the-storehouse", "Sourdough", "each", 800, true, 10],
  ["the-storehouse", "Focaccia", "each", 900, true, 8],
  ["moore-market", "Eggs", "dozen", 650, true, 16],
  ["moore-market", "Honey", "pint", 1200, true, 6],
  ["casa-pan", "Country loaf", "each", 700, false, 9],
  ["casa-pan", "Jam jar", "jar", 850, false, 11],
  ["southern-sunshine-farms", "Blueberries", "pint", 700, false, 15],
  ["the-daily-rise", "Morning bun", "each", 450, true, 12],
];

const SEED_REVIEWS: [string, string, string, number, string][] = [
  ["rev-td-mara", "three-dog-farm", "Mara", 5, "Tomatoes still warm. Honor box was stocked."],
  ["rev-td-jon", "three-dog-farm", "Jon", 4, "Eggs gone by 10. Basil was perfect."],
  ["rev-td-lee", "three-dog-farm", "Lee", 5, "Cucumbers snapped. Easy pin, easy parking."],
  ["rev-beasley-tess", "beasley-farms", "Tess", 5, "U-pick bouquet lasted a week."],
  ["rev-beasley-cal", "beasley-farms", "Cal", 4, "Saturday line moves. Cash in the tin."],
  ["rev-moore-ana", "moore-market", "Ana", 5, "Honey and a dozen. Kids loved the eggs."],
  ["rev-store-bill", "the-storehouse", "Bill", 5, "Sourdough crust sang. Preordered for Sunday."],
  ["rev-casa-kim", "casa-pan", "Kim", 4, "Cookies and jam. Small porch, easy to miss."],
  ["rev-sun-pat", "southern-sunshine-farms", "Pat", 5, "Blueberry pints were full. Worth the drive."],
  ["rev-rise-nia", "the-daily-rise", "Nia", 5, "Morning bun still warm at 10."],
];

const SEED_SPECIALS: [string, string, string][] = [
  ["the-storehouse", "Friday bread drop", "Sourdough and focaccia until sellout."],
  ["three-dog-farm", "In season", "Tomatoes, basil, cucumber. Honor box if we step away."],
  ["beasley-farms", "U-pick flowers", "Saturday morning until noon."],
  ["moore-market", "Eggs + honey", "Fresh dozen restocked this morning."],
  ["southern-sunshine-farms", "Berry pints", "Blueberries while they last."],
];

function buildStands(reviews: Review[], specials: Special[]): FarmStand[] {
  return SEED_STANDS.map((s) => {
    const rs = reviews.filter((r) => r.standId === s.id && !r.hidden);
    const ratingAvg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;
    const latest = specials.find((sp) => sp.standId === s.id)?.body ?? null;
    let plan: PlanId = "free";
    if (PREMIUM.has(s.id)) plan = "premium";
    else if (PLUS.has(s.id)) plan = "plus";
    const pay =
      s.id === "beasley-farms"
        ? { venmoUsername: "BeasleyFarms", zelleHandle: "Beasley Farms", zelleDestination: "727-555-0198", cashappCashtag: "beasleyfarms", paypalMeSlug: null }
        : s.id === "moore-market"
          ? { venmoUsername: "MooreMarket", zelleHandle: "Moore Market", zelleDestination: "352-555-0142", cashappCashtag: null, paypalMeSlug: "mooremarket" }
          : s.id === "three-dog-farm"
            ? { venmoUsername: "ThreeDogFarm", zelleHandle: "Three Dog Farm", zelleDestination: "352-555-0160", cashappCashtag: null, paypalMeSlug: null }
            : { venmoUsername: null, zelleHandle: null, zelleDestination: null, cashappCashtag: null, paypalMeSlug: null };
    return {
      ...s,
      listed: true,
      plan,
      claimStatus: s.id === DEMO_STAND_ID ? ("claimed" as const) : ("unclaimed" as const),
      claimedName: s.id === DEMO_STAND_ID ? "Three Dog Farm" : null,
      ownerUserId: s.id === DEMO_STAND_ID ? "demo-owner" : null,
      latestSpecial: latest,
      ...pay,
      pickupWindows: PICKUP.has(s.id) ? "Sat 8–noon · Sun 9–1" : null,
      ratingAvg,
      reviewCount: rs.length,
      featured: PREMIUM.has(s.id) || PLUS.has(s.id) || s.featured,
    };
  });
}

function seedItems(): InventoryItem[] {
  return SEED_ITEMS.map(([standId, name, unit, cents, pre, qty]) => ({
    id: `seed-${standId}-${name.toLowerCase().replace(/\s+/g, "-")}`,
    standId,
    name,
    unit,
    priceCents: cents,
    status: "in" as const,
    photo: null,
    preorderable: pre,
    maxQty: qty,
    decrementOnSale: true,
  }));
}

function seedReviews(): Review[] {
  const now = new Date().toISOString();
  return SEED_REVIEWS.map(([id, standId, nickname, rating, body]) => ({
    id,
    standId,
    nickname,
    rating,
    body,
    hidden: false,
    createdAt: now,
    reply: null,
    flagged: false,
  }));
}

function seedSpecials(): Special[] {
  const now = new Date().toISOString();
  const nameOf = (id: string) => SEED_STANDS.find((s) => s.id === id)?.name ?? id;
  return SEED_SPECIALS.map(([standId, title, body]) => ({
    id: `seed-${standId}`,
    standId,
    standName: nameOf(standId),
    title,
    body,
    createdAt: now,
  }));
}

function seedTickets(): Ticket[] {
  const now = new Date().toISOString();
  const mk = (
    id: string,
    standId: string,
    source: "walkup" | "preorder",
    status: TicketStatus,
    name: string,
    window: string,
    note: string | null,
    total: number,
    lines: [string, string, string, number, number][],
  ): Ticket => ({
    id,
    standId,
    source,
    status,
    customerName: name,
    pickupWindow: window,
    note,
    discountCents: 0,
    taxCents: 0,
    customCents: 0,
    customLabel: null,
    tender: null,
    tenderedCents: null,
    changeCents: null,
    totalCents: total,
    receivedAt: null,
    createdAt: now,
    lines: lines.map(([lname, unit, itemId, qty, cents], i): TicketLine => ({
      id: `${id}-l${i}`,
      itemId,
      name: lname,
      unit,
      qty,
      priceCents: cents,
    })),
  });
  return [
    mk("tkt-td-jess", "three-dog-farm", "walkup", "open", "Jess", "Today · walk-up", "Pay at pickup", 600, [
      ["Eggs", "dozen", "seed-three-dog-farm-eggs", 1, 600],
    ]),
    mk("tkt-td-mara", "three-dog-farm", "preorder", "accepted", "Mara", "Sat 8–noon", "Leave on the porch if we miss each other", 900, [
      ["Tomatoes", "lb", "seed-three-dog-farm-tomatoes", 2, 300],
      ["Basil", "bunch", "seed-three-dog-farm-basil", 1, 300],
    ]),
    mk("tkt-td-jon", "three-dog-farm", "preorder", "paid", "Jon", "Sun 9–1", null, 1200, [
      ["Eggs", "dozen", "seed-three-dog-farm-eggs", 2, 600],
    ]),
    mk("tkt-store-bill", "the-storehouse", "preorder", "open", "Bill", "Sun 9–1", "Sourdough if still warm", 1600, [
      ["Sourdough", "each", "seed-the-storehouse-sourdough", 2, 800],
    ]),
  ];
}

function recompute(standsIn: FarmStand[], reviews: Review[], specials: Special[]): FarmStand[] {
  return standsIn.map((s) => {
    const rs = reviews.filter((r) => r.standId === s.id && !r.hidden);
    const ratingAvg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;
    const latest = specials.find((sp) => sp.standId === s.id)?.body ?? s.latestSpecial;
    return { ...s, ratingAvg, reviewCount: rs.length, latestSpecial: latest };
  });
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      stands: [],
      items: [],
      reviews: [],
      specials: [],
      tickets: [],
      ensureSeed: () => {
        const cur = get();
        if (cur.stands.length > 0) {
          set({ hydrated: true });
          return;
        }
        const reviews = seedReviews();
        const specials = seedSpecials();
        set({
          hydrated: true,
          reviews,
          specials,
          items: seedItems(),
          tickets: seedTickets(),
          stands: buildStands(reviews, specials),
        });
      },
      listStands: () => {
        get().ensureSeed();
        return get().stands.filter((s) => s.listed !== false).slice().sort((a, b) => a.name.localeCompare(b.name));
      },
      getBundle: (id) => {
        get().ensureSeed();
        const stand = get().stands.find((s) => s.id === id) ?? null;
        return {
          stand,
          items: get().items.filter((i) => i.standId === id),
          specials: get().specials.filter((s) => s.standId === id),
          reviews: get()
            .reviews.filter((r) => r.standId === id && !r.hidden)
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        };
      },
      addReview: ({ standId, nickname, rating, body }) => {
        get().ensureSeed();
        const review: Review = {
          id: crypto.randomUUID(),
          standId,
          nickname: nickname.trim() || "Neighbor",
          rating: Math.min(5, Math.max(1, Math.round(rating))),
          body: body.trim().slice(0, 280),
          hidden: false,
          createdAt: new Date().toISOString(),
          reply: null,
          flagged: false,
        };
        set((s) => {
          const reviews = [review, ...s.reviews];
          return { reviews, stands: recompute(s.stands, reviews, s.specials) };
        });
        return review;
      },
      placeOrder: (input) => {
        get().ensureSeed();
        const total = input.lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
        const ticket: Ticket = {
          id: crypto.randomUUID(),
          standId: input.standId,
          source: input.source,
          status: "open",
          customerName: input.customerName.trim() || "Neighbor",
          pickupWindow: input.pickupWindow,
          note: input.note,
          discountCents: 0,
          taxCents: 0,
          customCents: 0,
          customLabel: null,
          tender: null,
          tenderedCents: null,
          changeCents: null,
          totalCents: total,
          receivedAt: null,
          createdAt: new Date().toISOString(),
          lines: input.lines.map((l, i) => ({
            id: `${Date.now()}-${i}`,
            itemId: l.itemId,
            name: l.name,
            unit: l.unit,
            qty: l.qty,
            priceCents: l.priceCents,
          })),
        };
        set((s) => {
          const items = s.items.map((it) => {
            const line = input.lines.find((l) => l.itemId === it.id);
            if (!line || !it.decrementOnSale || it.maxQty == null) return it;
            const next = Math.max(0, it.maxQty - line.qty);
            return {
              ...it,
              maxQty: next,
              status: next === 0 ? ("out" as const) : next <= 3 ? ("low" as const) : it.status,
            };
          });
          return { tickets: [ticket, ...s.tickets], items };
        });
        return ticket;
      },
      listDemoTickets: () => {
        get().ensureSeed();
        return get()
          .tickets.filter((t) => t.standId === DEMO_STAND_ID)
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      updateDemoOrder: (ticketId, status) => {
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)),
        }));
      },
      upsertItem: (item) => {
        get().ensureSeed();
        const id = item.id ?? crypto.randomUUID();
        const next: InventoryItem = {
          id,
          standId: item.standId,
          name: item.name,
          unit: item.unit,
          priceCents: item.priceCents,
          status: item.status,
          photo: item.photo ?? null,
          preorderable: item.preorderable,
          maxQty: item.maxQty,
          decrementOnSale: item.decrementOnSale,
        };
        set((s) => {
          const exists = s.items.some((i) => i.id === id);
          return {
            items: exists ? s.items.map((i) => (i.id === id ? next : i)) : [...s.items, next],
          };
        });
        return next;
      },
      setItemStatus: (id, status) => {
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, status } : i)) }));
      },
      removeItem: (id) => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      },
      postSpecial: (standId, title, body) => {
        get().ensureSeed();
        const stand = get().stands.find((s) => s.id === standId);
        const special: Special = {
          id: crypto.randomUUID(),
          standId,
          standName: stand?.name ?? standId,
          title: title.trim(),
          body: body.trim(),
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          const specials = [special, ...s.specials.filter((x) => x.standId !== standId || x.id.startsWith("seed-"))];
          return { specials, stands: recompute(s.stands, s.reviews, specials) };
        });
      },
    }),
    {
      name: "standstrong-pages-demo",
      partialize: (s) => ({
        stands: s.stands,
        items: s.items,
        reviews: s.reviews,
        specials: s.specials,
        tickets: s.tickets,
      }),
      onRehydrateStorage: () => (state) => {
        state?.ensureSeed();
      },
    },
  ),
);
