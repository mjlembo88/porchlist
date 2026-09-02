import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { InventoryDesk } from "@/components/inventory-desk";
import { PAID_PLANS, PLANS, canUseInventory, planMeta } from "@/lib/billing/plans";
import { formatMoney } from "@/lib/pay/links";
import {
  listMyAccess, listOwnerInbox, listTickets, markPreorderPicked, postFollowerNote, postSpecial,
  requestStandAccess, savePaySettings, socialCaption, subscribePlan,
} from "@/lib/stands/owner";
import type { FarmStand, OwnedStand, PendingAccess, Ticket } from "@/lib/stands/types";

export function OwnerDesk({
  stands, onOpen, onRefresh, requestStandId, onClearRequest,
}: {
  stands: FarmStand[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  requestStandId?: string | null;
  onClearRequest?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  if (isPending) return <div className="h-24 animate-pulse rounded-2xl bg-chip" />;
  return (
    <>
      <SignedOut>
        <div className="mx-auto max-w-sm py-8 pb-24">
          <h2 className="font-display text-2xl font-semibold">Run your stand</h2>
          <p className="mt-2 text-sm text-muted">
            Sign in to manage listings StandLocal has granted you. One account can run more than one stand. Shoppers never need an account.
          </p>
          <Link to="/login" search={{ next: "/" }} className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-forest text-paper">Owner sign in</Link>
          <button
            type="button"
            onClick={() => void navigate({ to: "/admin" })}
            className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-surface text-ink"
          >
            App admin
          </button>
        </div>
      </SignedOut>
      <SignedIn>
        {user && (
          <OwnerSignedIn
            stands={stands}
            onOpen={onOpen}
            onRefresh={onRefresh}
            requestStandId={requestStandId}
            onClearRequest={onClearRequest}
          />
        )}
      </SignedIn>
    </>
  );
}

function OwnerSignedIn({
  stands, onOpen, onRefresh, requestStandId, onClearRequest,
}: {
  stands: FarmStand[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  requestStandId?: string | null;
  onClearRequest?: () => void;
}) {
  const [owned, setOwned] = useState<OwnedStand[]>([]);
  const [pending, setPending] = useState<PendingAccess[]>([]);
  const [standId, setStandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [tab, setTab] = useState<"inbox" | "board" | "stand">("inbox");
  const [caption, setCaption] = useState("");
  const stand = stands.find((s) => s.id === standId) ?? null;
  const paid = stand ? canUseInventory(stand.plan) : false;

  async function reloadAccess() {
    const r = await listMyAccess();
    setOwned(r.owned);
    setPending(r.pending);
    setStandId((cur) => {
      if (requestStandId && r.owned.some((o) => o.id === requestStandId)) return requestStandId;
      if (cur && r.owned.some((o) => o.id === cur)) return cur;
      return r.owned[0]?.id ?? null;
    });
    return r;
  }

  useEffect(() => {
    void reloadAccess()
      .then((r) => {
        const lockedOwned = Boolean(requestStandId && r.owned.some((o) => o.id === requestStandId));
        setAsking(Boolean(requestStandId && !lockedOwned));
      })
      .catch(() => { setOwned([]); setPending([]); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestStandId]);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-chip" />;

  if (owned.length === 0 && pending.length > 0 && !asking && !requestStandId) {
    return (
      <div className="flex flex-col gap-4">
        <PendingList pending={pending} />
        <Button type="button" variant="outline" className="h-14 max-w-md" onClick={() => setAsking(true)}>
          Request another listing
        </Button>
      </div>
    );
  }

  if (asking || owned.length === 0) {
    return (
      <RequestAccess
        stands={stands}
        lockedId={requestStandId ?? null}
        alreadyOwner={owned.length > 0}
        onSubmitted={async () => {
          await reloadAccess();
          setAsking(false);
          onClearRequest?.();
          onRefresh();
        }}
        onCancel={owned.length > 0 || pending.length > 0 ? () => {
          setAsking(false);
          onClearRequest?.();
        } : undefined}
      />
    );
  }

  if (!standId || !stand) {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">My stands</h2>
          <UserButton />
        </div>
        <p className="mt-2 text-sm text-muted">Granted listings will show here.</p>
      </div>
    );
  }

  const meta = planMeta(stand.plan);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">{meta.label} · {stand.city}</p>
          <h2 className="font-display text-xl font-semibold">{stand.name}</h2>
        </div>
        <UserButton />
      </div>
      {owned.length > 1 && (
        <label className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Switch listing</span>
          <select className="h-14 rounded-2xl border border-border bg-surface px-3" value={standId} onChange={(e) => setStandId(e.target.value)}>
            {owned.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.city ? ` · ${o.city}` : ""}</option>
            ))}
          </select>
        </label>
      )}
      {pending.length > 0 && (
        <p className="text-sm text-muted">Waiting on admin for {pending.map((p) => p.standName).join(", ")}.</p>
      )}
      <Button type="button" variant="outline" className="h-14" onClick={() => setAsking(true)}>
        Request another listing
      </Button>
      <div className="flex flex-wrap gap-2">
        {([["inbox", "Inbox"], ["board", "Board"], ["stand", "Stand"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? "h-11 rounded-full bg-ink px-4 text-sm text-paper" : "h-11 rounded-full bg-chip px-4 text-sm"}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "inbox" && <OwnerInbox standId={stand.id} />}
      {tab === "board" && (
        paid
          ? <InventoryDesk standId={stand.id} onRefresh={onRefresh} />
          : <LockedPaywall stand={stand} onRefresh={onRefresh} title="Today's board" body="Publishing the chalkboard and a preorder sheet starts on Basic — $5/month. Shoppers can already tally any board that's live." />
      )}
      {tab === "stand" && (
        <StandSettings stand={stand} onOpen={onOpen} onRefresh={onRefresh} caption={caption} setCaption={setCaption} />
      )}
    </div>
  );
}

function PendingList({ pending }: { pending: PendingAccess[] }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Request sent</h2>
        <UserButton />
      </div>
      <p className="mt-2 text-sm text-muted">Waiting on StandLocal to grant access. Nobody can take over a stand themselves.</p>
      <ul className="mt-3 divide-y divide-border">
        {pending.map((p) => (
          <li key={p.id} className="py-2">
            <p className="font-medium">{p.standName}</p>
            <p className="text-xs text-muted">Sent {p.createdAt.replace("T", " ").slice(0, 16)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestAccess({
  stands, lockedId, alreadyOwner, onSubmitted, onCancel,
}: {
  stands: FarmStand[];
  lockedId?: string | null;
  alreadyOwner: boolean;
  onSubmitted: () => void;
  onCancel?: () => void;
}) {
  const unowned = stands.filter((s) => !s.ownerUserId);
  const locked = lockedId ? stands.find((s) => s.id === lockedId) ?? null : null;
  const lockedTaken = Boolean(locked?.ownerUserId);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(locked && !locked.ownerUserId ? locked.id : "");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState(lockedTaken ? "This listing already has an owner. Admin has to move it." : "");
  const [busy, setBusy] = useState(false);

  const matches = unowned.filter((s) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return false;
    return `${s.name} ${s.city ?? ""}`.toLowerCase().includes(needle);
  }).slice(0, 8);
  const picked = stands.find((s) => s.id === pick) ?? locked;

  return (
    <form className="flex max-w-md flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!pick || lockedTaken) return;
      setErr("");
      setBusy(true);
      try {
        await requestStandAccess({
          data: { standId: pick, name: ownerName.trim() || "Owner", phone: phone.trim() || undefined, note: note.trim() || undefined },
        });
        onSubmitted();
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "Could not send that request.");
      } finally { setBusy(false); }
    }}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">{alreadyOwner ? "Another listing" : "Request a listing"}</h2>
        <UserButton />
      </div>
      <p className="text-sm text-muted">Admin grants every stand. Search the listing you run — you cannot take one over from this app.</p>
      {locked && !lockedTaken && (
        <p className="rounded-2xl bg-chip px-3 py-3 text-sm">
          Requesting <span className="font-medium">{locked.name}</span>{locked.city ? ` · ${locked.city}` : ""}
        </p>
      )}
      {(!locked || lockedTaken) && (
        <>
          <Input placeholder="Search the stand you run" value={q} onChange={(e) => { setQ(e.target.value); setErr(""); }} />
          {q.trim() && matches.length === 0 && (
            <p className="text-sm text-muted">No open listings match that. If it already has an owner, admin has to move it.</p>
          )}
          {matches.length > 0 && (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {matches.map((s) => (
                <li key={s.id}>
                  <button type="button" className={pick === s.id ? "w-full bg-chip px-3 py-3 text-left" : "w-full px-3 py-3 text-left"} onClick={() => { setPick(s.id); setErr(""); }}>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.city ?? "Nature Coast"}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {picked && !picked.ownerUserId && (
        <p className="text-sm text-muted">Selected: {picked.name}{picked.city ? ` · ${picked.city}` : ""}</p>
      )}
      <Input placeholder="Your name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Textarea placeholder="How we can tell it's your stand" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="text-sm text-rust">{err}</p>}
      <Button className="h-14" type="submit" disabled={busy || !pick || lockedTaken}>Send to admin</Button>
      {onCancel && (
        <Button type="button" variant="ghost" className="h-14" onClick={onCancel}>
          {alreadyOwner ? "Back to my stands" : "Cancel"}
        </Button>
      )}
    </form>
  );
}

function OwnerInbox({ standId }: { standId: string }) {
  const [rows, setRows] = useState<{ id: string; nickname: string; body: string; createdAt: string }[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [inbox, all] = await Promise.all([
      listOwnerInbox({ data: { standId } }),
      listTickets({ data: { standId } }),
    ]);
    setRows(inbox);
    setTickets(all.filter((t) => t.source === "preorder" && t.status === "open"));
  }

  useEffect(() => {
    void reload().catch(() => setErr("Could not load inbox."));
  }, [standId]);

  if (err) return <p className="text-sm text-rust">{err}</p>;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="font-display text-lg font-semibold">Open preorders</h3>
        {tickets.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No open preorders. Shoppers send them from the stand page.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {tickets.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{t.customerName ?? "Neighbor"}</p>
                  <p className="font-display text-lg tabular-nums">{formatMoney(t.totalCents)}</p>
                </div>
                <p className="text-xs text-muted">{t.pickupWindow ?? "Pickup window not set"} · {t.createdAt.replace("T", " ").slice(0, 16)}</p>
                <ul className="mt-1 text-sm">
                  {t.lines.map((l) => (
                    <li key={l.id}>{l.qty} × {l.name}</li>
                  ))}
                </ul>
                {t.note && <p className="mt-1 text-sm text-muted">{t.note}</p>}
                <Button
                  className="mt-2 h-12"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await markPreorderPicked({ data: { standId, ticketId: t.id } });
                      await reload();
                    } finally { setBusy(false); }
                  }}
                >
                  Got it · picked up
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold">Messages</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No messages yet. Shoppers write from the stand page.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {rows.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{m.nickname}</p>
                  <p className="text-xs text-muted">{m.createdAt.replace("T", " ").slice(0, 16)}</p>
                </div>
                <p className="mt-1 text-sm leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanCards({ stand, onRefresh }: { stand: FarmStand; onRefresh: () => void }) {
  return (
    <div className="grid gap-2">
      {PAID_PLANS.map((id) => {
        const p = PLANS[id];
        const current = stand.plan === id;
        return (
          <button
            key={id}
            type="button"
            onClick={async () => { await subscribePlan({ data: { standId: stand.id, plan: id } }); onRefresh(); }}
            className={current ? "rounded-2xl border-2 border-forest bg-surface p-3 text-left" : "rounded-2xl border border-border bg-surface p-3 text-left"}
          >
            <p className="font-display text-lg font-semibold">{p.label} · ${p.monthly}/mo</p>
            <p className="text-sm text-muted">{p.blurb}</p>
            {current && <p className="mt-1 text-xs font-medium uppercase tracking-wide text-forest">Current plan</p>}
          </button>
        );
      })}
    </div>
  );
}

function LockedPaywall({
  stand, onRefresh, title, body,
}: { stand: FarmStand; onRefresh: () => void; title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <div className="mt-4">
        <PlanCards stand={stand} onRefresh={onRefresh} />
      </div>
    </section>
  );
}

function StandSettings({
  stand, onOpen, onRefresh, caption, setCaption,
}: {
  stand: FarmStand; onOpen: (id: string) => void; onRefresh: () => void;
  caption: string; setCaption: (s: string) => void;
}) {
  const [venmo, setVenmo] = useState(stand.venmoUsername ?? "");
  const [zelleH, setZelleH] = useState(stand.zelleHandle ?? "");
  const [zelleD, setZelleD] = useState(stand.zelleDestination ?? "");
  const [cash, setCash] = useState(stand.cashappCashtag ?? "");
  const [paypal, setPaypal] = useState(stand.paypalMeSlug ?? "");
  const [windows, setWindows] = useState(stand.pickupWindows ?? "Sat 8–noon · Sun 9–1");
  const [hours, setHours] = useState(stand.hours ?? "");
  const [copied, setCopied] = useState(false);
  const [spTitle, setSpTitle] = useState("");
  const [spBody, setSpBody] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setVenmo(stand.venmoUsername ?? "");
    setZelleH(stand.zelleHandle ?? "");
    setZelleD(stand.zelleDestination ?? "");
    setCash(stand.cashappCashtag ?? "");
    setPaypal(stand.paypalMeSlug ?? "");
    setWindows(stand.pickupWindows ?? "Sat 8–noon · Sun 9–1");
    setHours(stand.hours ?? "");
    setCopied(false);
    setSpTitle("");
    setSpBody("");
    setNote("");
    setSaved("");
  }, [stand.id, stand.venmoUsername, stand.zelleHandle, stand.zelleDestination, stand.cashappCashtag, stand.paypalMeSlug, stand.pickupWindows, stand.hours]);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpen(stand.id)}>View on map</Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link to="/stand/$id" params={{ id: stand.id }}>Stand page</Link>
        </Button>
      </div>

      <section className="grid gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Today's special</p>
        <Input placeholder="Title" value={spTitle} onChange={(e) => setSpTitle(e.target.value)} />
        <Textarea placeholder="What's on the porch" value={spBody} onChange={(e) => setSpBody(e.target.value)} />
        <Button className="h-14" variant="outline" disabled={spTitle.trim().length < 2 || spBody.trim().length < 2} onClick={async () => {
          await postSpecial({ data: { standId: stand.id, title: spTitle.trim(), body: spBody.trim() } });
          setSpTitle(""); setSpBody(""); setSaved("Special posted."); onRefresh();
        }}>Post to shoppers</Button>
        <Textarea placeholder="Note to followers" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button className="h-14" variant="outline" disabled={note.trim().length < 2} onClick={async () => {
          await postFollowerNote({ data: { standId: stand.id, body: note.trim() } });
          setNote(""); setSaved("Followers will see this.");
        }}>Send to following</Button>
        {saved && <p className="text-sm text-forest">{saved}</p>}
      </section>

      <section className="grid gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Payment handles</p>
        <Input placeholder="Venmo username" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
        <Input placeholder="Zelle name" value={zelleH} onChange={(e) => setZelleH(e.target.value)} />
        <Input placeholder="Zelle phone or email" value={zelleD} onChange={(e) => setZelleD(e.target.value)} />
        <Input placeholder="Cash App $cashtag" value={cash} onChange={(e) => setCash(e.target.value)} />
        <Input placeholder="paypal.me slug" value={paypal} onChange={(e) => setPaypal(e.target.value)} />
        <Input placeholder="Pickup windows" value={windows} onChange={(e) => setWindows(e.target.value)} />
        <Input placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
        <Button className="h-14" onClick={async () => {
          await savePaySettings({
            data: {
              standId: stand.id, venmoUsername: venmo, zelleHandle: zelleH, zelleDestination: zelleD,
              cashappCashtag: cash, paypalMeSlug: paypal, pickupWindows: windows, hours,
            },
          });
          setSaved("Stand saved.");
          onRefresh();
        }}>Save stand</Button>
      </section>

      <section className="grid gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Plan · Stripe at launch</p>
        <p className="text-sm text-muted">Shopper checkout is always on. Paid plans unlock posting the board and a preorder sheet.</p>
        <PlanCards stand={stand} onRefresh={onRefresh} />
      </section>

      <Button className="h-14" variant="outline" onClick={async () => {
        const r = await socialCaption({ data: { standId: stand.id } });
        setCaption(r.caption);
      }}>Caption from today's board</Button>
      {caption && (
        <div>
          <pre className="whitespace-pre-wrap rounded-2xl bg-chip p-3 text-sm">{caption}</pre>
          <Button className="mt-2 h-14 w-full" onClick={async () => {
            await navigator.clipboard.writeText(caption);
            setCopied(true);
          }}>{copied ? "Copied" : "Copy caption"}</Button>
        </div>
      )}
    </div>
  );
}
