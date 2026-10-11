'use client'

import { useEffect } from 'react'
import KanbanPageFixed from '@/components/system/KanbanPageFixed'
import { tokenAtual } from '@/lib/auth'

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

function encontrarCampoValorTotal(): HTMLInputElement | null {
  const labels = Array.from(document.querySelectorAll('label'))
  const label = labels.find(el => el.textContent?.trim().includes('Valor total do orçamento'))
  return label?.parentElement?.querySelector<HTMLInputElement>('input') || null
}

function mostrarValorLido(valorFormatado: string) {
  const campo = encontrarCampoValorTotal()
  if (!campo?.parentElement) return

  let aviso = campo.parentElement.querySelector<HTMLElement>('[data-atlas-total-pdf]')
  if (!aviso) {
    aviso = document.createElement('p')
    aviso.dataset.atlasTotalPdf = 'true'
    aviso.className = 'text-xs text-emerald-600 mt-1'
    campo.parentElement.appendChild(aviso)
  }
  aviso.textContent = `Valor lido automaticamente do PDF: ${valorFormatado}`
}

async function lerTotalDoPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return

  const token = await tokenAtual()
  if (!token) return

  const form = new FormData()
  form.append('arquivo', file)

  try {
    const resp = await fetch('/api/orcamento/ler-total-pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const json = await resp.json()
    if (!resp.ok || typeof json.valor !== 'number') return

    const campo = encontrarCampoValorTotal()
    if (!campo) return

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set

    const valorInterno = String(json.valor)
    if (setter) setter.call(campo, valorInterno)
    else campo.value = valorInterno

    campo.dispatchEvent(new Event('input', { bubbles: true }))
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    mostrarValorLido(json.valor_formatado || valorInterno)
  } catch (e) {
    console.error('Nao foi possivel ler o total do PDF:', e)
  }
}

function conectarLeituraTotalPdf() {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
  inputs.forEach(input => {
    const label = input.closest('label')
    if (!label?.textContent?.includes('Anexar')) return
    if (input.dataset.atlasLeituraTotal === 'true') return

    input.dataset.atlasLeituraTotal = 'true'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) lerTotalDoPdf(file)
    })
  })
}

export default function KanbanPage() {
  useEffect(() => {
    const preparar = () => {
      preencherTituloWvetro()
      conectarLeituraTotalPdf()
    }

    preparar()

    const observer = new MutationObserver(preparar)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  return <KanbanPageFixed />
}
