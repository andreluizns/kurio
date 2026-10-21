import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[3px] border border-line bg-transparent px-4 text-[15px] text-cream transition-colors outline-none selection:bg-brand selection:text-ink placeholder:text-khaki disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-brand focus-visible:outline-none",
        "aria-invalid:border-coral",
        className
      )}
      {...props}
    />
  )
}

export { Input }
