'use client'

import { useEffect } from 'react'
import type { FormEvent, ReactNode } from 'react'

const TIPOS_PRESERVAR = new Set([
  'email',
  'password',
  'search',
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
  'codigo',
  'sku',
  'referencia',
  'identificador',
  'uuid',
  'busca',
  'buscar',
  'pesquisa',
  'pesquisar',
  'search',
  'filtro',
  'mensagem',
  'message',
  'observacao',
  'comentario',
  'nota',
  'descricao',
  'detalhe',
  'texto livre',
  'conteudo',
  'pergunta',
  'resposta',
  'escreva',
  'pergunte',
  'converse',
]

function normalizarIdentidade(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function identidadeCampo(elemento: HTMLInputElement | HTMLTextAreaElement) {
  const rotulos = elemento.labels ? Array.from(elemento.labels).map(label => label.textContent || '') : []
  return normalizarIdentidade([
    elemento.name,
    elemento.id,
    elemento.getAttribute('aria-label'),
    elemento.getAttribute('placeholder'),
    elemento.getAttribute('title'),
    ...rotulos,
  ].filter(Boolean).join(' '))
}

function devePreservar(elemento: HTMLInputElement | HTMLTextAreaElement) {
  if (elemento.dataset.uppercase === 'true') return false
  if (elemento.dataset.preserveCase === 'true') return true

  if (elemento instanceof HTMLTextAreaElement) return true

  const tipo = (elemento.type || 'text').toLowerCase()
  if (TIPOS_PRESERVAR.has(tipo)) return true
  if (elemento.hasAttribute('list')) return true

  const identidade = identidadeCampo(elemento)
  return TERMOS_PRESERVAR.some(termo => identidade.includes(termo))
}

function setterNativo(elemento: HTMLInputElement | HTMLTextAreaElement) {
  const prototipo = elemento instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  return Object.getOwnPropertyDescriptor(prototipo, 'value')?.set
}

export default function UppercaseInputProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const aplicar = (raiz: ParentNode) => {
      raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(elemento => {
        const tipo = elemento instanceof HTMLInputElement ? (elemento.type || 'text').toLowerCase() : 'textarea'
        if (['hidden', 'password', 'file', 'checkbox', 'radio', 'range', 'color'].includes(tipo)) return

        if (!elemento.hasAttribute('autocomplete')) elemento.setAttribute('autocomplete', 'on')

        const textoNatural = devePreservar(elemento)
        const campoTexto = !['email', 'url', 'number', 'tel', 'date', 'datetime-local', 'time', 'month', 'week'].includes(tipo)

        if (campoTexto) {
          if (!elemento.hasAttribute('autocapitalize')) {
            elemento.setAttribute('autocapitalize', textoNatural ? 'sentences' : 'characters')
          }
          if (!elemento.hasAttribute('spellcheck')) elemento.setAttribute('spellcheck', 'true')
          if (!elemento.hasAttribute('autocorrect')) elemento.setAttribute('autocorrect', 'on')
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

  function padronizar(evento: FormEvent<HTMLDivElement>) {
    const alvo = evento.target
    if (!(alvo instanceof HTMLInputElement) && !(alvo instanceof HTMLTextAreaElement)) return
    if (devePreservar(alvo)) return

    const atual = alvo.value
    const maiusculo = atual.toLocaleUpperCase('pt-BR')
    if (atual === maiusculo) return

    const inicio = alvo.selectionStart
    const fim = alvo.selectionEnd
    const setter = setterNativo(alvo)
    if (setter) setter.call(alvo, maiusculo)
    else alvo.value = maiusculo

    if (inicio != null && fim != null) {
      try {
        alvo.setSelectionRange(inicio, fim)
      } catch {}
    }
  }

  return <div className="contents" onInputCapture={padronizar}>{children}</div>
}
