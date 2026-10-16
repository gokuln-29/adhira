import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-mono-label tracking-[0.14em] transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-primary) text-white hover:-translate-y-px hover:bg-(--color-primary-hover) hover:shadow-[0_14px_28px_-14px_rgba(14,124,90,0.7)] motion-reduce:hover:translate-y-0",
  secondary:
    "border border-(--color-ink)/25 text-(--color-ink) bg-transparent hover:border-(--color-ink) hover:bg-(--color-ink) hover:text-white",
  ghost: "text-(--color-ink) hover:text-(--color-primary)",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-5 py-2.5 text-[11px] rounded-[2px]",
  md: "px-7 py-3.5 text-xs rounded-[2px]",
  lg: "px-10 py-[1.1rem] text-[13px] rounded-[2px]",
};

export function buttonVariants(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = opts ?? {};
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
