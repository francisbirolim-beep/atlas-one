'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

export default function UppercaseInputProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const aplicar = (raiz: ParentNode) => {
      raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(el => {
        const tipo = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : 'textarea'
        if (['hidden','password','file','checkbox','radio','range','color'].includes(tipo)) return

        if (!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'on')

        const campoTexto = !['email','url','number','tel','date','datetime-local','time','month','week'].includes(tipo)
        if (campoTexto) {
          if (!el.hasAttribute('autocapitalize')) el.setAttribute('autocapitalize', 'sentences')
          if (!el.hasAttribute('spellcheck')) el.setAttribute('spellcheck', 'true')
          if (!el.hasAttribute('autocorrect')) el.setAttribute('autocorrect', 'on')
        }
      })
    }

    aplicar(document)
    const observer = new MutationObserver(registros =>
      registros.forEach(registro =>
        registro.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) aplicar(node)
        }),
      ),
    )
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <div className="contents">{children}</div>
}
