'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type ProdutoResumo = {
  codigo: string | null
  categoria: string
  custo: number | null
  margem_percentual: number | null
  preco: number | null
  peso_kg: number | null
  peso_kg_m: number | null
}

function norm(v: string | null | undefined) {
  return (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function compacto(v: string | null | undefined) {
  return norm(v).replace(/\s+/g, '')
}

function moeda(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function numero(v: number | null | undefined, casas = 3) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })
}

async function carregarTodosProdutos(): Promise<ProdutoResumo[]> {
  const todos: ProdutoResumo[] = []
  const pagina = 1000
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from('produtos')
      .select('codigo,categoria,custo,margem_percentual,preco,peso_kg,peso_kg_m')
      .eq('ativo', true)
      .in('categoria', ['perfil', 'acessorio'])
      .range(inicio, inicio + pagina - 1)
    if (error || !data?.length) break
    todos.push(...(data as ProdutoResumo[]))
    if (data.length < pagina) break
  }
  return todos
}

export default function ModeloLayoutTecnico() {
  const produtosRef = useRef<Map<string, ProdutoResumo>>(new Map())

  useEffect(() => {
    let ativo = true

    void carregarTodosProdutos().then(lista => {
      if (!ativo) return
      produtosRef.current = new Map(lista.filter(p => p.codigo).map(p => [compacto(p.codigo), p]))
      decorar()
    })

    function cardDoTitulo(h2: Element) {
      return h2.closest('div.rounded-2xl, section') as HTMLElement | null
    }

    function ampliar(card: HTMLElement) {
      card.style.gridColumn = '1 / -1'
      card.style.width = '100%'
      const pai = card.parentElement
      if (pai) {
        pai.style.gridTemplateColumns = 'minmax(0, 1fr)'
        pai.style.width = '100%'
      }
    }

    function garantirColuna(head: HTMLTableRowElement, chave: string, texto: string) {
      if (head.querySelector(`[data-atlas-coluna="${chave}"]`)) return
      const th = document.createElement('th')
      th.dataset.atlasColuna = chave
      th.className = 'p-2 text-left whitespace-nowrap'
      th.textContent = texto
      const ultima = head.lastElementChild
      if (ultima) head.insertBefore(th, ultima)
      else head.appendChild(th)
    }

    function celula(row: HTMLTableRowElement, chave: string) {
      let td = row.querySelector(`[data-atlas-coluna="${chave}"]`) as HTMLTableCellElement | null
      if (td) return td
      td = document.createElement('td')
      td.dataset.atlasColuna = chave
      td.className = 'p-2 text-xs text-slate-700 whitespace-nowrap align-middle'
      const ultima = row.lastElementChild
      if (ultima) row.insertBefore(td, ultima)
      else row.appendChild(td)
      return td
    }

    function decorarTabela(card: HTMLElement, tipo: 'perfil' | 'acessorio') {
      const table = card.querySelector('table')
      const head = table?.querySelector('thead tr') as HTMLTableRowElement | null
      if (!table || !head) return

      if (tipo === 'perfil') {
        garantirColuna(head, 'kgm', 'kg/m')
      } else {
        garantirColuna(head, 'custo', 'Custo')
        garantirColuna(head, 'margem', 'Margem balcão')
        garantirColuna(head, 'venda', 'Venda balcão')
      }

      const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[]
      for (const row of rows) {
        const primeiroInput = row.querySelector('input') as HTMLInputElement | null
        const codigo = primeiroInput?.value || row.firstElementChild?.textContent || ''
        const produto = produtosRef.current.get(compacto(codigo))

        if (tipo === 'perfil') {
          const peso = produto?.peso_kg_m ?? produto?.peso_kg ?? null
          celula(row, 'kgm').textContent = peso == null ? 'kg/m pendente' : `${numero(peso, 4)} kg/m`
        } else {
          celula(row, 'custo').textContent = moeda(produto?.custo)
          celula(row, 'margem').textContent = produto?.margem_percentual == null ? '—' : `${numero(produto.margem_percentual, 2)}%`
          celula(row, 'venda').textContent = produto?.preco == null ? '—' : moeda(produto.preco)
        }
      }
    }

    function decorar() {
      if (!location.pathname.startsWith('/engenharia/modelos')) return

      const titulos = Array.from(document.querySelectorAll('h2'))
      for (const h2 of titulos) {
        const titulo = norm(h2.textContent)
        const card = cardDoTitulo(h2)
        if (!card) continue

        if (titulo.includes('perfis calculados plano de corte')) {
          card.style.display = 'none'
          continue
        }

        if (titulo.includes('acessorios da simulacao atual')) {
          card.style.display = 'none'
          continue
        }

        if (titulo.includes('planilha tecnica perfis')) {
          ampliar(card)
          decorarTabela(card, 'perfil')
        }

        if (titulo.includes('planilha tecnica acessorios')) {
          ampliar(card)
          decorarTabela(card, 'acessorio')
        }
      }
    }

    const observer = new MutationObserver(() => requestAnimationFrame(decorar))
    observer.observe(document.body, { childList: true, subtree: true })
    decorar()

    return () => {
      ativo = false
      observer.disconnect()
    }
  }, [])

  return null
}
