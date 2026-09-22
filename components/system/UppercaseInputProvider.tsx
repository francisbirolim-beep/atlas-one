'use client'

import { useEffect } from 'react'
import type { FormEvent, ReactNode } from 'react'

const TIPOS_PRESERVAR = new Set([
  'email',
  'password',
  'search',
  'tel',
  'url',
  'number',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'color',
  'file',
  'checkbox',
  'radio',
  'range',
  'hidden',
])

const TERMOS_PRESERVAR = [
  'email',
  'e-mail',
  'senha',
  'password',
  'url',
  'link',
  'token',
  'secret',
  'api_key',
  'apikey',
  'chave',
  'busca',
  'buscar',
  'pesquisa',
  'pesquisar',
  'search',
]

function devePreservar(elemento: HTMLInputElement | HTMLTextAreaElement) {
  if (elemento.dataset.preserveCase === 'true') return true

  if (elemento instanceof HTMLInputElement) {
    const tipo = (elemento.type || 'text').toLowerCase()
    if (TIPOS_PRESERVAR.has(tipo)) return true
  }

  const identidade = [
    elemento.name,
    elemento.id,
    elemento.getAttribute('aria-label'),
    elemento.getAttribute('placeholder'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return TERMOS_PRESERVAR.some(termo => identidade.includes(termo))
}

export default function UppercaseInputProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const aplicar = (raiz: ParentNode) => {
      raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(el => {
        if (el.type === 'hidden' || el.type === 'password' || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return
        if (!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'on')
        if (!el.hasAttribute('autocapitalize') && el.type !== 'email' && el.type !== 'url') el.setAttribute('autocapitalize', 'sentences')
        if (!el.hasAttribute('spellcheck') && el.type !== 'number' && el.type !== 'tel') el.setAttribute('spellcheck', 'true')
      })
    }
    aplicar(document)
    const observer = new MutationObserver(registros => registros.forEach(r => r.addedNodes.forEach(n => { if (n instanceof HTMLElement) aplicar(n) })))
    observer.observe(document.body,{childList:true,subtree:true})
    return () => observer.disconnect()
  }, [])

  function padronizar(evento: FormEvent<HTMLDivElement>) {
    const alvo = evento.target
    if (!(alvo instanceof HTMLInputElement) && !(alvo instanceof HTMLTextAreaElement)) return
    if (devePreservar(alvo)) return

    const atual = alvo.value
    const maiusculo = atual.toLocaleUpperCase('pt-BR')
    if (atual === maiusculo) return

    const inicio = alvo.selectionStart
    const fim = alvo.selectionEnd
    alvo.value = maiusculo

    if (inicio != null && fim != null) {
      try {
        alvo.setSelectionRange(inicio, fim)
      } catch {}
    }
  }

  return <div className="contents" onInputCapture={padronizar}>{children}</div>
}
