import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/http'
import { Hide } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

/** Campo com label, asterisco de obrigatório e mensagem de erro associada (aria-describedby). */
export function Field({
  label,
  required = false,
  error,
  hint,
  className,
  labelClassName,
  hideLabel = false,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  hideLabel?: boolean
  children: (props: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <label htmlFor={id} className={cn('flex items-center text-[15px] leading-[15px] text-cream', hideLabel && 'sr-only', labelClassName)}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-[22px] leading-[15px] text-coral">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-khaki">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-4 text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-12', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center text-khaki hover:text-cream"
      >
        <Hide className="h-5 w-[23px]" />
      </button>
    </div>
  )
})

/** Aplica erros de campo vindos da API no formulário; retorna a mensagem geral. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, map: Partial<Record<string, Path<T>>> = {}) {
  if (!isApiError(error)) return 'Erro inesperado. Tente novamente.'
  let first = true
  for (const [field, message] of Object.entries(error.fields)) {
    const target = (map[field] ?? field) as Path<T>
    setError(target, { type: 'server', message }, { shouldFocus: first })
    first = false
  }
  return error.message
}
