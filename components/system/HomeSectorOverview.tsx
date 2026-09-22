'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2, CircleDollarSign, ClipboardCheck, Cog, Factory, Hammer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DashboardId } from '@/lib/homeUsuario'

type Props = { dashboard: DashboardId }
type Dados = { obras: number; medicoes: number; producao: number; receber: number; vencido: number; contasAbertas: number }

export default function HomeSectorOverview({ dashboard }: Props) {
  const [dados, setDados] = useState<Dados>({ obras: 0, medicoes: 0, producao: 0, receber: 0, vencido: 0, contasAbertas: 0 })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([
      supabase.from('obras').select('id,status'),
      supabase.from('medicoes_finais').select('id,status_operacional'),
      supabase.from('producao_itens').select('id', { count: 'exact', head: true }),
      supabase.from('financeiro_contas_receber').select('valor,valor_pago,status,vencimento'),
    ]).then(([obras, medicoes, producao, contas]) => {
      if (!ativo) return
      const statusObra = dashboard === 'engenharia' ? 'engenharia' : dashboard === 'producao' ? 'producao' : dashboard === 'instalacao' ? 'instalacao' : ''
      const abertas = (contas.data || []).filter(c => !['cancelado','pago'].includes(c.status || ''))
      const receber = abertas.reduce((s,c) => s + Math.max(0, Number(c.valor || 0) - Number(c.valor_pago || 0)), 0)
      const hoje = new Date().toISOString().slice(0,10)
      const vencidas = abertas.filter(c => c.status === 'vencido' || (!!c.vencimento && c.vencimento < hoje))
      const vencido = vencidas.reduce((s,c) => s + Math.max(0, Number(c.valor || 0) - Number(c.valor_pago || 0)), 0)
      setDados({
        obras: statusObra ? (obras.data || []).filter(o => o.status === statusObra).length : (obras.data || []).length,
        medicoes: (medicoes.data || []).filter(m => m.status_operacional !== 'aprovado').length,
        producao: producao.count || 0,
        receber,
        vencido,
        contasAbertas: abertas.length,
      })
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [dashboard])

  const moeda = (v:number) => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  const base = dashboard === 'engenharia'
    ? [
        { label:'Obras na engenharia', value:dados.obras, href:'/obras?status=engenharia', icon:Cog },
        { label:'Medições pendentes', value:dados.medicoes, href:'/producao/medicao-final', icon:ClipboardCheck },
      ]
    : dashboard === 'producao'
      ? [
          { label:'Obras em produção', value:dados.obras, href:'/obras?status=producao', icon:Factory },
          { label:'Itens no quadro', value:dados.producao, href:'/producao', icon:Building2 },
        ]
      : dashboard === 'instalacao'
        ? [
            { label:'Obras em instalação', value:dados.obras, href:'/obras?status=instalacao', icon:Hammer },
            { label:'Medições pendentes', value:dados.medicoes, href:'/producao/medicao-final', icon:ClipboardCheck },
          ]
        : [
            { label:'A receber', value:moeda(dados.receber), href:'/obras', icon:CircleDollarSign },
            { label:'Vencido', value:moeda(dados.vencido), href:'/obras', icon:CircleDollarSign },
            { label:'Contas em aberto', value:dados.contasAbertas, href:'/obras', icon:Building2 },
            { label:'Obras acompanhadas', value:dados.obras, href:'/obras', icon:Building2 },
          ]

  return <section className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6"><div className="grid gap-3 sm:grid-cols-2">{base.map(card => { const Icon=card.icon; return <Link key={card.label} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"><div className="flex items-center justify-between"><span className="rounded-xl bg-slate-100 p-2 text-slate-700"><Icon size={18}/></span><ArrowUpRight size={15} className="text-slate-300"/></div><p className="mt-3 text-xs font-medium text-slate-500">{card.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{carregando ? '—' : card.value}</p></Link>})}</div></section>
}
