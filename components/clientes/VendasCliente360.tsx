'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, CheckCircle2, ChevronRight, CircleDollarSign, FileText, Loader2, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {tokenAtual,usuarioAtual} from '@/lib/auth'

type VendaObra = {
  id: string
  numero?: number | null
  orcamento_id: string
  cliente_id: string
  obra_id?: string | null
  valor_venda?: number | null
  custo_previsto?: number | null
  status?: string | null
  confirmado_em?: string | null
  created_at?: string | null
}

type OrcamentoVenda = {
  id: string
  numero?: number | null
  status?: string | null
  valor_estimado?: number | null
  wvetro_fluxo?: { numero?: string | null; origem?: string | null } | null
}

type ObraVenda = {
  id: string
  numero?: number | null
  nome: string
  status?: string | null
}

type ContaVenda = {
  id: string
  venda_obra_id?: string | null
  valor?: number | null
  valor_pago?: number | null
  valor_desconto?: number | null
  status?: string | null
}

interface Props { clienteId: string; verFinanceiro?: boolean }

function moeda(v?: number | null){
  return Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function dataBR(v?: string | null){
  if(!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
function status(v?: string | null){
  return v ? v.replace(/_/g,' ').replace(/^./,s=>s.toUpperCase()) : 'Em andamento'
}
function numeroOrcamento(o?: OrcamentoVenda){
  return o?.wvetro_fluxo?.numero || o?.numero || '—'
}

export default function VendasCliente360({clienteId,verFinanceiro=true}:Props){
  const [vendas,setVendas]=useState<VendaObra[]>([])
  const [orcamentos,setOrcamentos]=useState<Record<string,OrcamentoVenda>>({})
  const [obras,setObras]=useState<Record<string,ObraVenda>>({})
  const [contas,setContas]=useState<ContaVenda[]>([])
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [podeExcluir,setPodeExcluir]=useState(false)
  const [vendaParaExcluir,setVendaParaExcluir]=useState<VendaObra|null>(null)
  const [motivoExclusao,setMotivoExclusao]=useState('Venda lançada incorretamente; será sincronizada a venda correta.')
  const [confirmacao,setConfirmacao]=useState('')
  const [excluindo,setExcluindo]=useState(false)
  const [sucesso,setSucesso]=useState('')

  useEffect(()=>{ void carregar() },[clienteId,verFinanceiro])
  useEffect(()=>{let ativo=true;void usuarioAtual().then(u=>{if(ativo)setPodeExcluir(u?.role==='master')});return()=>{ativo=false}},[])

  async function carregar(){
    setCarregando(true); setErro('')
    const vendasResp = await supabase
      .from('vendas_obras')
      .select('id,numero,orcamento_id,cliente_id,obra_id,valor_venda,status,confirmado_em,created_at')
      .eq('cliente_id',clienteId)
      .is('excluida_em',null)
      .neq('status','cancelada')
      .order('confirmado_em',{ascending:false})

    if(vendasResp.error){ setErro(vendasResp.error.message); setCarregando(false); return }
    const lista=(vendasResp.data||[]) as VendaObra[]
    setVendas(lista)

    const orcIds=[...new Set(lista.map(v=>v.orcamento_id).filter(Boolean))]
    const obraIds=[...new Set(lista.map(v=>v.obra_id).filter(Boolean))] as string[]
    const vendaIds=lista.map(v=>v.id)

    const [orcResp,obraResp,contasResp]=await Promise.all([
      orcIds.length
        ? supabase.from('orcamentos').select('id,numero,status,valor_estimado,wvetro_fluxo').in('id',orcIds)
        : Promise.resolve({data:[],error:null} as any),
      obraIds.length
        ? supabase.from('obras').select('id,numero,nome,status').in('id',obraIds)
        : Promise.resolve({data:[],error:null} as any),
      verFinanceiro&&vendaIds.length
        ? supabase.from('financeiro_contas_receber').select('id,venda_obra_id,valor,valor_pago,valor_desconto,status').in('venda_obra_id',vendaIds)
        : Promise.resolve({data:[],error:null} as any),
    ])

    if(orcResp.error||obraResp.error||contasResp.error){
      setErro(orcResp.error?.message||obraResp.error?.message||contasResp.error?.message||'Não foi possível carregar todos os dados da venda.')
    }
    setOrcamentos(Object.fromEntries(((orcResp.data||[]) as OrcamentoVenda[]).map(o=>[o.id,o])))
    setObras(Object.fromEntries(((obraResp.data||[]) as ObraVenda[]).map(o=>[o.id,o])))
    setContas((contasResp.data||[]) as ContaVenda[])
    setCarregando(false)
  }

  function abrirExclusao(v:VendaObra){
    setVendaParaExcluir(v)
    setMotivoExclusao('Venda lançada incorretamente; será sincronizada a venda correta.')
    setConfirmacao('')
    setErro('')
  }

  async function excluirVenda(){
    const v=vendaParaExcluir
    if(!v||excluindo||!podeExcluir)return
    if(confirmacao.trim().toUpperCase()!=='EXCLUIR '+v.numero){
      setErro('Digite exatamente EXCLUIR '+v.numero+' para confirmar.')
      return
    }
    if(motivoExclusao.trim().length<8){setErro('Informe um motivo para a exclusão.');return}
    setExcluindo(true);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada. Faça login novamente.')
      const resp=await fetch('/api/vendas/excluir-incorreta',{
        method:'POST',cache:'no-store',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId:v.id,clienteId,confirmacao:confirmacao.trim(),motivo:motivoExclusao.trim()})
      })
      const dados=await resp.json().catch(()=>({}))
      if(!resp.ok||!dados.ok)throw Error(dados.error||'A exclusão da venda não foi confirmada.')
      setVendaParaExcluir(null)
      setConfirmacao('')
      setSucesso('Venda #'+v.numero+' excluída da lista, com auditoria. '+(Number(dados.contasCanceladas)>0?dados.contasCanceladas+' pré-lançamento(s) financeiro(s) sem pagamento cancelado(s). ':'')+'Confira e vincule o número correto do W.Vetro. Se for o mesmo orçamento Atlas, será necessária uma revisão do vínculo histórico.')
      await carregar()
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao excluir venda.')}
    finally{setExcluindo(false)}
  }

  const totalVendido=useMemo(()=>vendas.reduce((s,v)=>s+Number(v.valor_venda||orcamentos[v.orcamento_id]?.valor_estimado||0),0),[vendas,orcamentos])
  const totalRecebido=useMemo(()=>contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor_pago||0),0),[contas])
  const totalAberto=useMemo(()=>contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0),[contas])

  if(carregando) return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500"><Loader2 size={16} className="mx-auto mb-2 animate-spin"/>Carregando vendas...</div>

  return <div className="space-y-5">
    {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    {sucesso&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><p className="flex gap-2"><CheckCircle2 size={18}/>{sucesso}</p><Link href="/integracoes/wvetro/sincronizar-numero" className="mt-2 inline-block font-bold underline">Sincronizar o número correto do W.Vetro</Link></div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Vendas</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{vendas.length}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total vendido</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{moeda(totalVendido)}</p>
      </div>
      {verFinanceiro&&<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Saldo a receber</p>
        <p className="mt-1 text-xl font-bold text-brand-teal">{moeda(totalAberto)}</p>
      </div>}
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-bold text-slate-800">Vendas / Obras</h2>
        <p className="mt-1 text-xs text-slate-500">Cada venda fica separada por orçamento e obra. Tudo que for lançado depois usa este vínculo.</p>
      </div>

      <div className="divide-y divide-slate-100">
        {vendas.map(v=>{
          const o=orcamentos[v.orcamento_id]
          const obra=v.obra_id?obras[v.obra_id]:undefined
          const valor=Number(v.valor_venda||o?.valor_estimado||0)
          const contasVenda=contas.filter(c=>c.venda_obra_id===v.id&&c.status!=='cancelado')
          const recebido=contasVenda.reduce((s,c)=>s+Number(c.valor_pago||0),0)
          const saldo=contasVenda.reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
          return <div key={v.id} className="flex flex-col border-b border-slate-100 last:border-0 sm:flex-row sm:items-stretch">
           <Link href={`/clientes/${clienteId}/vendas/${v.id}`} className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900"><Building2 size={15} className="text-brand-navy"/>{obra?.nome||`Venda #${v.numero||'—'}`}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{status(v.status||obra?.status||'ativa')}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><FileText size={12}/> Orçamento #{numeroOrcamento(o)}</span>
                {obra?.numero&&<span>Obra #{obra.numero}</span>}
                <span>Venda em {dataBR(v.confirmado_em||v.created_at)}</span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-5 sm:justify-end">
              <div className="text-right">
                <p className="font-bold text-slate-900">{moeda(valor)}</p>
                {verFinanceiro&&<p className="text-xs text-slate-500">{moeda(recebido)} recebido · {moeda(saldo)} saldo</p>}
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><ChevronRight size={18}/></span>
            </div>
           </Link>
           {podeExcluir&&<button type="button" onClick={()=>abrirExclusao(v)}
             aria-label={'Excluir venda incorreta número '+v.numero}
             className="m-3 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-500"
             title="Exclusão lógica auditada, somente Master"><Trash2 size={15}/> Excluir venda</button>}
          </div>
        })}
        {!vendas.length&&<div className="px-5 py-10 text-center">
          <CircleDollarSign size={28} className="mx-auto text-slate-300"/>
          <p className="mt-2 text-sm font-semibold text-slate-600">Nenhuma venda confirmada ainda.</p>
          <p className="mt-1 text-xs text-slate-400">Ao confirmar um orçamento em Vendido no Kanban, a venda passa a aparecer aqui automaticamente.</p>
        </div>}
      </div>
    </section>
    {vendaParaExcluir&&podeExcluir&&<div role="presentation" className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-label="Excluir venda incorreta"
       className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
       <div className="flex items-start justify-between gap-3">
        <div>
         <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><AlertTriangle size={20} className="text-amber-600"/> Excluir venda #{vendaParaExcluir.numero}</h3>
         <p className="mt-1 text-xs text-slate-500">Orçamento #{numeroOrcamento(orcamentos[vendaParaExcluir.orcamento_id])} · {moeda(vendaParaExcluir.valor_venda)}</p>
        </div>
        <button aria-label="Fechar exclusão" disabled={excluindo} onClick={()=>{setVendaParaExcluir(null);setErro('')}} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><X size={20}/></button>
       </div>
       <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        A venda sairá dos Kanbans e relatórios ativos, mas <b>não será apagada definitivamente</b>.
        O histórico e o orçamento serão preservados. Pré-lançamentos financeiros automáticos sem pagamento poderão ser cancelados.
        Vendas com recebimentos, produção, cotação ou instalação vinculadas serão bloqueadas pelo servidor. A exclusão não libera automaticamente o mesmo orçamento para outra venda; esse vínculo exige revisão administrativa.
       </p>
       <label className="block text-sm font-semibold text-slate-800">Motivo da exclusão
        <textarea value={motivoExclusao} maxLength={1000} onChange={e=>setMotivoExclusao(e.target.value)}
         disabled={excluindo} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal" />
       </label>
       <label className="block text-sm font-semibold text-slate-800">Digite <b>EXCLUIR {vendaParaExcluir.numero}</b> para confirmar
        <input value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} autoComplete="off"
         disabled={excluindo} placeholder={'EXCLUIR '+vendaParaExcluir.numero}
         className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal" />
       </label>
       {erro&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">{erro}</p>}
       <div className="flex justify-end gap-2">
        <button type="button" onClick={()=>{setVendaParaExcluir(null);setErro('')}} disabled={excluindo}
         className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancelar</button>
        <button type="button" onClick={()=>void excluirVenda()}
         disabled={excluindo||confirmacao.trim().toUpperCase()!=='EXCLUIR '+vendaParaExcluir.numero||motivoExclusao.trim().length<8}
         className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
         {excluindo?<Loader2 size={16} className="animate-spin"/>:<Trash2 size={16}/>} Excluir venda incorreta
        </button>
       </div>
      </div>
    </div>}
  </div>
}
