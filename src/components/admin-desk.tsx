import { useEffect, useState } from "react";
import { ClipboardList, Flag, MapPin, Sliders, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import {
  adminCopyOwner, adminListCustomers, adminListFlags, adminListRequests, adminListStands,
  adminResolveFlag, adminReviewRequest, adminRevokeOwner, adminSetSetting, adminUnlock, adminUpdateStand,
} from "@/lib/stands/admin";
import { ADMIN_PIN } from "@/lib/stands/admin-gate";
import { getAppFeatures } from "@/lib/stands/server";
import type { AppFeatures, CustomerRow, FarmStand, FlagItem, OwnerRequest } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

type Tab = "requests" | "stands" | "plans" | "customers" | "flags" | "features";

const TABS: { id: Tab; label: string; Icon: typeof Store }[] = [
  { id: "requests", label: "Requests", Icon: ClipboardList },
  { id: "stands", label: "Stands", Icon: MapPin },
  { id: "plans", label: "Plans", Icon: Store },
  { id: "customers", label: "Customers", Icon: Users },
  { id: "flags", label: "Flags", Icon: Flag },
  { id: "features", label: "Features", Icon: Sliders },
];

export function AdminDesk() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("requests");
  const [stands, setStands] = useState<FarmStand[]>([]);
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [features, setFeatures] = useState<AppFeatures>({ shopperCheckout: true, guestOrders: true, shopperMessages: true });

  async function reload() {
    const [s, r, f, c, feat] = await Promise.all([
      adminListStands({ data: { pin: ADMIN_PIN } }),
      adminListRequests({ data: { pin: ADMIN_PIN } }),
      adminListFlags({ data: { pin: ADMIN_PIN } }),
      adminListCustomers({ data: { pin: ADMIN_PIN } }),
      getAppFeatures(),
    ]);
    setStands(s);
    setRequests(r);
    setFlags(f);
    setCustomers(c);
    setFeatures(feat);
  }

  useEffect(() => {
    if (unlocked) void reload();
  }, [unlocked]);

  if (!unlocked) {
    return (
      <form
        className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await adminUnlock({ data: { pin } });
            setUnlocked(true);
          } catch {
            setErr("Wrong PIN.");
          }
        }}
      >
        <h1 className="font-display text-3xl font-semibold">StandLocal admin</h1>
        <p className="text-sm text-muted">PIN for the app desk. Not owner sign-in.</p>
        <Input type="password" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        {err && <p className="text-sm text-rust">{err}</p>}
        <Button className="h-14" type="submit">Unlock</Button>
      </form>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <h1 className="font-display text-2xl font-semibold">App admin</h1>
      <p className="text-sm text-muted">{stands.length} listings · {pending.length} open requests</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm",
              tab === t.id ? "bg-ink text-paper" : "bg-chip",
            )}
          >
            <t.Icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <ul className="mt-4 divide-y divide-border">
          {requests.length === 0 && <li className="py-4 text-sm text-muted">No owner requests yet.</li>}
          {requests.map((r) => (
            <li key={r.id} className="py-3">
              <p className="font-medium">{r.name} · {r.standName}</p>
              <p className="text-xs text-muted">{r.status} · {r.createdAt.replace("T", " ").slice(0, 16)}</p>
              {r.note && <p className="mt-1 text-sm">{r.note}</p>}
              {r.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={async () => { await adminReviewRequest({ data: { pin: ADMIN_PIN, id: r.id, approve: true } }); await reload(); }}>Grant</Button>
                  <Button size="sm" variant="outline" onClick={async () => { await adminReviewRequest({ data: { pin: ADMIN_PIN, id: r.id, approve: false } }); await reload(); }}>Deny</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "stands" && <StandsPanel stands={stands} onReload={reload} />}
      {tab === "plans" && <PlansPanel stands={stands} onReload={reload} />}
      {tab === "customers" && (
        <ul className="mt-4 divide-y divide-border">
          {customers.length === 0 && <li className="py-4 text-sm text-muted">No shopper names stored yet.</li>}
          {customers.map((c) => (
            <li key={c.id} className="py-3">
              <p className="font-medium">{c.nickname}</p>
              <p className="text-xs text-muted">{c.phone ?? "No phone"} · {c.updatedAt.replace("T", " ").slice(0, 16)}</p>
            </li>
          ))}
        </ul>
      )}
      {tab === "flags" && (
        <ul className="mt-4 divide-y divide-border">
          {flags.length === 0 && <li className="py-4 text-sm text-muted">No flags.</li>}
          {flags.map((f) => (
            <li key={f.id} className="py-3">
              <p className="font-medium">{f.standName} · {f.nickname}</p>
              <p className="text-sm">{f.body}</p>
              <p className="text-xs text-muted">{f.reason} · {f.status}</p>
              {f.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { await adminResolveFlag({ data: { pin: ADMIN_PIN, id: f.id, keep: true } }); await reload(); }}>Keep</Button>
                  <Button size="sm" variant="rust" onClick={async () => { await adminResolveFlag({ data: { pin: ADMIN_PIN, id: f.id, keep: false } }); await reload(); }}>Remove</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {tab === "features" && (
        <ul className="mt-4 grid gap-3">
          {([
            { key: "shopper_checkout" as const, on: features.shopperCheckout, label: "Shopper tally", blurb: "Qty × price on every stand with a board." },
            { key: "guest_orders" as const, on: features.guestOrders, label: "Preorder form", blurb: "Shoppers send a ticket without signing in." },
            { key: "shopper_messages" as const, on: features.shopperMessages, label: "Message the owner", blurb: "Open notes from the stand page." },
          ]).map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="text-sm text-muted">{row.blurb}</p>
              </div>
              <Button
                size="sm"
                variant={row.on ? "default" : "outline"}
                onClick={async () => {
                  await adminSetSetting({ data: { pin: ADMIN_PIN, key: row.key, value: !row.on } });
                  await reload();
                }}
              >
                {row.on ? "On" : "Off"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StandsPanel({ stands, onReload }: { stands: FarmStand[]; onReload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [fromId, setFromId] = useState("");
  const matches = stands.filter((s) => `${s.name} ${s.city ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 20);
  const owned = stands.filter((s) => s.ownerUserId);
  return (
    <div className="mt-4 grid gap-3">
      <Input placeholder="Search listings" value={q} onChange={(e) => setQ(e.target.value)} />
      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted">Copy owner from</span>
        <select className="h-11 rounded-xl border border-border bg-surface px-2" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Pick a listing with an owner</option>
          {owned.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <ul className="divide-y divide-border">
        {matches.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}</p>
              <p className="text-xs text-muted">{s.city} · {s.plan}{s.ownerUserId ? " · owned" : ""}</p>
            </div>
            <div className="flex gap-1">
              {fromId && fromId !== s.id && (
                <Button size="sm" variant="outline" onClick={async () => { await adminCopyOwner({ data: { pin: ADMIN_PIN, fromStandId: fromId, toStandId: s.id } }); await onReload(); }}>Same owner</Button>
              )}
              {s.ownerUserId && (
                <Button size="sm" variant="ghost" onClick={async () => { await adminRevokeOwner({ data: { pin: ADMIN_PIN, standId: s.id } }); await onReload(); }}>Revoke</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlansPanel({ stands, onReload }: { stands: FarmStand[]; onReload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const matches = stands.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 20);
  return (
    <div className="mt-4 grid gap-3">
      <Input placeholder="Search listings" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border">
        {matches.map((s) => (
          <li key={s.id} className="py-3">
            <p className="font-medium">{s.name}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(Object.keys(PLANS) as PlanId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={s.plan === id ? "h-11 rounded-full bg-ink px-3 text-xs text-paper" : "h-11 rounded-full bg-chip px-3 text-xs"}
                  onClick={async () => { await adminUpdateStand({ data: { pin: ADMIN_PIN, standId: s.id, plan: id } }); await onReload(); }}
                >
                  {PLANS[id].label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
