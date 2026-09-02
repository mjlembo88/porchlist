export const PLANS = {
  free: {
    id: "free",
    label: "Free listing",
    monthly: 0,
    featured: false,
    inventory: false,
    preorder: false,
    ads: false,
    blurb: "Map pin, hours, directions, follow, and messages. Shoppers stay free.",
  },
  basic: {
    id: "basic",
    label: "Basic",
    monthly: 5,
    featured: false,
    inventory: true,
    preorder: true,
    ads: false,
    blurb: "Today's board plus a preorder sheet shoppers fill from the stand page.",
  },
  plus: {
    id: "plus",
    label: "Plus",
    monthly: 10,
    featured: true,
    inventory: true,
    preorder: true,
    ads: false,
    blurb: "Basic, plus a rust featured pin and list highlights.",
  },
  premium: {
    id: "premium",
    label: "Premium",
    monthly: 20,
    featured: true,
    inventory: true,
    preorder: true,
    ads: true,
    blurb: "Everything in Plus, featured ads, and more services later.",
  },
} as const;

export type PlanId = keyof typeof PLANS;
export const PAID_PLANS = ["basic", "plus", "premium"] as const;

export function normalizePlan(plan: string): PlanId {
  if (plan === "premium" || plan === "pro") return "premium";
  if (plan === "plus") return "plus";
  if (plan === "basic" || plan === "founding" || plan === "stand") return "basic";
  return "free";
}

export function planMeta(plan: string) {
  return PLANS[normalizePlan(plan)];
}

export function canUseInventory(plan: string) {
  return planMeta(plan).inventory;
}

export function canTakePreorder(plan: string) {
  return planMeta(plan).preorder;
}

export function isFeaturedPlan(plan: string) {
  return planMeta(plan).featured;
}

export function canRunAds(plan: string) {
  return planMeta(plan).ads;
}

/** Shopper tally is always on when a stand has a board. */
export function canShopperCheckout(_plan?: string) {
  return true;
}
