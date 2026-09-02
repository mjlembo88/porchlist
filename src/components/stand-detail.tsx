import { useEffect, useState } from "react";
import { Flag, Heart, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { canRunAds, isFeaturedPlan } from "@/lib/billing/plans";
import { formatMoney, paymentLinks } from "@/lib/pay/links";
import { useLocal } from "@/lib/stands/local";
import { placePreorder } from "@/lib/stands/owner";
import { addReview, flagReview, getAppFeatures, getStandBundle, messageOwner } from "@/lib/stands/server";
import { ACCESS_LABEL, KIND_LABEL, type AppFeatures, type FarmStand, type InventoryItem, type Review, type Special } from "@/lib/stands/types";

export function StandDetail({
  stand, onAskOwner, initialItems, initialSpecials, initialReviews,
}: {
  stand: FarmStand;
  onAskOwner?: () => void;
  initialItems?: InventoryItem[];
  initialSpecials?: Special[];
  initialReviews?: Review[];
}) {
  const follows = useLocal((s) => s.follows);
  const toggleFollow = useLocal((s) => s.toggleFollow);
  const nickname = useLocal((s) => s.nickname);
  const setNickname = useLocal((s) => s.setNickname);
  const saved = follows.includes(stand.id);
  const [reviews, setReviews] = useState<Review[]>(initialReviews ?? []);
  const [specials, setSpecials] = useState<Special[]>(initialSpecials ?? []);
  const [items, setItems] = useState<InventoryItem[]>(initialItems ?? []);
  const [features, setFeatures] = useState<AppFeatures>({ shopperCheckout: true, guestOrders: true, shopperMessages: true });
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("Looks false or not about this stand");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [shopTab, setShopTab] = useState<"board" | "preorder">("board");
  const [windowPick, setWindowPick] = useState(stand.pickupWindows?.split("·")[0]?.trim() ?? "Next pickup");
  const [preMsg, setPreMsg] = useState("");
  const [note, setNote] = useState("");
  const [noteMsg, setNoteMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");

  async function reload() {
    const data = await getStandBundle({ data: { id: stand.id } });
    setReviews(data.reviews);
    setSpecials(data.specials);
    setItems(data.items);
  }

  useEffect(() => {
    void reload();
    void getAppFeatures().then(setFeatures).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand.id]);

  const mapsUrl =
    stand.lat != null && stand.lng != null
      ? `https://maps.google.com/?q=${stand.lat},${stand.lng}`
      : stand.address
        ? `https://maps.google.com/?q=${encodeURIComponent(`${stand.address} ${stand.city ?? ""} FL`)}`
        : null;

  const boardItems = items.filter((i) => !i.preorderable);
  const sheetItems = items.filter((i) => i.preorderable);
  const pickupChoices = (stand.pickupWindows ?? "").split("·").map((w) => w.trim()).filter(Boolean);
  const showPreorder = sheetItems.length > 0;
  const tab: "board" | "preorder" = showPreorder && (shopTab === "preorder" || boardItems.length === 0)
    ? "preorder"
    : "board";
  const listedItems = tab === "preorder" ? sheetItems : boardItems;
  const tallyItems = listedItems.filter((i) => i.status !== "out");
  const cartLines = tallyItems.filter((i) => (cart[i.id] ?? 0) > 0);
  const cartTotal = cartLines.reduce((s, it) => s + (cart[it.id] ?? 0) * it.priceCents, 0);

  useEffect(() => {
    setCart({});
    setPreMsg("");
    setPhone("");
    setOrderNote("");
    setShopTab("board");
    setWindowPick(stand.pickupWindows?.split("·")[0]?.trim() ?? "Next pickup");
  }, [stand.id, stand.pickupWindows]);

  return (
    <article className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {KIND_LABEL[stand.kind]} · {ACCESS_LABEL[stand.access] ?? stand.access}
          {stand.city ? ` · ${stand.city}` : ""}
          {isFeaturedPlan(stand.plan) || stand.featured ? " · Featured" : ""}
          {canRunAds(stand.plan) ? " · Premium" : ""}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{stand.name}</h2>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={saved ? "default" : "outline"} onClick={() => toggleFollow(stand.id)}>
          <Heart className={saved ? "size-3.5 fill-paper" : "size-3.5"} />
          {saved ? "Following" : "Follow"}
        </Button>
        {mapsUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin className="size-3.5" /> Directions</a>
          </Button>
        )}
        {onAskOwner && !stand.ownerUserId && (
          <Button size="sm" variant="ghost" onClick={onAskOwner}>Request owner access</Button>
        )}
      </div>
      <dl className="grid gap-1.5 text-sm">
        <dd>
          {stand.address ? `${stand.address}, ${stand.city ?? ""}` : `${stand.city ?? "Area"} — address on request`}
          {stand.pinQuality !== "exact" && <span className="text-muted"> · pin is approximate</span>}
        </dd>
        <dd>{stand.hours ?? "Hours not listed yet."}</dd>
        {stand.pickupWindows && <dd>Pickup {stand.pickupWindows}</dd>}
        {stand.phone && <dd>{stand.phone}</dd>}
      </dl>
      <div className="flex flex-wrap gap-1.5">
        {stand.products.map((p) => <Badge key={p}>{p}</Badge>)}
      </div>
      {specials[0] && (
        <div className="rounded-2xl border border-border bg-chip/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Today from the stand</p>
          <p className="mt-1 font-medium">{specials[0].title}</p>
          <p className="text-sm">{specials[0].body}</p>
        </div>
      )}

      {boardItems.length > 0 || showPreorder ? (
        <section className="rounded-2xl border border-forest/30 bg-surface p-3">
          {showPreorder && boardItems.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {([["board", "Board"], ["preorder", "Preorder"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setShopTab(id); setPreMsg(""); }}
                  className={tab === id ? "h-11 rounded-full bg-ink px-4 text-sm text-paper" : "h-11 rounded-full bg-chip px-4 text-sm"}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {tab === "board" ? (
            <>
              <h3 className="font-display text-lg font-semibold">On the board</h3>
              <p className="text-sm text-muted">Add what you're taking. When the total is ready, pay the stand with their app.</p>
              {boardItems.length > 0 && (
                <QtyList items={boardItems} cart={cart} setCart={setCart} checkout={features.shopperCheckout} />
              )}
              {features.shopperCheckout && cartTotal > 0 && (
                <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{formatMoney(cartTotal)}</p>
              )}
              {cartTotal > 0 && <ShopperPay stand={stand} cents={cartTotal} />}
            </>
          ) : (
            <>
              <h3 className="font-display text-lg font-semibold">Preorder</h3>
              <p className="text-sm text-muted">Reserve from this week's sheet. Pay with the stand's app, then send the ticket.</p>
              <QtyList items={sheetItems} cart={cart} setCart={setCart} checkout={features.shopperCheckout} />
              {features.shopperCheckout && cartTotal > 0 && (
                <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{formatMoney(cartTotal)}</p>
              )}
              {cartTotal > 0 && <ShopperPay stand={stand} cents={cartTotal} />}
              {features.guestOrders && (
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (cartLines.length === 0 || nickname.trim().length < 1) return;
                    setBusy(true);
                    try {
                      await placePreorder({
                        data: {
                          standId: stand.id,
                          customerName: nickname.trim(),
                          pickupWindow: windowPick,
                          phone: phone.trim() || undefined,
                          note: orderNote.trim() || undefined,
                          lines: cartLines.map((it) => ({
                            itemId: it.id, name: it.name, unit: it.unit, qty: cart[it.id], priceCents: it.priceCents,
                          })),
                        },
                      });
                      setCart({});
                      setOrderNote("");
                      setPreMsg("Preorder sent. Pickup at the window you picked.");
                    } catch {
                      setPreMsg("Could not send. Try again.");
                    } finally { setBusy(false); }
                  }}
                >
                  <Input placeholder="Your name" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
                  <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
                  {pickupChoices.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pickupChoices.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={windowPick === w ? "h-11 rounded-full bg-ink px-4 text-sm text-paper" : "h-11 rounded-full bg-chip px-4 text-sm"}
                          onClick={() => setWindowPick(w)}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input placeholder="Pickup window" value={windowPick} onChange={(e) => setWindowPick(e.target.value)} />
                  <Textarea placeholder="Note for the stand (optional)" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} maxLength={200} />
                  <Button type="submit" className="h-14" disabled={cartLines.length === 0 || busy || nickname.trim().length < 1}>
                    Send preorder
                  </Button>
                </form>
              )}
              {preMsg && <p className="mt-2 text-sm text-forest">{preMsg}</p>}
            </>
          )}
        </section>
      ) : null}

      {features.shopperMessages && (
        <section className="rounded-2xl border border-border bg-surface p-3">
          <h3 className="font-display text-lg font-semibold">Message the owner</h3>
          <p className="text-sm text-muted">Hours, a special order, or “are you open?” — no account needed.</p>
          <form
            className="mt-2 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!note.trim()) return;
              setBusy(true);
              try {
                const name = nickname.trim() || "Neighbor";
                if (!nickname.trim()) setNickname(name);
                await messageOwner({ data: { standId: stand.id, nickname: name, body: note.trim() } });
                setNote("");
                setNoteMsg("Sent. The stand will see it in their inbox.");
              } catch {
                setNoteMsg("Could not send. Try again.");
              } finally { setBusy(false); }
            }}
          >
            <Input placeholder="Your name" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
            <Textarea placeholder="Message the stand" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
            <Button type="submit" className="h-14" disabled={busy || note.trim().length < 2}>Send message</Button>
          </form>
          {noteMsg && <p className="mt-2 text-sm text-forest">{noteMsg}</p>}
        </section>
      )}

      <section>
        <h3 className="font-display text-lg font-semibold">Neighbor notes</h3>
        <form
          className="mb-4 mt-2 grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setBusy(true);
            try {
              const name = nickname.trim() || "Neighbor";
              if (!nickname.trim()) setNickname(name);
              await addReview({ data: { standId: stand.id, nickname: name, rating, body: body.trim() } });
              setBody("");
              await reload();
            } finally { setBusy(false); }
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Your name" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
            <label className="flex items-center gap-2 text-sm text-muted">
              <Star className="size-3.5" />
              <select className="h-11 flex-1 rounded-xl border border-border bg-surface px-2" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          </div>
          <Textarea placeholder="Was the stand open? What was good?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={800} />
          <Button type="submit" size="sm" disabled={busy || body.trim().length < 2}>Post note</Button>
        </form>
        <ul className="divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{r.nickname}</p>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-rust" onClick={() => setFlagFor(flagFor === r.id ? null : r.id)}>
                  <Flag className="size-3" /> Flag
                </button>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{r.body}</p>
              {r.reply && <p className="mt-2 rounded-xl bg-chip px-3 py-2 text-sm"><span className="font-medium">Stand reply — </span>{r.reply.body}</p>}
              {flagFor === r.id && (
                <form className="mt-2 flex gap-2" onSubmit={async (e) => {
                  e.preventDefault();
                  await flagReview({ data: { reviewId: r.id, standId: stand.id, reason: flagReason } });
                  setFlagFor(null);
                  await reload();
                }}>
                  <Input value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
                  <Button type="submit" size="sm" variant="rust">Send</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function QtyList({
  items, cart, setCart, checkout,
}: {
  items: InventoryItem[];
  cart: Record<string, number>;
  setCart: (next: Record<string, number> | ((c: Record<string, number>) => Record<string, number>)) => void;
  checkout: boolean;
}) {
  return (
    <ul className="mt-2 divide-y divide-border">
      {items.map((it) => {
        const out = it.status === "out";
        return (
          <li key={it.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm">
                {it.photo && <img src={it.photo} alt="" className="size-10 rounded-lg object-cover" />}
                <span className="font-medium">{it.name}</span>
              </span>
              <span className="text-xs text-muted">
                {out ? "Out" : `${formatMoney(it.priceCents)} / ${it.unit}`}
                {it.status === "low" ? " · low" : ""}
              </span>
            </span>
            {checkout && !out && (
              <div className="flex items-center gap-2">
                <button type="button" className="size-11 rounded-full bg-chip" onClick={() => setCart((c) => ({ ...c, [it.id]: Math.max(0, (c[it.id] ?? 0) - 1) }))}>−</button>
                <span className="w-5 text-center tabular-nums">{cart[it.id] ?? 0}</span>
                <button type="button" className="size-11 rounded-full bg-chip" onClick={() => setCart((c) => ({ ...c, [it.id]: (c[it.id] ?? 0) + 1 }))}>+</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ShopperPay({ stand, cents }: { stand: FarmStand; cents: number }) {
  if (cents <= 0) return null;
  const links = paymentLinks({
    venmoUsername: stand.venmoUsername,
    zelleHandle: stand.zelleHandle,
    zelleDestination: stand.zelleDestination,
    cashappCashtag: stand.cashappCashtag,
    paypalMeSlug: stand.paypalMeSlug,
  }, cents, stand.name);
  const venmoUser = stand.venmoUsername?.replace(/^@/, "") ?? "";
  const cashTag = stand.cashappCashtag?.replace(/^\$/, "") ?? "";
  const hasPay = Boolean(venmoUser || stand.zelleHandle || stand.zelleDestination || cashTag || stand.paypalMeSlug);

  return (
    <div className="mt-4 grid gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Pay this total · {formatMoney(cents)}</p>
      {venmoUser && links.venmo && (
        <a className="flex h-14 items-center justify-between rounded-2xl border border-border bg-chip px-4 text-sm" href={links.venmo.web} target="_blank" rel="noreferrer">
          <span>Venmo @{venmoUser}</span>
          <span className="text-forest">Send {formatMoney(cents)}</span>
        </a>
      )}
      {cashTag && links.cashapp && (
        <a className="flex h-14 items-center justify-between rounded-2xl border border-border bg-chip px-4 text-sm" href={links.cashapp} target="_blank" rel="noreferrer">
          <span>Cash App ${cashTag}</span>
          <span className="text-forest">Send {formatMoney(cents)}</span>
        </a>
      )}
      {stand.paypalMeSlug && links.paypal && (
        <a className="flex h-14 items-center justify-between rounded-2xl border border-border bg-chip px-4 text-sm" href={links.paypal} target="_blank" rel="noreferrer">
          <span>PayPal</span>
          <span className="text-forest">Send {formatMoney(cents)}</span>
        </a>
      )}
      {(stand.zelleHandle || stand.zelleDestination) && (
        <div className="rounded-2xl border border-border bg-chip p-3">
          <p className="text-sm font-medium">Zelle</p>
          {stand.zelleHandle && <CopyPay label="Name" value={stand.zelleHandle} />}
          {stand.zelleDestination && <CopyPay label="Send to" value={stand.zelleDestination} />}
          <CopyPay label="Amount" value={links.amount} />
        </div>
      )}
      {!hasPay && <p className="text-sm text-muted">No app handles posted yet. Cash at the stand is always fine.</p>}
      {hasPay && <p className="text-sm text-muted">Cash at the stand is always fine.</p>}
    </div>
  );
}

function CopyPay({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
      <Button size="sm" variant="outline" onClick={async () => {
        await navigator.clipboard.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}>
        {ok ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
