import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pay/links";
import { ticketStatusLabel, type Ticket, type TicketStatus } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

export function OrderQueue({
  tickets,
  busy,
  onStatus,
}: {
  tickets: Ticket[];
  busy: boolean;
  onStatus: (ticketId: string, status: TicketStatus) => void;
}) {
  const open = tickets.filter((t) => t.status === "open" || t.status === "accepted");
  const done = tickets.filter((t) => t.status === "paid" || t.status === "void").slice(0, 6);

  if (tickets.length === 0) {
    return <p className="text-sm text-muted">No orders yet. Shoppers send pickup and preorder from the stand page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Queue</h3>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Caught up. New tickets land here.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {open.map((t) => (
              <OrderCard key={t.id} ticket={t} busy={busy} onStatus={onStatus} />
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Recent</h3>
          <ul className="mt-1 divide-y divide-border">
            {done.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate">{t.customerName ?? "Neighbor"} · {ticketStatusLabel(t.status)}</span>
                <span className="tabular-nums text-muted">{formatMoney(t.totalCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OrderCard({
  ticket: t, busy, onStatus,
}: {
  ticket: Ticket;
  busy: boolean;
  onStatus: (ticketId: string, status: TicketStatus) => void;
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{t.customerName ?? "Neighbor"}</p>
        <p className="font-display text-lg tabular-nums">{formatMoney(t.totalCents)}</p>
      </div>
      <p className="text-xs text-muted">
        {t.source === "preorder" ? "Preorder" : "Pickup"} · {t.pickupWindow ?? "Window not set"} · {ticketStatusLabel(t.status)}
      </p>
      <ul className="mt-1 text-sm">
        {t.lines.map((l) => (
          <li key={l.id}>{l.qty} × {l.name}</li>
        ))}
      </ul>
      {t.note && <p className="mt-1 text-sm text-muted">{t.note}</p>}
      <div className="mt-2 flex gap-2">
        {t.status === "open" && (
          <>
            <Button className="h-11 flex-1" disabled={busy} onClick={() => onStatus(t.id, "accepted")}>Accept</Button>
            <Button className="h-11 flex-1" variant="outline" disabled={busy} onClick={() => onStatus(t.id, "void")}>Decline</Button>
          </>
        )}
        {t.status === "accepted" && (
          <Button className="h-11 w-full" disabled={busy} onClick={() => onStatus(t.id, "paid")}>Fulfill · picked up</Button>
        )}
      </div>
    </li>
  );
}

export function QueueBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={cn("ml-1 inline-grid min-w-5 place-items-center rounded-full bg-forest px-1.5 text-[10px] font-medium text-paper tabular-nums")}>
      {count}
    </span>
  );
}
