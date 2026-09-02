import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { parseIncomingList, UNITS, type SuggestedItem } from "@/lib/inventory/parse-list";
import { canUseInventory, isFeaturedPlan, normalizePlan, type PlanId } from "@/lib/billing/plans";
import type { InventoryItem, OwnedStand, PendingAccess, Ticket } from "./types";

async function assertOwner(standId: string, userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ owner_user_id: string | null }>(
    `select owner_user_id from stands where id = $1`,
    [standId],
  );
  const row = rows[0];
  if (!row) throw new Error("Stand not found");
  if (row.owner_user_id !== userId) throw new Error("Not your stand");
  return sql;
}

async function assertInventoryOwner(standId: string, userId: string) {
  const sql = await assertOwner(standId, userId);
  const rows = await sql.query<{ plan: string }>(`select plan from stands where id = $1`, [standId]);
  if (!canUseInventory(rows[0]?.plan ?? "free")) {
    throw new Error("Today's board and the preorder sheet start on Basic ($5/month).");
  }
  return sql;
}

async function rememberCustomer(sql: Awaited<ReturnType<typeof getSql>>, nickname: string, standId: string, phone?: string | null) {
  const existing = await sql.query<{ id: string }>(
    `select id from customers where lower(nickname) = lower($1) limit 1`,
    [nickname],
  );
  if (existing[0]) {
    await sql.query(
      `update customers set last_stand_id = $2, phone = coalesce($3, phone), updated_at = now() where id = $1`,
      [existing[0].id, standId, phone ?? null],
    );
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await sql.query(
    `insert into customers (id, nickname, phone, last_stand_id) values ($1,$2,$3,$4)`,
    [id, nickname, phone ?? null, standId],
  );
  return id;
}

function itemFrom(r: {
  id: string; stand_id: string; name: string; unit: string; price_cents: number; status: string;
  photo: string | null; preorderable: boolean; max_qty: number | null; decrement_on_sale: boolean;
}): InventoryItem {
  return {
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
  };
}

const UNIT_SET = new Set<string>(UNITS);

function coerceSuggested(raw: unknown): SuggestedItem[] {
  const obj = raw as { items?: unknown };
  if (!obj || !Array.isArray(obj.items)) return [];
  const out: SuggestedItem[] = [];
  for (const row of obj.items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const unitRaw = String(r.unit ?? "each").toLowerCase();
    const unit = (UNIT_SET.has(unitRaw) ? unitRaw : "each") as SuggestedItem["unit"];
    const price = Number(r.priceCents);
    const status = r.status === "low" || r.status === "out" ? r.status : "in";
    out.push({
      name,
      unit,
      priceCents: Number.isFinite(price) ? Math.max(0, Math.round(price)) : 0,
      status,
      preorderable: Boolean(r.preorderable),
    });
  }
  return out;
}

async function readBoardFromPhoto(dataUrl: string, extraText: string): Promise<SuggestedItem[] | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  if (!dataUrl.startsWith("data:image/")) return null;
  const prompt = `Extract a farm-stand chalkboard / price board into JSON only.
Return {"items":[{"name":"Raw 5oz honey","unit":"jar","priceCents":1000,"status":"in","preorderable":false}]}
Rules:
- Keep pack size in the name (Raw 5oz honey, not Honey oz)
- unit must be one of: each, oz, lb, pint, jar, bunch, dozen, bag, box
- priceCents is the listed dollar price as integer cents ($10 = 1000, $6 = 600). Never use the size (5oz) as the price
- status is in, low, or out
- Ignore art, slogans, and hours
- No markdown, no commentary.${extraText.trim() ? `\nOwner also typed:\n${extraText.trim()}` : ""}`;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 800,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let text = body.choices?.[0]?.message?.content ?? "";
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return coerceSuggested(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}

export const listMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const owned = await sql.query<{ id: string; name: string; city: string | null; plan: string }>(
      `select id, name, city, plan from stands where owner_user_id = $1 order by name asc`,
      [context.userId],
    );
    const pending = await sql.query<{ id: string; stand_id: string; stand_name: string; created_at: string }>(
      `select r.id, r.stand_id, s.name as stand_name, r.created_at::text as created_at
       from owner_requests r join stands s on s.id = r.stand_id
       where r.user_id = $1 and r.status = 'pending' order by r.created_at desc`,
      [context.userId],
    );
    return {
      owned: owned.map((r): OwnedStand => ({ id: r.id, name: r.name, city: r.city, plan: normalizePlan(r.plan) })),
      pending: pending.map((r): PendingAccess => ({
        id: r.id, standId: r.stand_id, standName: r.stand_name, createdAt: r.created_at,
      })),
    };
  });

