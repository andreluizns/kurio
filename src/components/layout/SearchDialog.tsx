import { useId, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from '@/components/icons'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/** O gatilho é passado como filho para que o foco volte a ele ao fechar. */
export function SearchDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const id = useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="top-24 translate-y-0 sm:max-w-lg">
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Procure por nome, coleção ou ID do token.</DialogDescription>
        <form
          role="search"
          className="mt-2 flex items-center gap-2 rounded-md border border-line bg-ink px-3 focus-within:border-brand"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            void navigate({ to: '/', search: { q: value.trim() || undefined }, hash: 'catalogo' })
          }}
        >
          <label htmlFor={id} className="sr-only">
            Termo de busca
          </label>
          <Search className="size-4 shrink-0 text-khaki" />
          <input
            id={id}
            autoFocus
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Emerald Ape"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-cream placeholder:text-khaki focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-ink">
            Buscar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
