'use client'

import { useEffect } from 'react'
import KanbanPageFixed from '@/components/system/KanbanPageFixed'
import { tokenAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const TITULO_WVETRO = 'Orçamento W.Vetro (original)'

type CardDataKanban = {
  id: string
  cliente_nome: string
  coluna_id?: string | null
  created_at: string
  kanban_entrada_em?: string | null
  criado_por_nome?: string | null
  valor_estimado?: number | null
}

type ColunaDataKanban = {
  id: string
  nome: string
  ordem: number
}

let cardsDataKanban: CardDataKanban[] = []
let colunasDataKanban: ColunaDataKanban[] = []

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

function moeda(valor: number | null | undefined) {
  if (valor == null) return ''
  return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function carregarDatasKanban() {
  const [colunasResp, cardsResp] = await Promise.all([
    supabase.from('kanban_colunas').select('id,nome,ordem').order('ordem', { ascending: true }),
    supabase
      .from('orcamentos')
      .select('id,cliente_nome,coluna_id,created_at,kanban_entrada_em,criado_por_nome,valor_estimado,modo_entrada')
      .neq('modo_entrada', 'balcao')
      .order('created_at', { ascending: false }),
  ])

  if (!colunasResp.error) colunasDataKanban = (colunasResp.data || []) as ColunaDataKanban[]
  if (!cardsResp.error) cardsDataKanban = (cardsResp.data || []) as CardDataKanban[]
}

function marcarFiltroDataComoEntradaKanban() {
  const campo = document.querySelector<HTMLInputElement>('main input[type="date"]')
  if (!campo) return
  campo.title = 'Filtrar pela data de entrada no Kanban'
  campo.setAttribute('aria-label', 'Data de entrada no Kanban')
}

function elementoDaColuna(nome: string): HTMLElement | null {
  const titulo = Array.from(document.querySelectorAll<HTMLHeadingElement>('h3'))
    .find(el => el.textContent?.trim() === nome)
  return (titulo?.parentElement?.parentElement?.parentElement as HTMLElement | null) || null
}

function aplicarDatasNosCards() {
  if (!cardsDataKanban.length || !colunasDataKanban.length) return

  const primeiraColunaId = colunasDataKanban[0]?.id

  for (const coluna of colunasDataKanban) {
    const colunaEl = elementoDaColuna(coluna.nome)
    if (!colunaEl) continue

    const areaCards = Array.from(colunaEl.children)
      .find(el => el instanceof HTMLElement && el.classList.contains('space-y-2')) as HTMLElement | undefined
    if (!areaCards) continue

    const dadosColuna = cardsDataKanban.filter(card => (card.coluna_id || primeiraColunaId) === coluna.id)
    const usados = new Set<string>()
    const cardsVisiveis = Array.from(areaCards.children).filter(el => el instanceof HTMLElement) as HTMLElement[]

    for (const cardEl of cardsVisiveis) {
      const nomeEl = cardEl.querySelector<HTMLElement>('p.font-medium')
      const nome = nomeEl?.textContent?.trim()
      if (!nome) continue

      let candidatos = dadosColuna.filter(card => !usados.has(card.id) && card.cliente_nome.trim() === nome)
      if (!candidatos.length) continue

      const textoCard = cardEl.textContent || ''
      if (candidatos.length > 1) {
        const comCriador = candidatos.filter(card => !card.criado_por_nome || textoCard.includes(card.criado_por_nome))
        if (comCriador.length) candidatos = comCriador
      }
      if (candidatos.length > 1) {
        const comValor = candidatos.filter(card => card.valor_estimado == null || textoCard.includes(moeda(card.valor_estimado)))
        if (comValor.length) candidatos = comValor
      }

      const card = candidatos[0]
      if (!card) continue
      usados.add(card.id)

      const entrada = card.kanban_entrada_em || card.created_at
      if (!entrada) continue

      let dataEl = cardEl.querySelector<HTMLElement>('[data-kanban-entrada]')
      if (!dataEl) {
        dataEl = document.createElement('p')
        dataEl.dataset.kanbanEntrada = 'true'
        dataEl.className = 'text-xs flex items-center gap-1 mt-1'

        const filhosP = Array.from(cardEl.children).filter(el => el.tagName === 'P') as HTMLElement[]
        const antesDoCriador = card.criado_por_nome
          ? filhosP.find(el => el.textContent?.includes(card.criado_por_nome || ''))
          : undefined
        const valorFormatado = moeda(card.valor_estimado)
        const antesDoValor = valorFormatado
          ? filhosP.find(el => el.textContent?.includes(valorFormatado))
          : undefined
        const referencia = antesDoCriador || antesDoValor

        if (referencia) cardEl.insertBefore(dataEl, referencia)
        else cardEl.appendChild(dataEl)
      }

      dataEl.textContent = `📅 Entrada: ${new Date(entrada).toLocaleDateString('pt-BR')}`
      dataEl.style.color = nomeEl ? getComputedStyle(nomeEl).color : '#94a3b8'
      dataEl.style.opacity = '0.72'
    }
  }
}

export default function KanbanPage() {
  useEffect(() => {
    let timerDatas: ReturnType<typeof setTimeout> | null = null
    let desmontado = false

    const atualizarDatas = async () => {
      await carregarDatasKanban()
      if (!desmontado) aplicarDatasNosCards()
    }

    const agendarDatas = () => {
      if (timerDatas) clearTimeout(timerDatas)
      timerDatas = setTimeout(atualizarDatas, 180)
    }

    const preparar = () => {
      preencherTituloWvetro()
      conectarLeituraTotalPdf()
      marcarFiltroDataComoEntradaKanban()
      aplicarDatasNosCards()
      agendarDatas()
    }

    preparar()

    const observer = new MutationObserver(preparar)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      desmontado = true
      if (timerDatas) clearTimeout(timerDatas)
      observer.disconnect()
    }
  }, [])

  return <KanbanPageFixed />
}
