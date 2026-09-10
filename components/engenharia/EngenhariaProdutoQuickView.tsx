'use client'

import { useEffect, useMemo, useState } from 'react'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import type { Produto } from '@/lib/tipos'
import ProdutoTecnicoDrawer from './ProdutoTecnicoDrawer'

const CODIGO_RE = /\b(?:SU\d{3}|CM\d{3}|MP\d{3}|TMC|CHU\d+|CON\d+|FIT\d+|FRA\d+|GUA\d+|NYL-?\d+|PAR\d+|RPCS\d+|SIL-PU|BUC\d+)\b/i

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export default function EngenhariaProdutoQuickView() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aberto, setAberto] = useState<Produto | null>(null)

  useEffect(() => {
    void listarProdutosTecnicos().then(setProdutos)
  }, [])

  const porCodigo = useMemo(() => {
    const mapa = new Map<string, Produto>()
    for (const p of produtos) if (p.codigo) mapa.set(String(p.codigo).toUpperCase(), p)
    return mapa
  }, [produtos])

  useEffect(() => {
    function clicar(ev: MouseEvent) {
      const alvo = ev.target as HTMLElement | null
      if (!alvo) return
      if (alvo.closest('button,a,input,select,textarea,[data-no-produto-quickview]')) return
      const bloco = alvo.closest('td,div,span') as HTMLElement | null
      if (!bloco) return
      const texto = (bloco.textContent || '').trim()
      const codigo = texto.match(CODIGO_RE)?.[0]?.toUpperCase()
      if (codigo) {
        const produto = porCodigo.get(codigo)
        if (produto) {
          ev.preventDefault()
          setAberto(produto)
          return
        }
      }
      const nt = normalizar(texto)
      if (nt.includes('incolor 06mm') || nt.includes('incolor 6mm')) {
        const vidro = produtos.find(p => p.categoria === 'vidro' && normalizar(p.nome || '').includes('incolor') && normalizar(p.nome || '').includes('06'))
        if (vidro) setAberto(vidro)
      }
    }
    document.addEventListener('click', clicar)
    return () => document.removeEventListener('click', clicar)
  }, [porCodigo, produtos])

  return <ProdutoTecnicoDrawer produto={aberto} onClose={()=>setAberto(null)} onSaved={produto=>{
    setProdutos(prev=>prev.map(p=>p.id===produto.id?produto:p))
    setAberto(produto)
  }}/>
}
