import { cn } from "@/lib/utils";

type MonoLabelTag = "span" | "p" | "div" | "legend";

interface MonoLabelProps extends React.HTMLAttributes<HTMLElement> {
  as?: MonoLabelTag;
  muted?: boolean;
}

export function MonoLabel({
  as: Tag = "span",
  muted = true,
  className,
  ...props
}: MonoLabelProps) {
  return (
    <Tag
      className={cn(
        "font-mono-label text-xs",
        muted ? "text-(--color-muted)" : "text-(--color-ink)",
        className,
      )}
      {...props}
    />
  );
}
