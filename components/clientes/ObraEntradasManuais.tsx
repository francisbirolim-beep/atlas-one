'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ImageOff, PackageCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Entrada = { id: string; fornecedor_nome: string; numero_romaneio: string; data_documento: string; criado_por_nome: string }
type Item = { id: string; entrada_id: string; descricao: string; quantidade: number; unidade?: string | null; produto?: { foto_url?: string | null; codigo?: string | null } | null }
export default function ObraEntradasManuais({ obraId, clienteId }: { obraId: string; clienteId: string }) {
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [mensagem, setMensagem] = useState('')
  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const token = await tokenAtual()
        if (!token) return
        const res = await fetch('/api/compras/entrada-manual?' + new URLSearchParams({ tipo: 'historico', obraId }), {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        })
        if (res.status === 403) { if (ativo) setMensagem('Consultar materiais recebidos exige liberação de Compras/Recebimento.'); return }
        if (!res.ok) throw new Error('Histórico indisponível')
        const dados = await res.json()
        if (ativo) { setEntradas(dados.entradas || []); setItens(dados.itens || []); setMensagem('') }
      } catch { if (ativo) setMensagem('Não foi possível consultar o histórico de romaneios.') }
    }
    void carregar()
    return () => { ativo = false }
  }, [obraId])
  return <section className="mt-5 rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><h2 className="inline-flex items-center gap-2 font-semibold"><PackageCheck size={19}/>Mercadorias recebidas por romaneio</h2>
      <Link href={`/compras/entrada-manual?cliente=${clienteId}&obra=${obraId}`} className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700">Nova entrada manual</Link>
    </div>
    <div className="space-y-3 p-5">
      {mensagem && <p className="text-xs text-slate-500">{mensagem}</p>}
      {!mensagem && entradas.length === 0 && <p className="text-sm text-slate-500">Nenhum romaneio recebido nesta obra.</p>}
      {entradas.map(e => <div key={e.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Romaneio {e.numero_romaneio} · {e.fornecedor_nome}</strong>
          <span className="text-xs text-slate-500">{new Date(e.data_documento + 'T12:00:00').toLocaleDateString('pt-BR')} · {e.criado_por_nome}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{itens.filter(i => i.entrada_id === e.id).map(i => <div key={i.id} className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2">
          {i.produto?.foto_url ? <img src={i.produto.foto_url} alt={i.descricao} loading="lazy" className="h-12 w-12 rounded-md border bg-white object-contain"/> : <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed text-slate-400" title="Imagem do produto não cadastrada"><ImageOff size={19}/></div>}
          <div><div className="text-xs font-medium">{i.descricao}</div><div className="text-xs text-slate-500">{Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade || 'UN'}</div></div>
        </div>)}</div>
      </div>)}
      {!mensagem && entradas.length === 0 && <Link href={`/compras/entrada-manual?cliente=${clienteId}&obra=${obraId}`} className="inline-flex items-center gap-2 text-xs font-medium text-blue-700"><ClipboardList size={14}/>Lançar primeiro romaneio</Link>}
    </div>
  </section>
}
