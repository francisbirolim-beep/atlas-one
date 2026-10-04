'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

const TIPOS_SEM_ASSISTENCIA = new Set([
  'hidden',
  'password',
  'file',
  'checkbox',
  'radio',
  'number',
  'range',
  'color',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'tel',
  'email',
  'url',
])

function prepararCampo(elemento: HTMLInputElement | HTMLTextAreaElement | HTMLElement) {
  if (elemento instanceof HTMLInputElement && TIPOS_SEM_ASSISTENCIA.has((elemento.type || 'text').toLowerCase())) {
    return
  }

  if (!elemento.hasAttribute('lang')) elemento.setAttribute('lang', 'pt-BR')
  if (!elemento.hasAttribute('spellcheck')) elemento.setAttribute('spellcheck', 'true')
  if (!elemento.hasAttribute('autocorrect')) elemento.setAttribute('autocorrect', 'on')

  if (elemento instanceof HTMLInputElement) {
    if (!elemento.hasAttribute('autocomplete')) elemento.setAttribute('autocomplete', 'on')
    if (
      !elemento.hasAttribute('autocapitalize') &&
      (elemento.type || 'text').toLowerCase() !== 'search'
    ) {
      elemento.setAttribute('autocapitalize', 'sentences')
    }
    return
  }

  if (!elemento.hasAttribute('autocapitalize')) elemento.setAttribute('autocapitalize', 'sentences')
}

export default function UppercaseInputProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const aplicar = (raiz: ParentNode) => {
      raiz
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLElement>(
          'input, textarea, [contenteditable="true"]',
        )
        .forEach(prepararCampo)
    }

    aplicar(document)

    const observer = new MutationObserver(registros => {
      registros.forEach(registro => {
        registro.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return
          prepararCampo(node)
          aplicar(node)
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <>{children}</>
}
