'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, BriefcaseBusiness, ClipboardCheck, FileText, PackageOpen, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { formatarMoeda } from '@/lib/formatacao'

type Indicadores = {
  orcamentosAbertos: number
  medicoesPendentes: number
  itensProducao: number
  tarefasAtrasadas: number
  vendasMes: number
  orcamentosMes: number
  aprovadosMes: number
}

const inicial: Indicadores = { orcamentosAbertos: 0, medicoesPendentes: 0, itensProducao: 0, tarefasAtrasadas: 0, vendasMes: 0, orcamentosMes: 0, aprovadosMes: 0 }

export default function HomeManagementOverview() {
  const [dados, setDados] = useState<Indicadores>(inicial)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const usuario = await usuarioAtual()
      const inicioMes = new Date()
      inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
      const [orcamentos, orcamentosMes, medicoes, producao, tarefas] = await Promise.all([
        supabase.from('orcamentos').select('id', { count: 'exact', head: true }).in('status', ['rascunho', 'enviado']),
        supabase.from('orcamentos').select('status,valor_estimado').gte('created_at', inicioMes.toISOString()),
        supabase.from('medicoes_finais').select('status_operacional'),
        supabase.from('producao_itens').select('id', { count: 'exact', head: true }),
        usuario?.id ? supabase.from('tarefas').select('id,data_hora').eq('usuario_id', usuario.id).is('concluida_em', null) : Promise.resolve({ data: [] as { id:string; data_hora:string|null }[] }),
      ])
      if (!ativo) return
      const listaMes = orcamentosMes.data || []
      const aprovados = listaMes.filter(o => o.status === 'aprovado' || o.status === 'convertido')
      setDados({
        orcamentosAbertos: orcamentos.count || 0,
        medicoesPendentes: (medicoes.data || []).filter(m => m.status_operacional !== 'aprovado').length,
        itensProducao: producao.count || 0,
        tarefasAtrasadas: (tarefas.data || []).filter(t => t.data_hora && new Date(t.data_hora).getTime() < Date.now()).length,
        vendasMes: aprovados.reduce((s,o) => s + Number(o.valor_estimado || 0), 0),
        orcamentosMes: listaMes.length,
        aprovadosMes: aprovados.length,
      })
      setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  const conversao = useMemo(() => dados.orcamentosMes ? Math.round((dados.aprovadosMes / dados.orcamentosMes) * 100) : 0, [dados])

  const cards = [
    { label:'Vendas no mês', valor: formatarMoeda(dados.vendasMes), detalhe:'orçamentos aprovados/convertidos', href:'/orcamento/pesquisar', icon:TrendingUp, classe:'text-emerald-700 bg-emerald-50' },
    { label:'Orçamentos em aberto', valor:String(dados.orcamentosAbertos), detalhe:'rascunho ou enviado', href:'/kanban', icon:FileText, classe:'text-blue-700 bg-blue-50' },
    { label:'Conversão no mês', valor:`${conversao}%`, detalhe:`${dados.aprovadosMes} de ${dados.orcamentosMes} orçamentos`, href:'/orcamento/pesquisar', icon:BriefcaseBusiness, classe:'text-violet-700 bg-violet-50' },
    { label:'Pendências críticas', valor:String(dados.tarefasAtrasadas + dados.medicoesPendentes), detalhe:'tarefas atrasadas + medições', href:'/tarefas', icon:AlertTriangle, classe:'text-red-700 bg-red-50' },
  ]

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 pt-4 md:px-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-xl">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 text-white md:flex-row md:items-end md:justify-between md:px-7">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Visão executiva</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Esquadrifácio em tempo real</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Comercial, operação e prioridades em uma única leitura para tomada de decisão.</p></div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">Atualização automática</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4 md:gap-3 md:p-5">
          {cards.map(card => { const Icon=card.icon; return <Link key={card.label} href={card.href} className="group rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:p-5"><div className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.classe}`}><Icon size={18}/></span><ArrowUpRight size={15} className="text-slate-300 group-hover:text-slate-700"/></div><p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-950 md:text-2xl">{carregando?'—':card.valor}</p><p className="mt-1 hidden text-[11px] text-slate-500 sm:block">{carregando?'Carregando...':card.detalhe}</p></Link> })}
        </div>
        <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 md:px-5 md:pb-5">
          <Link href="/producao/medicao-final" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-white"><ClipboardCheck size={18} className="text-blue-300"/><p className="mt-3 text-xs text-slate-400">Medições pendentes</p><strong className="mt-1 block text-2xl">{carregando?'—':dados.medicoesPendentes}</strong></Link>
          <Link href="/producao" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-white"><PackageOpen size={18} className="text-amber-300"/><p className="mt-3 text-xs text-slate-400">Itens na produção</p><strong className="mt-1 block text-2xl">{carregando?'—':dados.itensProducao}</strong></Link>
          <Link href="/tarefas" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-white"><AlertTriangle size={18} className="text-red-300"/><p className="mt-3 text-xs text-slate-400">Tarefas atrasadas</p><strong className="mt-1 block text-2xl">{carregando?'—':dados.tarefasAtrasadas}</strong></Link>
        </div>
      </div>
    </section>
  )
}
