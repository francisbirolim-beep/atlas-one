'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import type { Produto } from '@/lib/tipos'

type ProdutoComImagem = Produto & { imagem_tecnica_url?: string | null }

type ImagemBanco = {
  produto_id: string
  url: string
  principal?: boolean | null
  status_validacao?: string | null
}

function normalizarCodigo(valor: string | null | undefined) {
  return String(valor || '').trim().toUpperCase()
}

function localizarSecao(titulo: string) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(el => el.textContent?.trim() === titulo)
  return h2?.closest('section,div.rounded-2xl') as HTMLElement | null
}

function criarBotao(texto: string, onClick: () => void, destaque = false) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = texto
  btn.dataset.atlasModelosAcao = '1'
  btn.className = destaque
    ? 'inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700'
    : 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50'
  btn.addEventListener('click', ev => {
    ev.preventDefault()
    ev.stopPropagation()
    onClick()
  })
  return btn
}

function criarMiniatura(produto: ProdutoComImagem | undefined) {
  const wrap = document.createElement('div')
  wrap.dataset.atlasDesenho = '1'
  wrap.className = 'flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white'

  const url = produto?.imagem_tecnica_url || produto?.foto_url || ''
  if (url) {
    const img = document.createElement('img')
    img.src = url
    img.alt = `Desenho ${produto?.codigo || produto?.nome || ''}`
    img.loading = 'lazy'
    img.className = 'h-full w-full object-contain p-1'
    wrap.appendChild(img)
  } else {
    const span = document.createElement('span')
    span.textContent = 'Sem desenho'
    span.className = 'px-1 text-center text-[9px] font-semibold leading-tight text-amber-600'
    wrap.appendChild(span)
  }
  return wrap
}