export const requestStandAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    standId: z.string(),
    name: z.string().min(1).max(60),
    phone: z.string().max(40).optional(),
    note: z.string().max(400).optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stand = await sql.query<{ id: string; owner_user_id: string | null }>(
      `select id, owner_user_id from stands where id = $1`,
      [data.standId],
    );
    if (!stand[0]) throw new Error("Stand not found");
    if (stand[0].owner_user_id === context.userId) throw new Error("You already run this listing.");
    if (stand[0].owner_user_id) throw new Error("This listing already has an owner. Admin has to move it.");
    const open = await sql.query<{ id: string }>(
      `select id from owner_requests where user_id = $1 and stand_id = $2 and status = 'pending' limit 1`,
      [context.userId, data.standId],
    );
    if (open[0]) return { ok: true, id: open[0].id, already: true };
    const id = crypto.randomUUID();
    await sql.query(
      `insert into owner_requests (id, stand_id, user_id, name, phone, note, status) values ($1,$2,$3,$4,$5,$6,'pending')`,
      [id, data.standId, context.userId, data.name.trim(), data.phone?.trim() || null, data.note?.trim() || null],
    );
    await sql.query(
      `insert into profiles (user_id, role, display_name, phone) values ($1,'shopper',$2,$3)
       on conflict (user_id) do update set display_name = excluded.display_name, phone = coalesce(excluded.phone, profiles.phone)`,
      [context.userId, data.name.trim(), data.phone?.trim() || null],
    );
    return { ok: true, id, already: false };
  });

export const listItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const rows = await sql.query<Parameters<typeof itemFrom>[0]>(
      `select id, stand_id, name, unit, price_cents, status, photo, preorderable, max_qty, decrement_on_sale from items where stand_id = $1 order by sort_order, name`,
      [data.standId],
    );
    return rows.map(itemFrom);
  });

const itemInput = z.object({
  standId: z.string(),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(16),
  priceCents: z.number().int().min(0).max(100000),
  status: z.enum(["in", "low", "out"]),
  photo: z.string().max(400000).nullable().optional(),
  preorderable: z.boolean(),
  maxQty: z.number().int().min(0).max(999).nullable().optional(),
  decrementOnSale: z.boolean(),
  id: z.string().optional(),
});

export const upsertItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(itemInput)
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    const id = data.id ?? crypto.randomUUID();
    await sql.query(
      `insert into items (id, stand_id, name, unit, price_cents, status, photo, preorderable, max_qty, decrement_on_sale)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set name = excluded.name, unit = excluded.unit, price_cents = excluded.price_cents,
         status = excluded.status, photo = excluded.photo, preorderable = excluded.preorderable,
         max_qty = excluded.max_qty, decrement_on_sale = excluded.decrement_on_sale`,
      [
        id, data.standId, data.name.trim(), data.unit, data.priceCents, data.status,
        data.photo ?? null, data.preorderable, data.maxQty ?? null, data.decrementOnSale,
      ],
    );
    return { id };
  });

export const removeItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string(), id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    await sql.query(`delete from items where id = $1 and stand_id = $2`, [data.id, data.standId]);
    return { ok: true };
  });

export const publishSuggestions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    standId: z.string(),
    items: z.array(z.object({
      name: z.string(),
      unit: z.string(),
      priceCents: z.number().int(),
      status: z.enum(["in", "low", "out"]),
      preorderable: z.boolean(),
    })),
  }))
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    for (const it of data.items) {
      await sql.query(
        `insert into items (id, stand_id, name, unit, price_cents, status, preorderable, decrement_on_sale)
         values ($1,$2,$3,$4,$5,$6,$7,true)`,
        [crypto.randomUUID(), data.standId, it.name, it.unit, it.priceCents, it.status, it.preorderable],
      );
    }
    return { ok: true, n: data.items.length };
  });

export const replacePreorderSheet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    standId: z.string(),
    items: z.array(z.object({
      name: z.string().min(1).max(80),
      unit: z.string().min(1).max(16),
      priceCents: z.number().int().min(0).max(100000),
      status: z.enum(["in", "low", "out"]).default("in"),
    })),
  }))
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    await sql.query(`delete from items where stand_id = $1 and preorderable = true`, [data.standId]);
    for (const it of data.items) {
      const name = it.name.trim().slice(0, 80);
      if (!name) continue;
      await sql.query(
        `insert into items (id, stand_id, name, unit, price_cents, status, preorderable, decrement_on_sale)
         values ($1,$2,$3,$4,$5,$6,true,true)`,
        [crypto.randomUUID(), data.standId, name, it.unit, it.priceCents, it.status],
      );
    }
    return { ok: true, n: data.items.length };
  });

