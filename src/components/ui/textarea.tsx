import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-[3px] border border-line bg-transparent px-4 py-3 text-[15px] text-cream outline-none placeholder:text-khaki focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
