'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText, Loader2, PackageCheck } from 'lucide-react'
import { useParams } from 'next/navigation'
import { tokenAtual } from '@/lib/auth'

type Item = {
  id: string
  codigo_fornecedor: string | null
  descricao: string
  ncm: string | null
  cfop: string | null
  unidade: string | null
  quantidade: number
  valor_unitario: number | null
  valor_total: number | null
  custo_unitario: number | null
  vinculo_status: string
  custo_anterior: number | null
  custo_aplicado: boolean
  produto: { id: string; codigo: string | null; nome: string; unidade: string | null; custo: number | null } | null
}

type Dados = {
  nf: Record<string, any>
  itens: Item[]
  arquivoUrl: string | null
}

function moeda(valor: number | null | undefined) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString('pt-BR')
}

export default function DetalheNotaPage() {
  const params = useParams<{ id: string }>()
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [params.id])

  async function carregar() {
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const resp = await fetch(`/api/compras/nfs/${params.id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Erro ao carregar a nota.')
      setDados(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a nota.')
    }
  }

  if (erro) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{erro}</div></main>
  if (!dados) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando nota...</div></main>

  const { nf, itens, arquivoUrl } = dados
  const pendentes = itens.filter(item => item.vinculo_status !== 'vinculado').length

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/compras/notas" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Histórico</Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">NF {nf.numero || 'sem número'} {nf.serie ? `• Série ${nf.serie}` : ''}</h1>
            <p className="mt-1 text-sm text-slate-600">{nf.fornecedor_nome || 'Fornecedor não informado'} {nf.fornecedor_cnpj ? `• ${nf.fornecedor_cnpj}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/compras/recebimentos/${nf.id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><PackageCheck size={16} /> Conferir recebimento</Link>
            {arquivoUrl ? <a href={arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ExternalLink size={16} /> Abrir arquivo original</a> : null}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Emissão" valor={dataBR(nf.data_emissao)} />
          <Card label="Entrada" valor={dataBR(nf.data_entrada)} />
          <Card label="Origem" valor={String(nf.origem_entrada || '—').toUpperCase()} />
          <Card label="Total" valor={moeda(nf.valor_total)} />
          <Card label="Pendentes" valor={String(pendentes)} destaque={pendentes > 0} />
        </section>

        {nf.chave_acesso ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><span className="font-semibold text-slate-700">Chave de acesso:</span> <span className="break-all text-slate-600">{nf.chave_acesso}</span></div> : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Itens da nota</h2></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Un.</th><th className="px-4 py-3">Qtd.</th><th className="px-4 py-3">Unitário</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Produto Atlas</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{itens.map(item => <tr key={item.id}><td className="px-4 py-3 font-mono text-xs text-slate-700">{item.codigo_fornecedor || '—'}</td><td className="px-4 py-3 text-slate-800">{item.descricao}</td><td className="px-4 py-3">{item.unidade || '—'}</td><td className="px-4 py-3">{item.quantidade}</td><td className="px-4 py-3">{moeda(item.valor_unitario)}</td><td className="px-4 py-3 font-medium">{moeda(item.valor_total)}</td><td className="px-4 py-3">{item.produto ? `${item.produto.codigo || ''} — ${item.produto.nome}` : '—'}</td><td className={`px-4 py-3 font-semibold ${item.vinculo_status === 'vinculado' ? 'text-emerald-700' : 'text-amber-700'}`}>{item.vinculo_status}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href={`/compras/recebimentos/${nf.id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><PackageCheck size={16} /> Conferir mercadoria recebida</Link>
          {pendentes > 0 ? <Link href="/compras/vinculos" className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white"><FileText size={16} /> Resolver itens pendentes</Link> : null}
        </div>
      </div>
    </main>
  )
}

function Card({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-4 shadow-sm ${destaque ? 'border-amber-300' : 'border-slate-200'}`}><div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 font-semibold ${destaque ? 'text-amber-800' : 'text-slate-800'}`}>{valor}</div></div>
}
