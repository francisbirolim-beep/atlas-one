'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/lib/tipos'

type Tipo = 'perfil' | 'acessorio'
type Linha = { id: string; nome: string; produto_ids: string[] }
type Target = { tipo: Tipo; mode: 'add' | 'replace'; row?: HTMLTableRowElement | null; sourceButton?: HTMLButtonElement | null }
type ProdutoComImagem = Produto & { imagem_tecnica_url?: string | null }

function norm(v: string | null | undefined) {
  return (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function compacto(v: string | null | undefined) {
  return norm(v).replace(/\s+/g, '')
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function findSection(el: Element | null) {
  return el?.closest('section') || null
}

function targetDoCampo(input: HTMLInputElement): { tipo: Tipo; row: HTMLTableRowElement } | null {
  const row = input.closest('tr') as HTMLTableRowElement | null
  const section = findSection(input)
  if (!row || !section || input !== row.querySelector('input')) return null
  const title = norm(section.querySelector('h2')?.textContent)
  if (title.includes('planilha tecnica perfis')) return { tipo: 'perfil', row }
  if (title.includes('planilha tecnica acessorios')) return { tipo: 'acessorio', row }
  return null
}

export default function ModeloMateriaisPicker() {
  const [produtos, setProdutos] = useState<ProdutoComImagem[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [target, setTarget] = useState<Target | null>(null)
  const [busca, setBusca] = useState('')
  const [linhaId, setLinhaId] = useState('')
  const bypass = useRef(false)

  useEffect(() => {
    void (async () => {
      const [{ data: ps }, { data: imgs }, { data: ls }] = await Promise.all([
        supabase.from('produtos').select('*').eq('ativo', true).in('categoria', ['perfil', 'acessorio']).order('categoria').order('nome'),
        supabase.from('produto_imagens').select('produto_id,url,principal,status_validacao,ativo').eq('ativo', true).neq('status_validacao', 'rejeitada'),
        supabase.from('linhas_tecnicas').select('id,nome,linha_produtos(produto_id)').order('nome'),
      ])
      const imgMap = new Map<string, string>()
      for (const img of (imgs || []) as any[]) {
        if (!imgMap.has(img.produto_id) || img.principal) imgMap.set(img.produto_id, img.url)
      }
      setProdutos(((ps || []) as Produto[]).map(p => ({ ...p, imagem_tecnica_url: imgMap.get(p.id) || p.foto_url || null })))
      const lista = ((ls || []) as any[]).map(l => ({ id: l.id, nome: l.nome, produto_ids: (l.linha_produtos || []).map((x: any) => x.produto_id) }))
      setLinhas(lista)

      // Só pré-seleciona Suprema quando existir uma linha canônica/exata.
      // Evita prender a busca em variantes como "L. Suprema Sem Baguete".
      const supremaExata = lista.find(l => ['suprema', 'l suprema', 'linha suprema'].includes(norm(l.nome)))
      setLinhaId(supremaExata?.id || '')
    })()
  }, [])

  const resultadosGlobais = useMemo(() => {
    if (!target) return []
    const q = norm(busca)
    const qCompacto = compacto(busca)
    const termos = q.split(' ').filter(Boolean)

    return produtos.filter(p => {
      if (p.categoria !== target.tipo) return false
      if (!q) return true

      const codigo = compacto(p.codigo)
      const texto = norm(`${p.codigo || ''} ${p.nome || ''} ${p.descricao || ''} ${p.grupo || ''}`)
      const porCodigo = Boolean(qCompacto) && codigo.includes(qCompacto)
      const porTexto = termos.every(t => texto.includes(t))
      return porCodigo || porTexto
    }).slice(0, 160)
  }, [produtos, target, busca])

  const disponiveis = useMemo(() => {
    const linha = linhas.find(l => l.id === linhaId)
    if (!linha) return resultadosGlobais.slice(0, 120)
    return resultadosGlobais.filter(p => linha.produto_ids.includes(p.id)).slice(0, 120)
  }, [resultadosGlobais, linhaId, linhas])

  const outrasLinhas = useMemo(() => {
    if (!linhaId || !busca.trim() || disponiveis.length > 0) return []
    const linha = linhas.find(l => l.id === linhaId)
    if (!linha) return []
    return resultadosGlobais.filter(p => !linha.produto_ids.includes(p.id)).slice(0, 30)
  }, [resultadosGlobais, linhaId, linhas, busca, disponiveis.length])

  function nomesLinhas(produtoId: string) {
    return linhas.filter(l => l.produto_ids.includes(produtoId)).map(l => l.nome).slice(0, 3)
  }

  function abrir(t: Target, inicial = '') {
    setTarget(t)
    setBusca(inicial)
  }

  function aplicar(produto: ProdutoComImagem) {
    if (!target) return
    const currentTarget = target
    if (currentTarget.mode === 'add' && currentTarget.sourceButton) {
      bypass.current = true
      currentTarget.sourceButton.click()
      bypass.current = false
      requestAnimationFrame(() => {
        const section = findSection(currentTarget.sourceButton ?? null)
        const rows = Array.from(section?.querySelectorAll('tbody tr') || []) as HTMLTableRowElement[]
        const row = rows.at(-1)
        if (row) aplicarNaLinha(row, produto)
      })
    } else if (currentTarget.row) {
      aplicarNaLinha(currentTarget.row, produto)
    }
    setTarget(null)
    setBusca('')
  }

  function aplicarNaLinha(row: HTMLTableRowElement, produto: ProdutoComImagem) {
    const inputs = Array.from(row.querySelectorAll('input')) as HTMLInputElement[]
    if (!inputs.length) return
    bypass.current = true
    setInputValue(inputs[0], produto.codigo || produto.nome || '')
    if (inputs[1]) setInputValue(inputs[1], produto.nome || produto.descricao || '')
    bypass.current = false
    row.dataset.produtoId = produto.id
    row.dataset.imagemUrl = produto.imagem_tecnica_url || ''
    requestAnimationFrame(() => decorar())
  }

  function imagemPorCodigo(codigo: string) {
    const c = compacto(codigo)
    return produtos.find(p => compacto(p.codigo) === c)?.imagem_tecnica_url || null
  }

  function decorar() {
    if (!location.pathname.startsWith('/engenharia/modelos')) return
    const sections = Array.from(document.querySelectorAll('section'))
    for (const section of sections) {
      const title = norm(section.querySelector('h2')?.textContent)
      const tipo: Tipo | null = title.includes('perfil') ? 'perfil' : title.includes('acessorio') ? 'acessorio' : null
      if (!tipo) continue
      const table = section.querySelector('table')
      if (!table) continue
      const head = table.querySelector('thead tr')
      if (head && !head.querySelector('[data-atlas-desenho-head]')) {
        const th = document.createElement('th')
        th.dataset.atlasDesenhoHead = '1'
        th.className = 'p-2 text-left'
        th.textContent = 'Desenho'
        head.insertBefore(th, head.children[1] || null)
      }
      const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[]
      rows.forEach(row => {
        const first = row.children[0] as HTMLElement | undefined
        if (!first) return
        const codigo = (first.querySelector('input') as HTMLInputElement | null)?.value || first.textContent || ''
        let cell = row.querySelector('[data-atlas-desenho-cell]') as HTMLTableCellElement | null
        if (!cell) {
          cell = document.createElement('td')
          cell.dataset.atlasDesenhoCell = '1'
          cell.className = 'p-1 align-middle'
          row.insertBefore(cell, row.children[1] || null)
        }
        const url = row.dataset.imagemUrl || imagemPorCodigo(codigo)
        cell.innerHTML = ''
        if (url) {
          const img = document.createElement('img')
          img.src = url
          img.alt = `Desenho ${codigo}`
          img.className = 'h-12 w-16 rounded border bg-white object-contain p-1'
          cell.appendChild(img)
        } else {
          const span = document.createElement('span')
          span.className = 'text-[10px] font-semibold text-amber-600'
          span.textContent = 'Desenho pendente'
          cell.appendChild(span)
        }

        if (!row.querySelector('[data-atlas-substituir]')) {
          const actionCell = row.lastElementChild as HTMLElement | null
          if (actionCell) {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.dataset.atlasSubstituir = '1'
            btn.className = 'ml-2 rounded border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50'
            btn.textContent = 'Substituir'
            btn.addEventListener('click', e => {
              e.preventDefault(); e.stopPropagation()
              abrir({ tipo, mode: 'replace', row }, codigo)
            })
            actionCell.appendChild(btn)
          }
        }
      })
    }
  }

  useEffect(() => {
    if (!produtos.length) return

    const onClick = (ev: MouseEvent) => {
      const el = ev.target as HTMLElement | null
      if (!el || bypass.current || !location.pathname.startsWith('/engenharia/modelos')) return
      const button = el.closest('button') as HTMLButtonElement | null
      if (button) {
        const txt = norm(button.textContent)
        if (txt === 'adicionar perfil') {
          ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation()
          abrir({ tipo: 'perfil', mode: 'add', sourceButton: button })
          return
        }
        if (txt === 'adicionar' && norm(findSection(button)?.querySelector('h2')?.textContent).includes('acessorio')) {
          ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation()
          abrir({ tipo: 'acessorio', mode: 'add', sourceButton: button })
          return
        }
      }
      const input = el.closest('input') as HTMLInputElement | null
      if (input) {
        const alvo = targetDoCampo(input)
        if (alvo) abrir({ tipo: alvo.tipo, mode: 'replace', row: alvo.row }, input.value)
      }
    }

    const onInput = (ev: Event) => {
      const input = ev.target as HTMLInputElement | null
      if (!input || bypass.current || !location.pathname.startsWith('/engenharia/modelos')) return
      const alvo = targetDoCampo(input)
      if (!alvo) return

      setTarget(prev => {
        if (prev?.mode === 'replace' && prev.row === alvo.row && prev.tipo === alvo.tipo) return prev
        return { tipo: alvo.tipo, mode: 'replace', row: alvo.row }
      })
      setBusca(input.value)
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('input', onInput, true)
    const observer = new MutationObserver(() => requestAnimationFrame(decorar))
    observer.observe(document.body, { childList: true, subtree: true })
    decorar()
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('input', onInput, true)
      observer.disconnect()
    }
  }, [produtos, linhas])

  if (!target) return null

  const linhaAtual = linhas.find(l => l.id === linhaId)

  const cardProduto = (p: ProdutoComImagem, fora = false) => (
    <button key={p.id} onClick={() => aplicar(p)} className="flex min-h-[92px] items-center gap-3 rounded-xl border p-3 text-left hover:border-blue-300 hover:bg-blue-50">
      <div className="grid h-20 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
        {p.imagem_tecnica_url ? (
          <img src={p.imagem_tecnica_url} alt={p.codigo || p.nome} className="h-full w-full object-contain p-1" />
        ) : (
          <div className="grid place-items-center gap-1 text-center text-[9px] font-semibold text-amber-600"><ImageIcon size={24} className="text-slate-300" /><span>Desenho pendente</span></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-slate-900">{p.codigo || 'Sem código'}</div>
        <div className="text-sm text-slate-700">{p.nome || p.descricao}</div>
        {p.descricao && p.descricao !== p.nome && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.descricao}</div>}
        <div className="mt-1 text-[10px] text-slate-400">{nomesLinhas(p.id).join(' • ') || 'Sem linha vinculada'}</div>
        {fora && <div className="mt-1 text-[10px] font-semibold text-amber-600">Encontrado fora da linha selecionada</div>}
      </div>
    </button>
  )

  return <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 p-3" onMouseDown={e=>{if(e.currentTarget===e.target)setTarget(null)}}>
    <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b px-5 py-4">
        <div><div className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">{target.mode === 'add' ? 'Adicionar' : 'Substituir'} {target.tipo}</div><h2 className="mt-1 text-xl font-bold text-slate-900">Pesquisar no banco de dados</h2><p className="mt-1 text-xs text-slate-500">Digite código ou descrição. A lista abaixo mostra o desenho, código e descrição enquanto você filtra.</p></div>
        <button onClick={()=>setTarget(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button>
      </div>
      <div className="grid gap-3 border-b p-4 md:grid-cols-[240px_1fr]">
        <label className="text-xs font-semibold text-slate-600">Linha
          <select value={linhaId} onChange={e=>setLinhaId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"><option value="">Todas as linhas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Pesquisar código ou descrição
          <div className="mt-1 flex items-center rounded-xl border px-3"><Search size={16} className="text-slate-400"/><input autoFocus value={busca} onChange={e=>setBusca(e.target.value)} placeholder={target.tipo==='perfil'?'Ex.: SU00, marco, travessa...':'Ex.: RPCS1, fechadura, roldana...'} className="w-full px-2 py-2.5 text-sm outline-none"/></div>
        </label>
      </div>
      <div className="overflow-y-auto p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{disponiveis.length} resultado(s) {linhaAtual ? `em ${linhaAtual.nome}` : 'em todas as linhas'}</span>
          {busca.trim() && <span className="rounded-full bg-slate-100 px-2 py-1">Filtrando por: <strong className="text-slate-700">{busca}</strong></span>}
        </div>
        <div className="grid gap-2 md:grid-cols-2">{disponiveis.map(p => cardProduto(p))}</div>

        {!disponiveis.length && outrasLinhas.length > 0 && <div className="mt-2">
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Não encontrei esse item em <strong>{linhaAtual?.nome}</strong>, mas encontrei no banco de dados em outras linhas. Você pode escolher abaixo ou trocar para “Todas as linhas”.
          </div>
          <div className="grid gap-2 md:grid-cols-2">{outrasLinhas.map(p => cardProduto(p, true))}</div>
        </div>}

        {!disponiveis.length && !outrasLinhas.length && <div className="grid min-h-40 place-items-center text-center text-sm text-slate-500">
          <div><ImageIcon size={28} className="mx-auto mb-2 text-slate-300"/><div>Nenhum item encontrado com esses filtros.</div><div className="mt-1 text-xs">Tente parte do código, uma palavra da descrição ou selecione “Todas as linhas”.</div></div>
        </div>}
      </div>
      <div className="flex justify-between border-t bg-slate-50 px-4 py-3 text-xs text-slate-500"><span>Filtro atual: {linhaAtual?.nome || 'Todas as linhas'}</span><button onClick={()=>setLinhaId('')} className="font-semibold text-blue-700">Limpar filtro de linha</button></div>
    </div>
  </div>
}
