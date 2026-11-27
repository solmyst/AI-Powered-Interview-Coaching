// Adapted from shadcn/ui's MIT-licensed Native Select. See THIRD_PARTY_UI.md.
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <span data-slot="native-select-wrapper" className="ui-select-wrap">
    <select
      ref={ref}
      data-slot="native-select"
      className={cn("ui-select", className)}
      {...props}
    />
    <ChevronDown data-slot="native-select-icon" size={16} aria-hidden="true" />
  </span>
));
NativeSelect.displayName = "NativeSelect";
