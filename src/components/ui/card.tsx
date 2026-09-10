import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  soft?: boolean;
}

export function Card({ soft = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "border border-(--color-hairline) bg-(--color-surface)",
        soft ? "rounded-[12px]" : "rounded-[2px]",
        className,
      )}
      {...props}
    />
  );
}
