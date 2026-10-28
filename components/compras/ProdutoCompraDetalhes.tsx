'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, ImageIcon, Loader2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Produto = {
  id: string
  nome: string
  codigo: string | null
  categoria: string | null
  foto_url: string | null
}

type Foto = { url: string; tipo: string }
type Catalogo = { url: string; pagina: number; codigo: string; titulo: string }

export default function ProdutoCompraDetalhes({ produto }: { produto: Produto | null }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [selecionada, setSelecionada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [imagemQuebrada, setImagemQuebrada] = useState(false)

  useEffect(() => {
    let ativo = true
    setFotos([])
    setCatalogo(null)
    setSelecionada(produto?.foto_url || '')
    setImagemQuebrada(false)
    if (!produto?.id) return
    const id = produto.id
    setCarregando(true)
    void (async () => {
      try {
        const token = await tokenAtual()
        if (!token) return
        const resposta = await fetch('/api/compras/produtos?produtoId=' + encodeURIComponent(id), {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        })
        if (!resposta.ok) return
        const dados = await resposta.json()
        if (ativo && Array.isArray(dados.imagens)) {
          const extras = dados.imagens.filter((imagem: Foto) => typeof imagem.url === 'string')
          setFotos(extras)
          setCatalogo(dados.catalogo && typeof dados.catalogo.url === 'string' ? dados.catalogo : null)
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    })().catch(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [produto?.id, produto?.foto_url])

  if (!produto) {
    return <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
      <ImageIcon size={30} className="text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">Imagem do material</p>
      <p className="text-xs text-slate-500">Selecione um perfil ou acessório na lista para ver o desenho e as fotografias ao lado.</p>
    </div>
  }

  const todas = [ ...(produto.foto_url ? [{ url: produto.foto_url, tipo: 'Imagem principal' }] : []), ...fotos ]
    .filter((item, indice, lista) => lista.findIndex(c => c.url === item.url) === indice)
  const principal = selecionada || todas[0]?.url || ''

  return <aside className="rounded-xl border border-blue-100 bg-blue-50/40 p-3" aria-label="Imagens do material selecionado">
    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Imagens do produto selecionado</p>
        <p className="text-sm font-bold text-slate-800">{produto.codigo || 'Sem código'}</p>
        <p className="break-words text-xs text-slate-600">{produto.nome}</p>
      </div>
      {carregando && <Loader2 size={16} className="animate-spin text-blue-600" aria-label="Carregando imagens" />}
    </div>
    <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:min-h-56">
      {principal && !imagemQuebrada
        ? <img src={principal} alt={'Imagem ampliada do material ' + (produto.codigo || produto.nome)}
            className="max-h-72 w-full object-contain"
            onError={() => setImagemQuebrada(true)} />
        : <div className="flex flex-col items-center gap-2 text-center text-amber-700">
            <ImageIcon size={30} />
            <p className="text-xs font-semibold">Imagem não cadastrada ou indisponível</p>
            <p className="text-[11px]">Use “Corrigir imagem” no material à esquerda para enviar a referência correta.</p>
          </div>}
    </div>
    {todas.length > 1 && <div className="mt-2 grid grid-cols-4 gap-2">
      {todas.slice(0, 12).map(item => <button type="button" key={item.url}
        onClick={() => { setSelecionada(item.url); setImagemQuebrada(false) }}
        aria-label={'Mostrar ' + item.tipo}
        className={'overflow-hidden rounded-lg border bg-white p-1 ' + (principal === item.url ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200')}>
        <img src={item.url} alt={item.tipo} className="h-14 w-full object-contain" />
      </button>)}
    </div>}
    {catalogo && <a href={catalogo.url + '#page=' + catalogo.pagina}
      target="_blank" rel="noopener noreferrer"
      className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
      <ExternalLink size={14} /> Ver {catalogo.codigo || produto.codigo} em {catalogo.titulo} · pág. {catalogo.pagina}
    </a>}
    <p className="mt-2 text-[11px] text-slate-500">Confira o desenho e o código antes de adicionar ao pedido. Imagens incorretas podem ser substituídas por usuários autorizados.</p>
  </aside>
}
