import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted shadow-none outline-none focus-visible:ring-2 focus-visible:ring-forest/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-forest/30",
        className,
      )}
      {...props}
    />
  );
}
