'use client'

import { useEffect } from 'react'
import KanbanPageFixed from '@/components/system/KanbanPageFixed'

const TITULO_WVETRO = 'Orçamento W.Vetro (original)'

function preencherTituloWvetro() {
  const campos = document.querySelectorAll<HTMLInputElement>(
    'input[placeholder="Título (ex: Orçamento com contramarco)"]'
  )

  campos.forEach(campo => {
    if (campo.value.trim()) return

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set

    if (setter) setter.call(campo, TITULO_WVETRO)
    else campo.value = TITULO_WVETRO

    campo.dispatchEvent(new Event('input', { bubbles: true }))
    campo.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export default function KanbanPage() {
  useEffect(() => {
    preencherTituloWvetro()

    const observer = new MutationObserver(() => preencherTituloWvetro())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return <KanbanPageFixed />
}
