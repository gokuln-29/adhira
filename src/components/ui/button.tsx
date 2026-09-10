import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-mono-label transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-primary) text-white hover:bg-(--color-primary-hover) hover:shadow-[0_0_0_3px_var(--color-mint)]",
  secondary:
    "border border-(--color-hairline) text-(--color-ink) bg-(--color-surface) hover:border-(--color-primary)",
  ghost: "text-(--color-ink) hover:text-(--color-primary)",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[11px] rounded-[2px]",
  md: "px-6 py-3 text-xs rounded-[2px]",
  lg: "px-8 py-4 text-sm rounded-[2px]",
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
