import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ember-400 text-ink-950 hover:bg-ember-300 focus-visible:outline-ember-300 font-semibold",
  secondary:
    "bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-700 focus-visible:outline-ink-400",
  ghost: "text-ink-300 hover:text-ink-100 hover:bg-ink-850 focus-visible:outline-ink-600",
  danger: "bg-rose-glow/15 text-rose-glow hover:bg-rose-glow/25 border border-rose-glow/30",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-sm rounded-xl",
  lg: "h-13 px-6 text-base rounded-2xl",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
