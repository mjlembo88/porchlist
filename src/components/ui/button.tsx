import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color] duration-[var(--motion-quick,150ms)] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-forest text-paper hover:opacity-90",
        outline: "border border-border bg-surface text-ink hover:bg-secondary",
        ghost: "text-ink hover:bg-chip",
        rust: "bg-rust text-paper hover:opacity-90",
        link: "text-forest underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 rounded-[10px] px-4 text-sm",
        sm: "h-9 rounded-lg px-3 text-sm",
        lg: "h-12 rounded-xl px-5",
        icon: "size-11 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
