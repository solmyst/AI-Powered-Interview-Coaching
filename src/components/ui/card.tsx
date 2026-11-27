// Adapted from shadcn/ui's MIT-licensed Card. See THIRD_PARTY_UI.md.
import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn("ui-card", className)}
    {...props}
  />
));
Card.displayName = "Card";
export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("ui-card-header", className)}
      {...props}
    />
  );
}
export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("ui-card-content", className)}
      {...props}
    />
  );
}
