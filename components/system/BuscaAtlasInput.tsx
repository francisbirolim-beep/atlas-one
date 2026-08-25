'use client'

import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onInput'> & {
  value: string
  onValueChange: (valor: string) => void
  containerClassName?: string
  inputClassName?: string
  mostrarIcone?: boolean
}

/** Campo oficial de busca do Atlas: captura cada alteração real do input,
 * inclusive durante composição do teclado, sem depender de Enter ou espaço. */
export default function BuscaAtlasInput({
  value,
  onValueChange,
  containerClassName = '',
  inputClassName = '',
  mostrarIcone = true,
  ...props
}: Props) {
  const atualizar = (alvo: HTMLInputElement) => onValueChange(alvo.value)

  return (
    <div className={`relative ${containerClassName}`}>
      {mostrarIcone ? <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /> : null}
      <input
        {...props}
        type={props.type || 'search'}
        value={value}
        autoComplete={props.autoComplete || 'off'}
        onInput={e => atualizar(e.currentTarget)}
        onCompositionUpdate={e => atualizar(e.currentTarget)}
        onCompositionEnd={e => atualizar(e.currentTarget)}
        className={`${mostrarIcone ? 'pl-9' : ''} ${inputClassName}`}
      />
    </div>
  )
}
