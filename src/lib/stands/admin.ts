import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { isFeaturedPlan, normalizePlan } from "@/lib/billing/plans";
import { assertAdminPin } from "./admin-gate";
import { ensureSeeded, fromRow } from "./server";
import type { CustomerRow, FarmStand, FlagItem, OwnerRequest } from "./types";

const pinZ = z.object({ pin: z.string() });

export const adminUnlock = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    return { ok: true };
  });

export const adminListStands = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    await ensureSeeded();
    const sql = await getSql();
    const rows = await sql.query(
      `select s.*, (select sp.body from specials sp where sp.stand_id = s.id order by sp.created_at desc limit 1) as latest_special from stands s order by s.name`,
    );
    return (rows as Parameters<typeof fromRow>[0][]).map(fromRow);
  });

export const adminListRequests = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string; stand_id: string; stand_name: string; user_id: string; name: string;
      phone: string | null; note: string | null; status: string; created_at: string;
    }>(
      `select r.id, r.stand_id, s.name as stand_name, r.user_id, r.name, r.phone, r.note, r.status,
              r.created_at::text as created_at
       from owner_requests r join stands s on s.id = r.stand_id
       order by r.created_at desc limit 80`,
    );
    return rows.map((r): OwnerRequest => ({
      id: r.id, standId: r.stand_id, standName: r.stand_name, userId: r.user_id,
      name: r.name, phone: r.phone, note: r.note,
      status: r.status === "approved" || r.status === "denied" ? r.status : "pending",
      createdAt: r.created_at,
    }));
  });

export const adminReviewRequest = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), id: z.string(), approve: z.boolean() }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const rows = await sql.query<{ stand_id: string; user_id: string; name: string }>(
      `select stand_id, user_id, name from owner_requests where id = $1`,
      [data.id],
    );
    if (!rows[0]) throw new Error("Request not found");
    if (data.approve) {
      await sql.query(
        `update stands set owner_user_id = $2, claim_status = 'claimed', claimed_name = $3, updated_at = now() where id = $1`,
        [rows[0].stand_id, rows[0].user_id, rows[0].name],
      );
      await sql.query(`update owner_requests set status = 'approved' where id = $1`, [data.id]);
      await sql.query(
        `insert into profiles (user_id, role, display_name) values ($1,'owner',$2)
         on conflict (user_id) do update set role = 'owner', display_name = coalesce(excluded.display_name, profiles.display_name)`,
        [rows[0].user_id, rows[0].name],
      );
    } else {
      await sql.query(`update owner_requests set status = 'denied' where id = $1`, [data.id]);
    }
    return { ok: true };
  });

export const adminCopyOwner = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), fromStandId: z.string(), toStandId: z.string() }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const from = await sql.query<{ owner_user_id: string | null; claimed_name: string | null }>(
      `select owner_user_id, claimed_name from stands where id = $1`,
      [data.fromStandId],
    );
    if (!from[0]?.owner_user_id) throw new Error("That listing has no owner to copy.");
    await sql.query(
      `update stands set owner_user_id = $2, claim_status = 'claimed', claimed_name = $3, updated_at = now() where id = $1`,
      [data.toStandId, from[0].owner_user_id, from[0].claimed_name],
    );
    return { ok: true };
  });

export const adminRevokeOwner = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), standId: z.string() }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const row = await sql.query<{ owner_user_id: string | null }>(
      `select owner_user_id from stands where id = $1`,
      [data.standId],
    );
    const uid = row[0]?.owner_user_id;
    await sql.query(
      `update stands set owner_user_id = null, claim_status = 'unclaimed', claimed_name = null, updated_at = now() where id = $1`,
      [data.standId],
    );
    if (uid) {
      const left = await sql.query<{ n: number }>(
        `select count(*)::int as n from stands where owner_user_id = $1`,
        [uid],
      );
      if ((left[0]?.n ?? 0) === 0) {
        await sql.query(`update profiles set role = 'shopper' where user_id = $1`, [uid]);
      }
    }
    return { ok: true };
  });

export const adminUpdateStand = createServerFn({ method: "POST" })
  .validator(z.object({
    pin: z.string(),
    standId: z.string(),
    plan: z.enum(["free", "basic", "plus", "premium"]).optional(),
    featured: z.boolean().optional(),
    listed: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    if (data.plan) {
      await sql.query(
        `update stands set plan = $2, featured = $3, updated_at = now() where id = $1`,
        [data.standId, data.plan, isFeaturedPlan(data.plan)],
      );
    }
    if (data.featured != null) {
      await sql.query(`update stands set featured = $2, updated_at = now() where id = $1`, [data.standId, data.featured]);
    }
    if (data.listed != null) {
      await sql.query(`update stands set listed = $2, updated_at = now() where id = $1`, [data.standId, data.listed]);
    }
    return { ok: true, plan: data.plan ? normalizePlan(data.plan) : undefined };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .validator(z.object({
    pin: z.string(),
    key: z.enum(["shopper_checkout", "guest_orders", "shopper_messages"]),
    value: z.boolean(),
  }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    await sql.query(
      `insert into app_settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`,
      [data.key, data.value ? "true" : "false"],
    );
    return { ok: true };
  });

export const adminListFlags = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string; review_id: string; stand_id: string; stand_name: string; reason: string;
      status: string; created_at: string; nickname: string; body: string;
    }>(
      `select f.id, f.review_id, f.stand_id, s.name as stand_name, f.reason, f.status,
              f.created_at::text as created_at, r.nickname, r.body
       from review_flags f
       join stands s on s.id = f.stand_id
       join reviews r on r.id = f.review_id
       order by f.created_at desc limit 80`,
    );
    return rows.map((r): FlagItem => ({
      id: r.id, reviewId: r.review_id, standId: r.stand_id, standName: r.stand_name,
      reason: r.reason, status: r.status === "kept" || r.status === "removed" ? r.status : "pending",
      createdAt: r.created_at, nickname: r.nickname, body: r.body,
    }));
  });

export const adminResolveFlag = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), id: z.string(), keep: z.boolean() }))
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const flag = await sql.query<{ review_id: string }>(`select review_id from review_flags where id = $1`, [data.id]);
    if (!flag[0]) throw new Error("Flag not found");
    await sql.query(`update review_flags set status = $2 where id = $1`, [data.id, data.keep ? "kept" : "removed"]);
    if (!data.keep) {
      await sql.query(`update reviews set hidden = true where id = $1`, [flag[0].review_id]);
    }
    return { ok: true };
  });

export const adminListCustomers = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    const rows = await sql.query<{ id: string; nickname: string; phone: string | null; last_stand_id: string | null; updated_at: string }>(
      `select id, nickname, phone, last_stand_id, updated_at::text as updated_at from customers order by updated_at desc limit 80`,
    );
    return rows.map((r): CustomerRow => ({
      id: r.id, nickname: r.nickname, phone: r.phone, lastStandId: r.last_stand_id, updatedAt: r.updated_at,
    }));
  });

export const adminListTickets = createServerFn({ method: "POST" })
  .validator(pinZ)
  .handler(async ({ data }) => {
    assertAdminPin(data.pin);
    const sql = await getSql();
    return sql.query<{ id: string; stand_id: string; customer_name: string | null; total_cents: number; status: string; source: string; created_at: string }>(
      `select id, stand_id, customer_name, total_cents, status, source, created_at::text as created_at
       from tickets order by created_at desc limit 80`,
    );
  });

export type { FarmStand };
