'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileClock, Link2, Loader2, PackageCheck, PlusCircle, ReceiptText } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Resumo = { totalNfs: number; totalItens: number; totalPendentes: number }

export default function ComprasPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const token = await tokenAtual()
      if (!token) return
      const resp = await fetch('/api/compras/nfs?limit=20', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Erro ao carregar Compras.')
      setResumo(json.resumo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar Compras.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Operações • Compras</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Central de Compras</h1>
          <p className="mt-1 text-sm text-slate-600">Entrada de notas, conferência física do recebimento, histórico e resolução de itens ainda não vinculados ao catálogo.</p>
        </header>

        {erro ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div> : null}

        <section className="grid gap-3 sm:grid-cols-3">
          <ResumoCard label="Notas registradas" valor={resumo?.totalNfs} icon={<ReceiptText size={20} />} />
          <ResumoCard label="Itens nas notas" valor={resumo?.totalItens} icon={<FileClock size={20} />} />
          <ResumoCard label="Pendentes de vínculo" valor={resumo?.totalPendentes} destaque={Boolean(resumo?.totalPendentes)} icon={<AlertTriangle size={20} />} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Acao href="/compras/entrada" icon={<PlusCircle size={28} />} titulo="Nova entrada de NF" descricao="Importar XML, enviar PDF/DANFE ou lançar manualmente." />
          <Acao href="/compras/notas" icon={<PackageCheck size={28} />} titulo="Conferir recebimento" descricao="Abra uma NF e compare quantidade da nota com o material que realmente chegou." />
          <Acao href="/compras/notas" icon={<FileClock size={28} />} titulo="Histórico de NFs" descricao="Consultar notas confirmadas, itens e arquivo original." />
          <Acao href="/compras/vinculos" icon={<Link2 size={28} />} titulo="Itens pendentes" descricao="Vincular códigos do fornecedor aos produtos corretos do Atlas." destaque={Boolean(resumo?.totalPendentes)} />
        </section>

        {!resumo && !erro ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando Compras...</div> : null}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Regra atual:</strong> entrada da NF, vínculo de produto e conferência física são auditáveis, mas não movimentam estoque automaticamente. A movimentação só será liberada depois da validação das unidades operacionais e fatores de embalagem.
        </div>
      </div>
    </main>
  )
}

function ResumoCard({ label, valor, icon, destaque = false }: { label: string; valor?: number; icon: React.ReactNode; destaque?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${destaque ? 'border-amber-300' : 'border-slate-200'}`}>
    <div className="flex items-center justify-between text-slate-500"><span className="text-sm font-medium">{label}</span>{icon}</div>
    <div className="mt-2 text-3xl font-bold text-slate-900">{valor ?? '—'}</div>
  </div>
}

function Acao({ href, icon, titulo, descricao, destaque = false }: { href: string; icon: React.ReactNode; titulo: string; descricao: string; destaque?: boolean }) {
  return <Link href={href} className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${destaque ? 'border-amber-300' : 'border-slate-200'}`}>
    <div className="text-slate-700">{icon}</div>
    <h2 className="mt-4 font-bold text-slate-900">{titulo}</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">{descricao}</p>
  </Link>
}
