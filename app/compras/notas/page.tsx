'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Loader2, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type NF = {
  id: string
  origem_entrada: string
  status: string
  numero: string | null
  serie: string | null
  data_emissao: string | null
  data_entrada: string
  fornecedor_nome: string | null
  fornecedor_cnpj: string | null
  valor_total: number | null
  arquivo_nome: string | null
  criado_por_nome: string | null
  itens: { total: number; pendentes: number; custosAplicados: number }
}

function moeda(valor: number | null) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR')
}

export default function HistoricoNfsPage() {
  const [nfs, setNfs] = useState<NF[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const resp = await fetch('/api/compras/nfs?limit=200', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Erro ao carregar histórico.')
      setNfs(json.nfs || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
    } finally {
      setCarregando(false)
    }
  }

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return nfs
    return nfs.filter(nf => `${nf.numero || ''} ${nf.serie || ''} ${nf.fornecedor_nome || ''} ${nf.fornecedor_cnpj || ''} ${nf.arquivo_nome || ''}`.toLowerCase().includes(t))
  }, [nfs, busca])

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/compras" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Compras</Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Histórico de NFs de compra</h1>
            <p className="mt-1 text-sm text-slate-600">Consulte notas confirmadas, itens, vínculos e o arquivo original.</p>
          </div>
          <Link href="/compras/entrada" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">+ Nova entrada</Link>
        </header>

        <div className="relative max-w-lg">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar NF, fornecedor, CNPJ ou arquivo..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-400" />
        </div>

        {erro ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div> : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {carregando ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando...</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">NF</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Itens</th><th className="px-4 py-3">Pendentes</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtradas.map(nf => <tr key={nf.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold text-slate-800">{nf.numero || 'Sem número'}{nf.serie ? <span className="ml-1 text-xs font-normal text-slate-400">S. {nf.serie}</span> : null}</td><td className="px-4 py-3 text-slate-700">{nf.fornecedor_nome || '—'}</td><td className="px-4 py-3 text-slate-600">{dataBR(nf.data_emissao)}</td><td className="px-4 py-3">{nf.itens.total}</td><td className={`px-4 py-3 font-semibold ${nf.itens.pendentes ? 'text-amber-700' : 'text-emerald-700'}`}>{nf.itens.pendentes}</td><td className="px-4 py-3 font-medium">{moeda(nf.valor_total)}</td><td className="px-4 py-3 uppercase text-slate-500">{nf.origem_entrada}</td><td className="px-4 py-3 text-right"><Link href={`/compras/notas/${nf.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"><FileText size={15} /> Abrir</Link></td></tr>)}
                  {!filtradas.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhuma nota encontrada.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
