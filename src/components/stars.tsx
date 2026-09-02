import { Star } from "lucide-react";
import { formatRating } from "@/lib/stands/types";
import { cn } from "@/lib/utils";

export function Stars({
  value,
  count,
  size = "sm",
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  showValue?: boolean;
}) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  const dim = size === "md" ? "size-4" : "size-3.5";
  return (
    <span className="inline-flex items-center gap-1 text-forest">
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(dim, n <= filled ? "fill-forest text-forest" : "text-border")}
          />
        ))}
      </span>
      {showValue && (
        <span className={cn("tabular-nums text-muted", size === "md" ? "text-sm" : "text-xs")}>
          {count ? `${formatRating(value)} · ${count}` : value > 0 ? formatRating(value) : "New"}
        </span>
      )}
    </span>
  );
}

export function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className="grid size-11 place-items-center"
          onClick={() => onChange(n)}
        >
          <Star className={cn("size-6", n <= value ? "fill-forest text-forest" : "text-border")} />
        </button>
      ))}
    </div>
  );
}
