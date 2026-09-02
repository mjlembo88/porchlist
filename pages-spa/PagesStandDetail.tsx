import { useEffect, useMemo, useState } from "react";
import { Heart, MapPin } from "lucide-react";
import { Stars, StarPicker } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/pay/links";
import { useLocal } from "@/lib/stands/local";
import { useDemoStore } from "@/lib/stands/demo-store";
import { ACCESS_LABEL, KIND_LABEL, type FarmStand, type InventoryItem, type Review, type Special } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

export function PagesStandDetail({
  stand,
  onAskOwner,
  compact = false,
}: {
  stand: FarmStand;
  onAskOwner?: () => void;
  compact?: boolean;
}) {
  const follows = useLocal((s) => s.follows);
  const toggleFollow = useLocal((s) => s.toggleFollow);
  const nickname = useLocal((s) => s.nickname);
  const setNickname = useLocal((s) => s.setNickname);
  const getBundle = useDemoStore((s) => s.getBundle);
  const addReview = useDemoStore((s) => s.addReview);
  const placeOrder = useDemoStore((s) => s.placeOrder);
  const saved = follows.includes(stand.id);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [kind, setKind] = useState<"walkup" | "preorder">("walkup");
  const [windowPick, setWindowPick] = useState(stand.pickupWindows?.split("·")[0]?.trim() ?? "Today · walk-up");
  const [phone, setPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [preMsg, setPreMsg] = useState("");

  function reload() {
    const data = getBundle(stand.id);
    setReviews(data.reviews);
    setSpecials(data.specials);
    setItems(data.items);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand.id]);

  useEffect(() => {
    setCart({});
    setPreMsg("");
    setPhone("");
    setOrderNote("");
    setCartOpen(false);
    setKind("walkup");
    setWindowPick(stand.pickupWindows?.split("·")[0]?.trim() ?? "Today · walk-up");
  }, [stand.id, stand.pickupWindows]);

  const mapsUrl =
    stand.lat != null && stand.lng != null
      ? `https://maps.google.com/?q=${stand.lat},${stand.lng}`
      : stand.address
        ? `https://maps.google.com/?q=${encodeURIComponent(`${stand.address} ${stand.city ?? ""} FL`)}`
        : null;

  const shopItems = items.filter((i) => i.status !== "out");
  const cartLines = shopItems.filter((i) => (cart[i.id] ?? 0) > 0);
  const cartTotal = cartLines.reduce((s, it) => s + (cart[it.id] ?? 0) * it.priceCents, 0);
  const cartCount = cartLines.reduce((s, it) => s + (cart[it.id] ?? 0), 0);
  const pickupChoices = useMemo(
    () => (stand.pickupWindows ?? "").split("·").map((w) => w.trim()).filter(Boolean),
    [stand.pickupWindows],
  );
  const avg = stand.reviewCount
    ? stand.ratingAvg || reviews.reduce((s, r) => s + r.rating, 0) / Math.max(reviews.length, 1)
    : reviews.length
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
  const visibleReviews = compact ? reviews.slice(0, 2) : reviews.slice(0, 4);

  function bump(id: string, delta: number, max: number | null) {
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const capped = max != null ? Math.min(max, next) : next;
      return { ...c, [id]: capped };
    });
  }

  return (
    <article className="flex flex-col gap-3">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {KIND_LABEL[stand.kind]} · {ACCESS_LABEL[stand.access] ?? stand.access}
          {stand.city ? ` · ${stand.city}` : ""}
        </p>
        {!compact && (
          <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight">{stand.name}</h2>
        )}
        <div className={compact ? "mt-0.5 flex items-center gap-2" : "mt-1 flex items-center gap-2"}>
          <Stars value={avg} count={reviews.length || stand.reviewCount} size="md" />
        </div>
      </header>

      <p className="text-sm leading-snug text-muted">
        {stand.hours ?? "Hours not listed yet."}
        {stand.pickupWindows ? ` · Pickup ${stand.pickupWindows}` : ""}
      </p>

      <div className="flex gap-2">
        <Button className="h-12 flex-1" onClick={() => {
          document.getElementById(`shop-${stand.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}>
          Shop this stand
        </Button>
        <Button size="icon" variant={saved ? "default" : "outline"} onClick={() => toggleFollow(stand.id)} aria-label={saved ? "Following" : "Follow"}>
          <Heart className={saved ? "size-4 fill-paper" : "size-4"} />
        </Button>
        {mapsUrl && (
          <Button size="icon" variant="outline" asChild>
            <a href={mapsUrl} target="_blank" rel="noreferrer" aria-label="Directions">
              <MapPin className="size-4" />
            </a>
          </Button>
        )}
      </div>

      {specials[0] && (
        <p className="rounded-xl bg-chip px-3 py-2 text-sm">
          <span className="font-medium">{specials[0].title}. </span>
          {specials[0].body}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {stand.products.slice(0, 6).map((p) => <Badge key={p}>{p}</Badge>)}
      </div>

      <section id={`shop-${stand.id}`} className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">On the stand</h3>
          <p className="text-xs text-muted">Pay at pickup</p>
        </div>
        {shopItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing posted yet. Check back or follow for the next board.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {shopItems.map((it) => {
              const qty = cart[it.id] ?? 0;
              const max = it.maxQty;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.name}</span>
                    <span className="text-xs text-muted">
                      {formatMoney(it.priceCents)} / {it.unit}
                      {max != null ? ` · ${max} left` : ""}
                      {it.preorderable ? " · preorder" : ""}
                      {it.status === "low" ? " · low" : ""}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="grid size-11 place-items-center rounded-full bg-chip text-lg" onClick={() => bump(it.id, -1, max)} aria-label={`Remove ${it.name}`}>−</button>
                    <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
                    <button type="button" className="grid size-11 place-items-center rounded-full bg-chip text-lg" onClick={() => bump(it.id, 1, max)} aria-label={`Add ${it.name}`}>+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {preMsg && <p className="text-sm text-forest">{preMsg}</p>}
      {cartCount > 0 && (
        <div className={cn("sticky bottom-2 z-10", compact && "bottom-0")}>
          <Button className="h-12 w-full rounded-2xl" onClick={() => setCartOpen(true)}>
            Cart · {cartCount} · {formatMoney(cartTotal)}
          </Button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">Notes</h3>
          <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>Write a note</Button>
        </div>
        {visibleReviews.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Be the first neighbor to leave a short note.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {visibleReviews.map((r) => (
              <li key={r.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.nickname}</p>
                  <Stars value={r.rating} showValue={false} />
                </div>
                <p className="mt-0.5 text-sm leading-snug text-muted">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {onAskOwner && (
        <button type="button" className="text-left text-xs text-muted underline" onClick={onAskOwner}>
          Open the demo owner desk
        </button>
      )}

      <BottomSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        nested={compact}
        title="Checkout"
        description="Pay at pickup. The stand will accept, then fulfill."
        footer={
          <Button
            className="h-12 w-full"
            disabled={busy || cartLines.length === 0 || nickname.trim().length < 1}
            onClick={() => {
              if (cartLines.length === 0 || nickname.trim().length < 1) return;
              setBusy(true);
              try {
                placeOrder({
                  standId: stand.id,
                  customerName: nickname.trim(),
                  pickupWindow: windowPick,
                  phone: phone.trim() || undefined,
                  note: orderNote.trim() || null,
                  source: kind,
                  lines: cartLines.map((it) => ({
                    itemId: it.id, name: it.name, unit: it.unit, qty: cart[it.id], priceCents: it.priceCents,
                  })),
                });
                setCart({});
                setOrderNote("");
                setPreMsg("Order sent. Pay when you pick up.");
                setCartOpen(false);
                reload();
              } catch {
                setPreMsg("Could not send. Try again.");
              } finally { setBusy(false); }
            }}
          >
            Place order · {formatMoney(cartTotal)}
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {cartLines.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-2 text-sm">
              <span>{cart[it.id]} × {it.name}</span>
              <span className="tabular-nums">{formatMoney((cart[it.id] ?? 0) * it.priceCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{formatMoney(cartTotal)}</p>
        <div className="mt-3 flex gap-2">
          {([["walkup", "Pickup"], ["preorder", "Preorder"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={kind === id ? "h-11 flex-1 rounded-full bg-ink text-sm text-paper" : "h-11 flex-1 rounded-full bg-chip text-sm"}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          <Input placeholder="Your name" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
          <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          {pickupChoices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pickupChoices.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={windowPick === w ? "h-11 rounded-full bg-ink px-3 text-sm text-paper" : "h-11 rounded-full bg-chip px-3 text-sm"}
                  onClick={() => setWindowPick(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
          <Input placeholder="Pickup window" value={windowPick} onChange={(e) => setWindowPick(e.target.value)} />
          <Textarea placeholder="Note for the stand" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} maxLength={200} className="min-h-20" />
        </div>
      </BottomSheet>

      <BottomSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        nested={compact}
        title="Leave a note"
        description="A star rating and a short line. Live as soon as you post."
        footer={
          <Button
            className="h-12 w-full"
            disabled={busy || body.trim().length < 2}
            onClick={() => {
              if (!body.trim()) return;
              setBusy(true);
              try {
                const name = nickname.trim() || "Neighbor";
                if (!nickname.trim()) setNickname(name);
                addReview({ standId: stand.id, nickname: name, rating, body: body.trim() });
                setBody("");
                setReviewOpen(false);
                reload();
              } finally { setBusy(false); }
            }}
          >
            Post note
          </Button>
        }
      >
        <Input placeholder="Your name" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
        <div className="mt-2">
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <Textarea
          className="mt-2"
          placeholder="Was the stand open? What was good?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={240}
        />
      </BottomSheet>
    </article>
  );
}
