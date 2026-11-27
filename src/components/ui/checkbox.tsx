// Adapted from shadcn/ui's MIT-licensed Radix Checkbox. See THIRD_PARTY_UI.md.
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    data-slot="checkbox"
    className={cn("ui-checkbox", className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
      <Check size={13} strokeWidth={2.5} aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
