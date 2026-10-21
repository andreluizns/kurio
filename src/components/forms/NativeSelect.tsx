import { forwardRef, type ComponentProps } from 'react'
import { SelectArrow } from '@/components/icons'
import { cn } from '@/lib/utils'

/** Select nativo estilizado (acessível por padrão e compatível com react-hook-form). */
export const NativeSelect = forwardRef<HTMLSelectElement, ComponentProps<'select'> & { wrapperClassName?: string }>(function NativeSelect(
  { className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-[3px] border border-line bg-ink pr-10 pl-3 text-[15px] text-cream outline-none focus-visible:border-brand aria-invalid:border-coral disabled:opacity-50 has-[option[value=""]:checked]:text-khaki',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <SelectArrow className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-cream" />
    </div>
  )
})
