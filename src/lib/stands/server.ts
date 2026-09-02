import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { SEED_STANDS } from "./catalog";
import { normalizePlan } from "@/lib/billing/plans";
import type {
  AccessType, AppFeatures, FarmStand, InventoryItem, PinQuality, Review, Special, StandKind,
} from "./types";

type StandRow = {
  id: string;
  name: string;
  kind: string;
  access: string;
  county: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  pin_quality: string;
  hours: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  products: string;
  notes: string | null;
  source_notes: string | null;
  featured: boolean;
  listed: boolean | null;
  plan: string;
  claim_status: string;
  claimed_name: string | null;
  owner_user_id: string | null;
  latest_special: string | null;
  venmo_username: string | null;
  zelle_handle: string | null;
  zelle_destination: string | null;
  cashapp_cashtag: string | null;
  paypal_me_slug: string | null;
  pickup_windows: string | null;
};

export function fromRow(row: StandRow): FarmStand {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind === "bakery" || row.kind === "market" ? row.kind : "stand") as StandKind,
    access: (["preorder", "markets", "check-page", "seasonal"].includes(row.access)
      ? row.access
      : "walk-up") as AccessType,
    county: row.county,
    city: row.city,
    address: row.address,
    zip: row.zip,
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    pinQuality: (row.pin_quality === "exact" || row.pin_quality === "approx" ? row.pin_quality : "none") as PinQuality,
    hours: row.hours,
    phone: row.phone,
    email: row.email,
    website: row.website,
    facebook: row.facebook,
    instagram: row.instagram,
    products: (row.products ?? "").split(",").map((p) => p.trim()).filter(Boolean),
    notes: row.notes,
    sourceNotes: row.source_notes,
    featured: Boolean(row.featured),
    listed: row.listed !== false,
    plan: normalizePlan(row.plan),
    claimStatus: row.claim_status === "pending" || row.claim_status === "claimed" ? row.claim_status : "unclaimed",
    claimedName: row.claimed_name,
    ownerUserId: row.owner_user_id,
    latestSpecial: row.latest_special,
    venmoUsername: row.venmo_username,
    zelleHandle: row.zelle_handle,
    zelleDestination: row.zelle_destination,
    cashappCashtag: row.cashapp_cashtag,
    paypalMeSlug: row.paypal_me_slug,
    pickupWindows: row.pickup_windows,
  };
}

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  const sql = await getSql();
  for (const s of SEED_STANDS) {
    await sql.query(
      `insert into stands (
         id, name, kind, access, county, city, address, zip, lat, lng, pin_quality,
         hours, phone, email, website, facebook, instagram, products, notes, source_notes, featured
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       on conflict (id) do update set
         name = excluded.name, kind = excluded.kind, access = excluded.access, county = excluded.county,
         city = excluded.city, address = excluded.address, zip = excluded.zip, lat = excluded.lat, lng = excluded.lng,
         pin_quality = excluded.pin_quality, hours = excluded.hours, products = excluded.products, notes = excluded.notes,
         featured = stands.featured or excluded.featured, updated_at = now()`,
      [
        s.id, s.name, s.kind, s.access, s.county, s.city, s.address, s.zip, s.lat, s.lng,
        s.pinQuality, s.hours, s.phone, s.email, s.website, s.facebook, s.instagram,
        s.products.join(","), s.notes, s.sourceNotes, s.featured,
      ],
    );
  }
  const n = await sql.query<{ n: number }>("select count(*)::int as n from specials");
  if ((n[0]?.n ?? 0) === 0) {
    const demos = [
      ["the-storehouse", "Friday bread drop", "Sourdough and focaccia until sellout."],
      ["three-dog-farm", "In season", "Tomatoes, basil, cucumber. Honor box if we step away."],
      ["beasley-farms", "U-pick flowers", "Saturday morning until noon."],
      ["moore-market", "Eggs + honey", "Fresh dozen restocked this morning."],
      ["southern-sunshine-farms", "Berry pints", "Blueberries while they last."],
    ];
    for (const [id, title, body] of demos) {
      await sql.query(`insert into specials (id, stand_id, title, body) values ($1,$2,$3,$4)`, [
        `seed-${id}`, id, title, body,
      ]);
    }
  }
  const itemN = await sql.query<{ n: number }>("select count(*)::int as n from items");
  if ((itemN[0]?.n ?? 0) === 0) {
    const seedItems: [string, string, string, number, boolean][] = [
      ["beasley-farms", "U-pick bouquet", "bunch", 1200, false],
      ["beasley-farms", "Tomatoes", "lb", 350, false],
      ["three-dog-farm", "Eggs", "dozen", 600, true],
      ["three-dog-farm", "Tomatoes", "lb", 300, false],
      ["three-dog-farm", "Basil", "bunch", 300, false],
      ["the-storehouse", "Sourdough", "each", 800, true],
      ["the-storehouse", "Focaccia", "each", 900, true],
      ["moore-market", "Eggs", "dozen", 650, true],
      ["moore-market", "Honey", "pint", 1200, true],
    ];
    for (const [standId, name, unit, cents, pre] of seedItems) {
      await sql.query(
        `insert into items (id, stand_id, name, unit, price_cents, status, preorderable, decrement_on_sale)
         values ($1,$2,$3,$4,$5,'in',$6,true)`,
        [`seed-${standId}-${name.toLowerCase().replace(/\s+/g, "-")}`, standId, name, unit, cents, pre],
      );
    }
  }
  await sql.query(
    `update stands set pickup_windows = coalesce(pickup_windows, 'Sat 8–noon · Sun 9–1')
     where id in ('three-dog-farm','the-storehouse','moore-market')`,
  );
  await sql.query(
    `update stands
       set venmo_username = coalesce(venmo_username, 'BeasleyFarms'),
           zelle_handle = coalesce(zelle_handle, 'Beasley Farms'),
           zelle_destination = coalesce(zelle_destination, '727-555-0198'),
           cashapp_cashtag = coalesce(cashapp_cashtag, 'beasleyfarms')
     where id = 'beasley-farms'`,
  );
  await sql.query(
    `update stands
       set venmo_username = coalesce(venmo_username, 'MooreMarket'),
           zelle_handle = coalesce(zelle_handle, 'Moore Market'),
           zelle_destination = coalesce(zelle_destination, '352-555-0142'),
           paypal_me_slug = coalesce(paypal_me_slug, 'mooremarket')
     where id = 'moore-market'`,
  );
  await sql.query(
    `update stands
       set venmo_username = coalesce(venmo_username, 'ThreeDogFarm'),
           zelle_handle = coalesce(zelle_handle, 'Three Dog Farm'),
           zelle_destination = coalesce(zelle_destination, '352-555-0160')
     where id = 'three-dog-farm'`,
  );
  await sql.query(
    `update stands set plan = 'premium', featured = true
     where id in ('three-dog-farm','the-storehouse','moore-market')`,
  );
  await sql.query(
    `update stands set plan = 'plus', featured = true
     where id in ('beasley-farms','southern-sunshine-farms')`,
  );
  seeded = true;
}

