'use client'

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
