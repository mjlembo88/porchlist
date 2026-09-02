import { MapPin } from "lucide-react";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { isFeaturedPlan } from "@/lib/billing/plans";
import { ACCESS_LABEL, type FarmStand } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

export function StandList({
  stands,
  selectedId,
  onSelect,
}: {
  stands: FarmStand[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (stands.length === 0) {
    return <p className="px-1 py-8 text-sm text-muted">No stands match that filter.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {stands.map((stand) => {
        const featured = isFeaturedPlan(stand.plan) || stand.featured;
        return (
          <li key={stand.id}>
            <button
              type="button"
              onClick={() => onSelect(stand.id)}
              className={cn(
                "w-full rounded-2xl border px-3.5 py-2.5 text-left transition-[border-color,background-color] duration-[var(--motion-quick)]",
                selectedId === stand.id
                  ? "border-forest bg-chip"
                  : featured
                    ? "border-rust/35 bg-surface"
                    : "border-border bg-surface hover:border-sage/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium leading-snug">{stand.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3 shrink-0" />
                    {stand.city ?? "Area"}
                    {stand.county ? ` · ${stand.county}` : ""}
                  </p>
                </div>
                <Badge tone={featured ? "forest" : "muted"}>
                  {ACCESS_LABEL[stand.access] ?? stand.access}
                </Badge>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <Stars value={stand.ratingAvg} count={stand.reviewCount} />
                <p className="truncate text-xs text-muted">
                  {stand.products.slice(0, 3).join(" · ") || "Hours on the board"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