export const suggestFromBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    standId: z.string(),
    text: z.string().max(4000).optional(),
    imageDataUrl: z.string().max(450000).optional(),
  }))
  .handler(async ({ context, data }): Promise<{ items: SuggestedItem[]; note: string }> => {
    await assertInventoryOwner(data.standId, context.userId);
    const text = data.text?.trim() ?? "";
    let items: SuggestedItem[] = [];
    let note = "Confirm these rows before they go on the board.";
    if (data.imageDataUrl) {
      const vision = await readBoardFromPhoto(data.imageDataUrl, text);
      if (vision && vision.length) {
        items = vision;
        note = "Read from the chalkboard. Confirm before they go live.";
      } else if (text) {
        items = parseIncomingList(text);
        note = "Could not read the photo. Used the typed list instead — confirm before publish.";
      } else {
        note = "Could not read that photo. Type the board (Eggs $6 dozen) or try a closer shot.";
      }
    } else {
      items = parseIncomingList(text);
      if (!items.length) note = "Could not read prices. Type the board (Eggs $6 dozen) or photograph it.";
    }
    return { items, note };
  });

export const snapshotBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    const rows = await sql.query(`select name, unit, price_cents, status, preorderable, decrement_on_sale from items where stand_id = $1`, [
      data.standId,
    ]);
    await sql.query(`insert into board_snapshots (id, stand_id, payload) values ($1,$2,$3)`, [
      crypto.randomUUID(), data.standId, JSON.stringify(rows),
    ]);
    return { ok: true };
  });

