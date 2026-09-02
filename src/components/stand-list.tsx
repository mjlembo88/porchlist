import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isFeaturedPlan } from "@/lib/billing/plans";
import { ACCESS_LABEL, KIND_LABEL, type FarmStand } from "@/lib/stands/types";
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
                "w-full rounded-2xl border px-3.5 py-3 text-left transition-colors duration-150",
                selectedId === stand.id
                  ? "border-forest bg-chip"
                  : featured
                    ? "border-rust/40 bg-surface"
                    : "border-border bg-surface hover:border-sage/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium leading-snug">{stand.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3" />
                    {stand.city ?? "Area"}
                    {stand.county ? ` · ${stand.county}` : ""}
                  </p>
                </div>
                <Badge tone={featured ? "forest" : "muted"}>
                  {featured ? "Featured" : KIND_LABEL[stand.kind]}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
                {ACCESS_LABEL[stand.access] ?? stand.access}
                {stand.products.length > 0 ? ` · ${stand.products.slice(0, 4).join(" · ")}` : ""}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
