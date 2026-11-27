// Adapted from shadcn/ui's MIT-licensed new-york Button. See THIRD_PARTY_UI.md.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ui-button-primary",
        outline: "ui-button-outline",
        ghost: "ui-button-ghost",
        destructive: "ui-button-destructive",
      },
      size: {
        default: "ui-button-md",
        sm: "ui-button-sm",
        lg: "ui-button-lg",
        icon: "ui-button-icon",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variants> & { asChild?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(variants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
