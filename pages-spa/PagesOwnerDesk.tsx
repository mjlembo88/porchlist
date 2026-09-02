import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { OrderQueue, QueueBadge } from "@/components/order-queue";
import { formatMoney } from "@/lib/pay/links";
import { useDemoStore } from "@/lib/stands/demo-store";
import { DEMO_STAND_ID, type FarmStand, type InventoryItem, type TicketStatus } from "@/lib/stands/types";

export function PagesOwnerDesk({
  stands,
  onOpen,
  onRefresh,
}: {
  stands: FarmStand[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  const [demo, setDemo] = useState(true);
  const stand = stands.find((s) => s.id === DEMO_STAND_ID) ?? stands[0];

  if (!demo) {
    return (
      <div className="mx-auto max-w-sm py-4">
        <h2 className="font-display text-2xl font-semibold">Run your stand</h2>
        <p className="mt-2 text-sm text-muted">
          This GitHub Pages build is a client-only demo. Open the Three Dog Farm desk to accept orders and edit stock — no sign-in.
        </p>
        <Button className="mt-4 h-12 w-full" onClick={() => setDemo(true)}>
          Open the demo desk
        </Button>
        <p className="mt-3 text-xs text-muted">Full owner auth ships with the server deploy, not on Pages.</p>
      </div>
    );
  }

  if (!stand) return <p className="text-sm text-muted">Demo stand is not listed.</p>;

  return (
    <DemoWorkspace
      stand={stand}
      onOpen={onOpen}
      onRefresh={onRefresh}
      onExit={() => setDemo(false)}
    />
  );
}

function DemoWorkspace({
  stand,
  onOpen,
  onRefresh,
  onExit,
}: {
  stand: FarmStand;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onExit: () => void;
}) {
  const listDemoTickets = useDemoStore((s) => s.listDemoTickets);
  const updateDemoOrder = useDemoStore((s) => s.updateDemoOrder);
  const getBundle = useDemoStore((s) => s.getBundle);
  const upsertItem = useDemoStore((s) => s.upsertItem);
  const setItemStatus = useDemoStore((s) => s.setItemStatus);
  const removeItem = useDemoStore((s) => s.removeItem);
  const postSpecial = useDemoStore((s) => s.postSpecial);
  const [tab, setTab] = useState<"orders" | "stock" | "special">("orders");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const tickets = useMemo(() => listDemoTickets(), [listDemoTickets, tick]);
  const items = useMemo(() => getBundle(stand.id).items, [getBundle, stand.id, tick]);
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "accepted").length;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("each");
  const [price, setPrice] = useState("6.00");
  const [qty, setQty] = useState("12");
  const [spTitle, setSpTitle] = useState("");
  const [spBody, setSpBody] = useState("");

  function refresh() {
    setTick((n) => n + 1);
    onRefresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Demo desk</p>
          <h2 className="font-display text-2xl font-semibold">{stand.name}</h2>
          <p className="text-sm text-muted">{stand.city ?? "Area"} · client-only Pages demo</p>
        </div>
        <button type="button" className="text-sm text-muted" onClick={onExit}>Exit</button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={() => onOpen(stand.id)}>View stand</Button>
        <Button variant="outline" className="h-11 flex-1" onClick={refresh}>Refresh</Button>
      </div>

      <div className="flex gap-1 rounded-full bg-chip p-1">
        {(
          [
            ["orders", "Orders"],
            ["stock", "Stock"],
            ["special", "Special"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "h-10 flex-1 rounded-full bg-forest text-sm text-paper"
                : "h-10 flex-1 rounded-full text-sm text-muted"
            }
          >
            {label}
            {id === "orders" && <QueueBadge count={openCount} />}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <OrderQueue
          tickets={tickets}
          busy={busy}
          onStatus={(ticketId: string, status: TicketStatus) => {
            setBusy(true);
            try {
              updateDemoOrder(ticketId, status);
              refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {tab === "stock" && (
        <div className="flex flex-col gap-3">
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {items.map((it: InventoryItem) => (
              <li key={it.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.name}</span>
                  <span className="text-xs text-muted">
                    {formatMoney(it.priceCents)} / {it.unit}
                    {it.maxQty != null ? ` · ${it.maxQty}` : ""} · {it.status}
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded-full bg-chip px-2 py-1 text-xs"
                  onClick={() => {
                    const cycle = it.status === "in" ? "low" : it.status === "low" ? "out" : "in";
                    setItemStatus(it.id, cycle);
                    refresh();
                  }}
                >
                  {it.status}
                </button>
                <button
                  type="button"
                  className="text-xs text-rust"
                  onClick={() => {
                    removeItem(it.id);
                    refresh();
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-border bg-surface p-3">
            <h3 className="font-display text-lg font-semibold">Add item</h3>
            <div className="mt-2 grid gap-2">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <Input placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} />
                <Input placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <Button
                className="h-11"
                disabled={!name.trim()}
                onClick={() => {
                  const cents = Math.round(Number(price) * 100);
                  upsertItem({
                    standId: stand.id,
                    name: name.trim(),
                    unit: unit.trim() || "each",
                    priceCents: Number.isFinite(cents) ? Math.max(0, cents) : 0,
                    status: "in",
                    photo: null,
                    preorderable: true,
                    maxQty: Number(qty) || null,
                    decrementOnSale: true,
                  });
                  setName("");
                  refresh();
                }}
              >
                Save to board
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "special" && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <h3 className="font-display text-lg font-semibold">Today&apos;s special</h3>
          <div className="mt-2 grid gap-2">
            <Input placeholder="Title" value={spTitle} onChange={(e) => setSpTitle(e.target.value)} />
            <Textarea placeholder="Short note for followers" value={spBody} onChange={(e) => setSpBody(e.target.value)} className="min-h-24" />
            <Button
              className="h-11"
              disabled={!spTitle.trim() || !spBody.trim()}
              onClick={() => {
                postSpecial(stand.id, spTitle, spBody);
                setSpTitle("");
                setSpBody("");
                refresh();
              }}
            >
              Post special
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
