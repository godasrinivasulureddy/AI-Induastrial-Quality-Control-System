import * as React from "react";

import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-white/10 bg-white/7 px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