export const duplicateYesterday = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertInventoryOwner(data.standId, context.userId);
    const snaps = await sql.query<{ payload: string }>(
      `select payload from board_snapshots where stand_id = $1 order by created_at desc limit 1`,
      [data.standId],
    );
    if (!snaps[0]) throw new Error("No saved board yet — tap Save board first.");
    const rows = JSON.parse(snaps[0].payload) as { name: string; unit: string; price_cents: number; status: string; preorderable: boolean; decrement_on_sale: boolean }[];
    await sql.query(`delete from items where stand_id = $1`, [data.standId]);
    for (const it of rows) {
      await sql.query(
        `insert into items (id, stand_id, name, unit, price_cents, status, preorderable, decrement_on_sale)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [crypto.randomUUID(), data.standId, it.name, it.unit, it.price_cents, it.status, it.preorderable, it.decrement_on_sale],
      );
    }
    return { ok: true };
  });

export const savePaySettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    standId: z.string(),
    venmoUsername: z.string().max(40).optional(),
    zelleHandle: z.string().max(60).optional(),
    zelleDestination: z.string().max(80).optional(),
    cashappCashtag: z.string().max(40).optional(),
    paypalMeSlug: z.string().max(60).optional(),
    pickupWindows: z.string().max(200).optional(),
    hours: z.string().max(160).optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    await sql.query(
      `update stands set venmo_username = $2, zelle_handle = $3, zelle_destination = $4, cashapp_cashtag = $5,
        paypal_me_slug = $6, pickup_windows = $7, hours = coalesce($8, hours), updated_at = now() where id = $1`,
      [
        data.standId,
        data.venmoUsername ?? null,
        data.zelleHandle ?? null,
        data.zelleDestination ?? null,
        data.cashappCashtag ?? null,
        data.paypalMeSlug ?? null,
        data.pickupWindows ?? null,
        data.hours ?? null,
      ],
    );
    return { ok: true };
  });

export const postSpecial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string(), title: z.string().min(2).max(80), body: z.string().min(2).max(400) }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    await sql.query(`insert into specials (id, stand_id, title, body) values ($1,$2,$3,$4)`, [
      crypto.randomUUID(), data.standId, data.title.trim(), data.body.trim(),
    ]);
    return { ok: true };
  });

export const postFollowerNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string(), body: z.string().min(2).max(400) }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    await sql.query(`insert into stand_messages (id, stand_id, body) values ($1,$2,$3)`, [
      crypto.randomUUID(), data.standId, data.body.trim(),
    ]);
    return { ok: true };
  });

export const subscribePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string(), plan: z.enum(["basic", "plus", "premium"]) }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const featured = isFeaturedPlan(data.plan);
    await sql.query(
      `update stands set plan = $2, featured = $3, updated_at = now() where id = $1`,
      [data.standId, data.plan, featured],
    );
    return { ok: true, plan: data.plan as PlanId };
  });

export const listOwnerInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const rows = await sql.query<{ id: string; nickname: string; body: string; created_at: string }>(
      `select id, nickname, body, created_at::text as created_at from owner_inbox where stand_id = $1 order by created_at desc limit 60`,
      [data.standId],
    );
    return rows.map((r) => ({ id: r.id, nickname: r.nickname, body: r.body, createdAt: r.created_at }));
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const tickets = await sql.query<{
      id: string; stand_id: string; source: string; status: string; customer_name: string | null;
      pickup_window: string | null; note: string | null; discount_cents: number; tax_cents: number;
      custom_cents: number; custom_label: string | null; tender: string | null; tendered_cents: number | null;
      change_cents: number | null; total_cents: number; received_at: string | null; created_at: string;
    }>(
      `select id, stand_id, source, status, customer_name, pickup_window, note, discount_cents, tax_cents,
              custom_cents, custom_label, tender, tendered_cents, change_cents, total_cents,
              received_at::text as received_at, created_at::text as created_at
       from tickets where stand_id = $1 order by created_at desc limit 80`,
      [data.standId],
    );
    if (tickets.length === 0) return [];
    const lines = await sql.query<{
      id: string; ticket_id: string; item_id: string | null; name: string; unit: string | null; qty: number; price_cents: number;
    }>(
      `select id, ticket_id, item_id, name, unit, qty, price_cents from ticket_lines where ticket_id = any($1::text[])`,
      [tickets.map((tk) => tk.id)],
    );
    return tickets.map((t): Ticket => ({
      id: t.id,
      standId: t.stand_id,
      source: t.source === "preorder" ? "preorder" : "walkup",
      status: t.status === "paid" || t.status === "void" ? t.status : "open",
      customerName: t.customer_name,
      pickupWindow: t.pickup_window,
      note: t.note,
      discountCents: Number(t.discount_cents),
      taxCents: Number(t.tax_cents),
      customCents: Number(t.custom_cents),
      customLabel: t.custom_label,
      tender: t.tender,
      tenderedCents: t.tendered_cents == null ? null : Number(t.tendered_cents),
      changeCents: t.change_cents == null ? null : Number(t.change_cents),
      totalCents: Number(t.total_cents),
      receivedAt: t.received_at,
      createdAt: t.created_at,
      lines: lines.filter((l) => l.ticket_id === t.id).map((l) => ({
        id: l.id, itemId: l.item_id, name: l.name, unit: l.unit, qty: Number(l.qty), priceCents: Number(l.price_cents),
      })),
    }));
  });

const lineZ = z.object({
  itemId: z.string().nullable(),
  name: z.string(),
  unit: z.string().nullable(),
  qty: z.number().int().min(1).max(99),
  priceCents: z.number().int().min(0),
});

export const placePreorder = createServerFn({ method: "POST" })
  .validator(z.object({
    standId: z.string(),
    customerName: z.string().min(1).max(60),
    pickupWindow: z.string().max(80),
    note: z.string().max(200).optional(),
    phone: z.string().max(40).optional(),
    lines: z.array(lineZ).min(1),
  }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const stand = await sql.query<{ id: string }>(`select id from stands where id = $1`, [data.standId]);
    if (!stand[0]) throw new Error("Stand not found");
    const customerId = await rememberCustomer(sql, data.customerName.trim(), data.standId, data.phone);
    const id = crypto.randomUUID();
    const total = data.lines.reduce((s, l) => s + l.qty * l.priceCents, 0);
    await sql.query(
      `insert into tickets (id, stand_id, source, status, customer_name, pickup_window, note, total_cents, customer_id)
       values ($1,$2,'preorder','open',$3,$4,$5,$6,$7)`,
      [id, data.standId, data.customerName.trim(), data.pickupWindow, data.note ?? null, total, customerId],
    );
    for (const l of data.lines) {
      await sql.query(
        `insert into ticket_lines (id, ticket_id, item_id, name, unit, qty, price_cents) values ($1,$2,$3,$4,$5,$6,$7)`,
        [crypto.randomUUID(), id, l.itemId, l.name, l.unit, l.qty, l.priceCents],
      );
    }
    return { id, totalCents: total };
  });

export const markPreorderPicked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string(), ticketId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const rows = await sql.query<{ id: string }>(
      `select id from tickets where id = $1 and stand_id = $2 and source = 'preorder' and status = 'open'`,
      [data.ticketId, data.standId],
    );
    if (!rows[0]) throw new Error("Preorder not found");
    await sql.query(
      `update tickets set status = 'paid', tender = 'preorder', received_at = now() where id = $1 and stand_id = $2`,
      [data.ticketId, data.standId],
    );
    return { ok: true };
  });

export const socialCaption = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ standId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await assertOwner(data.standId, context.userId);
    const stand = await sql.query<{ name: string; hours: string | null; city: string | null }>(
      `select name, hours, city from stands where id = $1`,
      [data.standId],
    );
    const items = await sql.query<{ name: string }>(
      `select name from items where stand_id = $1 and status in ('in','low') order by name`,
      [data.standId],
    );
    const names = items.map((i) => i.name);
    const list = names.length === 0
      ? "the honor box is out"
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const s = stand[0];
    return {
      caption: `${list} at ${s?.name ?? "the stand"} today${s?.city ? ` in ${s.city}` : ""}.\n${s?.hours ?? "Hours on the board."}\n\nStand strong and Farm on.\nStandLocal — local farm stands near you.`,
    };
  });
