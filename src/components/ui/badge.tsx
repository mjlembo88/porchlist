import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: ComponentProps<"span"> & { tone?: "muted" | "forest" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide",
        tone === "muted" && "bg-secondary text-muted",
        tone === "forest" && "bg-forest text-paper",
        tone === "warn" && "bg-secondary text-ink",
        className,
      )}
      {...props}
    />
  );
}