const SELECT = `select s.*, (select sp.body from specials sp where sp.stand_id = s.id order by sp.created_at desc limit 1) as latest_special from stands s`;

export const listStands = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql.query<StandRow>(`${SELECT} where s.listed is not false order by s.name asc`);
  return rows.map(fromRow);
});

export const getStandBundle = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const stands = await sql.query<StandRow>(`${SELECT} where s.id = $1`, [data.id]);
    const stand = stands[0] ? fromRow(stands[0]) : null;
    const items = await sql.query<{
      id: string; stand_id: string; name: string; unit: string; price_cents: number; status: string;
      photo: string | null; preorderable: boolean; max_qty: number | null; decrement_on_sale: boolean;
    }>(
      `select id, stand_id, name, unit, price_cents, status, photo, preorderable, max_qty, decrement_on_sale from items where stand_id = $1 order by sort_order, name`,
      [data.id],
    );
    const specials = await sql.query<{ id: string; stand_id: string; title: string; body: string; created_at: string }>(
      `select id, stand_id, title, body, created_at::text as created_at from specials where stand_id = $1 order by created_at desc limit 8`,
      [data.id],
    );
    const reviews = await sql.query<{
      id: string; stand_id: string; nickname: string; rating: number; body: string; hidden: boolean; created_at: string;
      reply_id: string | null; reply_body: string | null; reply_at: string | null; flagged: boolean;
    }>(
      `select r.id, r.stand_id, r.nickname, r.rating, r.body, r.hidden, r.created_at::text as created_at,
              rp.id as reply_id, rp.body as reply_body, rp.created_at::text as reply_at,
              exists(select 1 from review_flags f where f.review_id = r.id and f.status = 'pending') as flagged
       from reviews r
       left join review_replies rp on rp.review_id = r.id
       where r.stand_id = $1 and r.hidden = false
       order by r.created_at desc limit 40`,
      [data.id],
    );
    return {
      stand,
      items: items.map((r): InventoryItem => ({
        id: r.id,
        standId: r.stand_id,
        name: r.name,
        unit: r.unit,
        priceCents: Number(r.price_cents),
        status: r.status === "low" || r.status === "out" ? r.status : "in",
        photo: r.photo,
        preorderable: Boolean(r.preorderable),
        maxQty: r.max_qty == null ? null : Number(r.max_qty),
        decrementOnSale: Boolean(r.decrement_on_sale),
      })),
      specials: specials.map((s): Special => ({
        id: s.id, standId: s.stand_id, standName: stand?.name ?? "", title: s.title, body: s.body, createdAt: s.created_at,
      })),
      reviews: reviews.map((r): Review => ({
        id: r.id,
        standId: r.stand_id,
        nickname: r.nickname,
        rating: Number(r.rating),
        body: r.body,
        hidden: Boolean(r.hidden),
        createdAt: r.created_at,
        reply: r.reply_id && r.reply_body ? { id: r.reply_id, body: r.reply_body, createdAt: r.reply_at ?? "" } : null,
        flagged: Boolean(r.flagged),
      })),
    };
  });