export default function ModelosMateriaisEnhancer() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/engenharia/modelos') return

    let cancelado = false
    let observer: MutationObserver | null = null
    let agendado = false

    void (async () => {
      const produtosBase = await listarProdutosTecnicos()
      if (cancelado) return

      const ids = produtosBase.map(p => p.id).filter(Boolean)
      const imagensPorProduto = new Map<string, string>()
      if (ids.length) {
        const { data } = await supabase
          .from('produto_imagens')
          .select('produto_id,url,principal,status_validacao')
          .in('produto_id', ids)
          .eq('ativo', true)
          .neq('status_validacao', 'rejeitada')
          .order('principal', { ascending: false })

        for (const img of (data || []) as ImagemBanco[]) {
          if (!imagensPorProduto.has(img.produto_id) && img.url) imagensPorProduto.set(img.produto_id, img.url)
        }
      }

      const porCodigo = new Map<string, ProdutoComImagem>()
      for (const p of produtosBase) {
        const codigo = normalizarCodigo(p.codigo)
        if (!codigo) continue
        porCodigo.set(codigo, { ...p, imagem_tecnica_url: imagensPorProduto.get(p.id) || p.foto_url || null })
      }

      function focarPlanilha(tipo: 'perfil' | 'acessorio', codigo?: string) {
        const titulo = tipo === 'perfil' ? 'Planilha técnica — perfis' : 'Planilha técnica — acessórios'
        const secao = localizarSecao(titulo)
        if (!secao) return
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' })

        window.setTimeout(() => {
          const inputs = Array.from(secao.querySelectorAll('tbody tr input')) as HTMLInputElement[]
          let alvo = codigo ? inputs.find(input => normalizarCodigo(input.value) === normalizarCodigo(codigo)) : undefined
          if (!alvo && inputs.length) alvo = inputs[inputs.length - (tipo === 'perfil' ? 4 : 3)] || inputs[inputs.length - 1]
          alvo?.focus()
          alvo?.select()
        }, 350)
      }

      function adicionar(tipo: 'perfil' | 'acessorio') {
        const titulo = tipo === 'perfil' ? 'Planilha técnica — perfis' : 'Planilha técnica — acessórios'
        const secao = localizarSecao(titulo)
        if (!secao) return
        const texto = tipo === 'perfil' ? 'Adicionar perfil' : 'Adicionar'
        const botaoOriginal = Array.from(secao.querySelectorAll('button')).find(btn => !btn.dataset.atlasModelosAcao && btn.textContent?.trim() === texto) as HTMLButtonElement | undefined
        botaoOriginal?.click()
        window.setTimeout(() => focarPlanilha(tipo), 80)
      }

      function garantirBotaoAdicionar(titulo: string, tipo: 'perfil' | 'acessorio', rotulo: string) {
        const secao = localizarSecao(titulo)
        if (!secao) return
        const h2 = Array.from(secao.querySelectorAll('h2')).find(el => el.textContent?.trim() === titulo)
        const cabecalho = h2?.parentElement
        if (!cabecalho || cabecalho.querySelector(`[data-atlas-add-${tipo}]`)) return
        const holder = document.createElement('div')
        holder.dataset[`atlasAdd${tipo === 'perfil' ? 'Perfil' : 'Acessorio'}`] = '1'
        holder.className = 'ml-auto flex items-center gap-2'
        holder.appendChild(criarBotao(`+ ${rotulo}`, () => adicionar(tipo), true))
        cabecalho.appendChild(holder)
      }

      function enriquecerTabela(titulo: string, tipo: 'perfil' | 'acessorio') {
        const secao = localizarSecao(titulo)
        const tabela = secao?.querySelector('table') as HTMLTableElement | null
        if (!tabela) return

        const headRow = tabela.querySelector('thead tr')
        if (headRow && !headRow.querySelector('[data-atlas-th-desenho]')) {
          const th = document.createElement('th')
          th.dataset.atlasThDesenho = '1'
          th.textContent = 'Desenho'
          th.className = 'p-2 text-left'
          headRow.insertBefore(th, headRow.firstElementChild)

          const acao = document.createElement('th')
          acao.dataset.atlasThAcao = '1'
          acao.textContent = 'Ação'
          acao.className = 'p-2 text-left'
          headRow.appendChild(acao)
        }

        for (const row of Array.from(tabela.querySelectorAll('tbody tr')) as HTMLTableRowElement[]) {
          if (row.querySelector('[data-atlas-td-desenho]')) continue
          const primeira = row.querySelector('td')
          if (!primeira) continue
          const inputCodigo = primeira.querySelector('input') as HTMLInputElement | null
          const codigo = normalizarCodigo(inputCodigo?.value || primeira.textContent)
          if (!codigo) continue

          const produto = porCodigo.get(codigo)
          const tdImg = document.createElement('td')
          tdImg.dataset.atlasTdDesenho = '1'
          tdImg.className = 'p-1.5 align-middle'
          tdImg.appendChild(criarMiniatura(produto))
          row.insertBefore(tdImg, row.firstElementChild)

          const tdAcao = document.createElement('td')
          tdAcao.dataset.atlasTdAcao = '1'
          tdAcao.className = 'p-1.5 align-middle'
          tdAcao.appendChild(criarBotao('Substituir', () => focarPlanilha(tipo, codigo)))
          row.appendChild(tdAcao)
        }
      }

      function aplicar() {
        agendado = false
        garantirBotaoAdicionar('Perfis calculados / Plano de corte', 'perfil', 'Adicionar perfil')
        garantirBotaoAdicionar('Acessórios da simulação atual', 'acessorio', 'Adicionar acessório')
        enriquecerTabela('Perfis calculados / Plano de corte', 'perfil')
        enriquecerTabela('Acessórios da simulação atual', 'acessorio')
        enriquecerTabela('Planilha técnica — perfis', 'perfil')
        enriquecerTabela('Planilha técnica — acessórios', 'acessorio')
      }

      function agendar() {
        if (agendado) return
        agendado = true
        window.requestAnimationFrame(aplicar)
      }

      aplicar()
      observer = new MutationObserver(agendar)
      observer.observe(document.body, { childList: true, subtree: true })
    })()

    return () => {
      cancelado = true
      observer?.disconnect()
    }
  }, [pathname])

  return null
}
