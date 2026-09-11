'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/lib/tipos'

type ProdutoComImagem = Produto & { imagem_tecnica_url?: string | null }

type LinhaImpressao = {
  codigo: string
  desenho?: string | null
  descricao: string
  detalhe1?: string
  detalhe2?: string
}

function norm(v: string | null | undefined) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function esc(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function acharSecao(titulo: string) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(el => norm(el.textContent) === norm(titulo))
  return h2?.closest('section,div.rounded-2xl') as HTMLElement | null
}

function textoCelula(cell: Element | undefined | null) {
  if (!cell) return ''
  const clone = cell.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button,img,[data-atlas-desenho-cell]').forEach(el => el.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() || ''
}

function abrirImpressao(titulo: string, headers: string[], linhas: LinhaImpressao[]) {
  const popup = window.open('', '_blank', 'width=1100,height=820')
  if (!popup) return
  const rows = linhas.map(l => {
    const desenho = l.desenho
      ? `<img src="${esc(l.desenho)}" alt="Desenho ${esc(l.codigo)}" style="width:92px;height:64px;object-fit:contain;display:block;margin:auto" />`
      : '<div class="pendente">DESENHO PENDENTE</div>'
    return `<tr><td class="desenho">${desenho}</td><td><b>${esc(l.codigo)}</b></td><td>${esc(l.descricao)}</td><td>${esc(l.detalhe1 || '')}</td><td>${esc(l.detalhe2 || '')}</td></tr>`
  }).join('')

  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#0f172a;margin:0}h1{font-size:20px;margin:0 0 4px}.sub{font-size:11px;color:#64748b;margin-bottom:14px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:middle}th{background:#f1f5f9;text-align:left}.desenho{width:110px;text-align:center}.pendente{font-size:9px;font-weight:700;color:#b45309;text-align:center;border:1px dashed #f59e0b;padding:8px}.rodape{margin-top:12px;font-size:9px;color:#64748b}@media print{button{display:none}}
  </style></head><body><h1>${esc(titulo)}</h1><div class="sub">Atlas One · Engenharia · código + desenho técnico obrigatório</div><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><div class="rodape">Itens sem imagem são marcados como DESENHO PENDENTE e devem ser regularizados no cadastro mestre.</div><script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script></body></html>`)
  popup.document.close()
}

export default function ModelosImpressaoComDesenhos() {
  const pathname = usePathname()
  const [produtos, setProdutos] = useState<ProdutoComImagem[]>([])

  useEffect(() => {
    if (pathname !== '/engenharia/modelos') return
    void (async () => {
      const [{ data: ps }, { data: imgs }] = await Promise.all([
        supabase.from('produtos').select('*').eq('ativo', true).in('categoria', ['perfil','acessorio']).order('nome'),
        supabase.from('produto_imagens').select('produto_id,url,principal,status_validacao,ativo').eq('ativo', true).neq('status_validacao', 'rejeitada').order('principal', { ascending: false }),
      ])
      const mapa = new Map<string,string>()
      for (const img of (imgs || []) as any[]) if (!mapa.has(img.produto_id) && img.url) mapa.set(img.produto_id, img.url)
      setProdutos(((ps || []) as Produto[]).map(p => ({ ...p, imagem_tecnica_url: mapa.get(p.id) || p.foto_url || null })))
    })()
  }, [pathname])

  const porCodigo = useMemo(() => {
    const m = new Map<string,ProdutoComImagem>()
    for (const p of produtos) if (p.codigo) m.set(norm(p.codigo).replace(/ /g,''), p)
    return m
  }, [produtos])

  useEffect(() => {
    if (pathname !== '/engenharia/modelos' || !produtos.length) return

    function produto(codigo: string) {
      return porCodigo.get(norm(codigo).replace(/ /g,''))
    }

    function linhasDaTabela(titulo: string, tipo: 'perfil'|'acessorio') {
      const secao = acharSecao(titulo)
      const rows = Array.from(secao?.querySelectorAll('tbody tr') || []) as HTMLTableRowElement[]
      return rows.map(row => {
        const cells = Array.from(row.children)
        const codigo = textoCelula(cells[0])
        const p = produto(codigo)
        const texts = cells.slice(1).map(textoCelula).filter(Boolean).filter(t => !norm(t).includes('substituir') && !norm(t).includes('sem desenho'))
        const descricao = p?.nome || p?.descricao || texts.find(t => !/^[-+]?\d+(?:[.,]\d+)?(?:\s*[a-z]{1,3})?$/i.test(t)) || ''
        const numericos = texts.filter(t => /^[-+]?\d+(?:[.,]\d+)?(?:\s*[a-z]{1,3})?$/i.test(t))
        return {
          codigo,
          desenho: p?.imagem_tecnica_url || null,
          descricao,
          detalhe1: tipo === 'perfil' ? (numericos[0] ? `${numericos[0]} mm` : '') : (numericos[0] || ''),
          detalhe2: numericos[1] || '',
        } satisfies LinhaImpressao
      }).filter(l => l.codigo)
    }

    const onClick = (ev: MouseEvent) => {
      const button = (ev.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null
      if (!button) return
      const txt = norm(button.textContent)
      if (!txt.startsWith('imprimir')) return

      if (txt === 'imprimir lista de perfis' || txt === 'imprimir plano de corte') {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation()
        const linhas = linhasDaTabela('Perfis calculados / Plano de corte', 'perfil')
        abrirImpressao(txt === 'imprimir plano de corte' ? 'Plano de corte — Porta 2F Suprema' : 'Lista de perfis — Porta 2F Suprema', ['Desenho','Código','Descrição','Corte','Qtd.'], linhas)
        return
      }

      if (txt === 'imprimir acessorios') {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation()
        const linhas = linhasDaTabela('Acessórios da simulação atual', 'acessorio')
        abrirImpressao('Lista de acessórios — Porta 2F Suprema', ['Desenho','Código','Descrição','Qtd.','UN'], linhas)
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname, produtos, porCodigo])

  return null
}