export const getAppFeatures = createServerFn({ method: "GET" }).handler(async (): Promise<AppFeatures> => {
  const sql = await getSql();
  const rows = await sql.query<{ key: string; value: string }>(`select key, value from app_settings`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    shopperCheckout: map.shopper_checkout !== "false",
    guestOrders: map.guest_orders !== "false",
    shopperMessages: map.shopper_messages !== "false",
  };
});

export const addReview = createServerFn({ method: "POST" })
  .validator(z.object({
    standId: z.string(),
    nickname: z.string().min(1).max(40),
    rating: z.number().int().min(1).max(5),
    body: z.string().min(2).max(800),
  }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into reviews (id, stand_id, nickname, rating, body) values ($1,$2,$3,$4,$5)`,
      [crypto.randomUUID(), data.standId, data.nickname.trim(), data.rating, data.body.trim()],
    );
    return { ok: true };
  });

export const flagReview = createServerFn({ method: "POST" })
  .validator(z.object({ reviewId: z.string(), standId: z.string(), reason: z.string().min(2).max(200) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into review_flags (id, review_id, stand_id, reason, status) values ($1,$2,$3,$4,'pending')`,
      [crypto.randomUUID(), data.reviewId, data.standId, data.reason.trim()],
    );
    return { ok: true };
  });

export const messageOwner = createServerFn({ method: "POST" })
  .validator(z.object({
    standId: z.string(),
    nickname: z.string().min(1).max(40),
    body: z.string().min(2).max(400),
  }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into owner_inbox (id, stand_id, nickname, body) values ($1,$2,$3,$4)`,
      [crypto.randomUUID(), data.standId, data.nickname.trim(), data.body.trim()],
    );
    return { ok: true };
  });
