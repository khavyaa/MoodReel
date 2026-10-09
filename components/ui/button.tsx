import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "solid" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-accent text-on-accent border-accent hover:opacity-90",
  outline: "border-line hover:bg-soft",
  ghost: "border-transparent hover:bg-soft",
  danger: "border-line text-[#d4351c] hover:bg-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClasses(variant: Variant = "solid", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full border-2 font-bold whitespace-nowrap transition-[background-color,opacity] disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "solid",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
