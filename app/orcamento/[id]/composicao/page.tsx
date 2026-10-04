'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Boxes, CheckSquare, ChevronDown, ExternalLink, FileText, Loader2,
  MoreVertical, Printer, RefreshCw, Square, TriangleAlert
} from 'lucide-react'
import {
  carregarPrecificacaoOrcamento,
  gerarBasePrecificacao,
  salvarPoliticaItem,
  type PrecificacaoOrcamento,
} from '@/lib/orcamentoPrecificacao'

function numero(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
function money(v: unknown) { return numero(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) }
function pct(v: unknown) { return numero(v).toLocaleString('pt-BR', { maximumFractionDigits:2 }) }
function itemRef(item:any,index:number){ return String(item?.id || `item-${index+1}`) }
function itemNome(item:any,index:number){
  const raw=item?.wvetro_item||{}
  return raw?.Modelo || item?.configuracao_nome || item?.tipo_outro_texto || item?.tipo_esquadria || item?.tipo || `Item ${index+1}`
}
function itemDescricao(item:any){
  const raw=item?.wvetro_item||{}
  return raw?.Nome || item?.descricao || [raw?.Linha||item?.linha_nome, raw?.Ambiente||item?.ambiente].filter(Boolean).join(' · ')
}
function itemCor(item:any, orc:any){ const raw=item?.wvetro_item||{}; return item?.cor||item?.acabamento||raw?.Cor||orc?.acabamento||'—' }
function itemMedida(item:any){ const raw=item?.wvetro_item||{}; const l=item?.largura_mm||raw?.Largura; const a=item?.altura_mm||raw?.Altura; return l&&a?`${l} × ${a} mm`:'—' }
function acharPdf(obj:any):string|null{
  if(!obj||typeof obj!=='object')return null
  for(const [k,v] of Object.entries(obj)){
    if(typeof v==='string' && /^https?:\/\//i.test(v) && (/pdf/i.test(k)||/\.pdf(?:$|\?)/i.test(v))) return v
    if(v&&typeof v==='object'){const x=acharPdf(v);if(x)return x}
  }
  return null
}

export default function ComposicaoOrcamentoPage(){
  const params=useParams()
  const orcamentoId=String(params?.id||'')
  const [dados,setDados]=useState<PrecificacaoOrcamento|null>(null)
  const [carregando,setCarregando]=useState(true)
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [selecionados,setSelecionados]=useState<Set<string>>(new Set())
  const [menuItem,setMenuItem]=useState<string|null>(null)
  const geracaoAutomatica=useRef(false)

  async function carregar(){
    setCarregando(true);setErro('')
    let d=await carregarPrecificacaoOrcamento(orcamentoId)
    const wv=d?.orcamento?.wvetro_fluxo?.origem==='wvetro_api'
    if(d&&wv&&!d.pacote&&!geracaoAutomatica.current){
      geracaoAutomatica.current=true;setOcupado(true)
      const g=await gerarBasePrecificacao(orcamentoId,{perdaCorteMm:0,minimoSobraReaproveitavelMm:300})
      setOcupado(false)
      if(!g.ok)setErro(g.error)
      d=await carregarPrecificacaoOrcamento(orcamentoId)
    }
    setDados(d);setCarregando(false)
  }
  useEffect(()=>{if(orcamentoId)void carregar()},[orcamentoId])

  const itens=Array.isArray(dados?.orcamento?.itens)?dados!.orcamento.itens:[]
  const politicas=useMemo(()=>new Map((dados?.politicas||[]).map(p=>[String(p.item_ref),p])),[dados?.politicas])
  const componentesPorItem=useMemo(()=>{
    const m=new Map<string,any[]>()
    for(const c of dados?.componentes||[]){if(!c.item_ref)continue;const a=m.get(String(c.item_ref))||[];a.push(c);m.set(String(c.item_ref),a)}
    return m
  },[dados?.componentes])
  const todosRefs=itens.map((it:any,i:number)=>itemRef(it,i))
  const todosSelecionados=todosRefs.length>0&&todosRefs.every((r:string)=>selecionados.has(r))
  function alternar(ref:string){setSelecionados(at=>{const n=new Set(at);n.has(ref)?n.delete(ref):n.add(ref);return n})}
  function alternarTodos(){setSelecionados(todosSelecionados?new Set():new Set(todosRefs))}
  async function recalcular(){setOcupado(true);setErro('');const r=await gerarBasePrecificacao(orcamentoId,{perdaCorteMm:0,minimoSobraReaproveitavelMm:300});setOcupado(false);if(!r.ok)setErro(r.error);else await carregar()}
  async function mudarSobra(ref:string,valor:boolean){setOcupado(true);const r=await salvarPoliticaItem(orcamentoId,ref,{sobra_herda_geral:false,cobrar_sobra:valor});setOcupado(false);if(!r.ok)setErro(r.error);else await carregar()}
  async function cobrarTodas(valor:boolean){setOcupado(true);for(const ref of todosRefs){const r=await salvarPoliticaItem(orcamentoId,ref,{sobra_herda_geral:false,cobrar_sobra:valor});if(!r.ok){setErro(r.error);break}}setOcupado(false);await carregar()}

  if(carregando)return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin"/></div>
  if(!dados)return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Orçamento não encontrado.</div>

  const orc=dados.orcamento
  const cliente=(Array.isArray(orc.clientes)?orc.clientes[0]:orc.clientes)?.nome||orc.cliente_nome||'Cliente'
  const fluxo=orc.wvetro_fluxo||null
  const wv=fluxo?.origem==='wvetro_api'
  const numeroOrcamento=wv?(fluxo?.numero||orc.numero):orc.numero
  const pdf=wv?acharPdf(fluxo?.payload_bruto):null
  const totalCusto=(dados.politicas||[]).reduce((s,p)=>s+Number(p.custo_total||0),0)+(dados.componentes||[]).filter(c=>!c.item_ref).reduce((s,c)=>s+Number(c.custo_total||0),0)
  const totalVendaBanco=numero(orc.valor_estimado)
  const totalVendaItens=itens.reduce((s:any,item:any)=>s+numero(item?.wvetro_item?.ValorTotalAlterado||item?.preco_total||item?.wvetro_item?.ValorTotal||item?.wvetro_item?.Total),0)
  const totalVenda=totalVendaBanco>0?totalVendaBanco:totalVendaItens
  const margem=totalVenda-totalCusto
  const margemPct=totalVenda>0?(margem/totalVenda)*100:0
  const refsQuery=[...selecionados].join(',')
  const escopoHref=(base:string)=>selecionados.size? `${base}?refs=${encodeURIComponent(refsQuery)}`:base

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href={orc.cliente_id?`/clientes/${orc.cliente_id}/central`:'/clientes'} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar</Link>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">Orçamento Atlas #{numeroOrcamento||'—'}</h1>{wv&&<span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">Origem: W.Vetro</span>}<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Sincronizado</span></div>
        <p className="mt-1 text-sm text-slate-500">Cliente: {cliente}{fluxo?.vendedor?` · Vendedor: ${fluxo.vendedor}`:''}{fluxo?.sincronizado_em?` · Última sincronização: ${new Date(fluxo.sincronizado_em).toLocaleString('pt-BR')}`:''}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {wv&&pdf?<a href={pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><ExternalLink size={15}/> Ver PDF original W.Vetro</a>:wv?<button disabled title="A API do W.Vetro não informou uma URL de PDF para este orçamento." className="inline-flex items-center gap-2 rounded-xl border bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400"><ExternalLink size={15}/> PDF original W.Vetro</button>:null}
        <Link href={`/orcamento/${orcamentoId}/imprimir`} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Printer size={15}/> Orçamento Atlas (PDF)</Link>
        <button onClick={()=>void recalcular()} disabled={ocupado} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{ocupado?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Recalcular</button>
      </div>
    </header>

    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    {dados.pendencias.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><TriangleAlert size={16} className="mr-2 inline"/>{dados.pendencias.length} pendência(s) técnica(s) precisam de conferência antes do fechamento.</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Tipologias</p><p className="mt-1 text-2xl font-bold">{itens.length}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Valor original</p><p className="mt-1 text-xl font-bold">{money(totalVenda)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Descontos</p><p className="mt-1 text-xl font-bold">{money(0)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Valor final</p><p className="mt-1 text-xl font-bold text-emerald-700">{money(totalVenda)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Custo total</p><p className="mt-1 text-xl font-bold">{money(totalCusto)}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Margem</p><p className="mt-1 text-xl font-bold">{money(margem)}</p><p className="text-xs text-slate-500">{pct(margemPct)}%</p></div>
    </section>

    <section className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3">
      <div className="relative">
        <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Printer size={15}/> Gerar / Imprimir <ChevronDown size={14}/></button>
      </div>
      <span className="rounded-xl border bg-slate-50 px-3 py-2 text-xs font-semibold">{selecionados.size? `${selecionados.size} selecionada(s)`:'Tudo'}</span>
      <Link href={escopoHref(`/orcamento/${orcamentoId}/materiais?filtro=perfis`)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Perfis</Link>
      <Link href={escopoHref(`/orcamento/${orcamentoId}/materiais?filtro=acessorios`)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Acessórios</Link>
      <Link href={escopoHref(`/orcamento/${orcamentoId}/materiais?filtro=vidros`)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Vidros</Link>
      <Link href={escopoHref(`/orcamento/${orcamentoId}/materiais`)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Lista de corte</Link>
      <Link href={escopoHref(`/orcamento/${orcamentoId}/plano-corte`)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Plano de corte</Link>
      <button onClick={()=>void cobrarTodas(true)} disabled={ocupado} className="ml-auto rounded-xl border px-3 py-2 text-sm font-semibold">% Cobrar sobra em todas</button>
    </section>

    <section className="overflow-visible rounded-2xl border bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400"><tr>
          <th className="px-4 py-3"><button onClick={alternarTodos}>{todosSelecionados?<CheckSquare size={17}/>:<Square size={17}/>}</button></th>
          <th className="px-3 py-3">#</th><th className="px-3 py-3">Tipologia / Descrição</th><th className="px-3 py-3">Ambiente</th><th className="px-3 py-3">Medida</th><th className="px-3 py-3">Qtd.</th><th className="px-3 py-3">Custo</th><th className="px-3 py-3">Sobra</th><th className="px-3 py-3">Custo c/ sobra</th><th className="px-3 py-3">Venda</th><th className="px-3 py-3">Margem</th><th className="px-3 py-3">Cobrar sobra</th><th className="px-3 py-3">Ações</th>
        </tr></thead>
        <tbody className="divide-y">{itens.map((item:any,index:number)=>{
          const ref=itemRef(item,index),pol=politicas.get(ref),comps=componentesPorItem.get(ref)||[]
          const custo=numero(pol?.custo_produtivo)+numero(pol?.custo_extras), sobra=numero(pol?.custo_sobra)
          const vendaPrecificada=numero(pol?.preco_venda)
          const vendaOriginal=numero(item?.wvetro_item?.ValorTotalAlterado||item?.preco_total||item?.wvetro_item?.ValorTotal||item?.wvetro_item?.Total)
          const venda=vendaPrecificada>0?vendaPrecificada:vendaOriginal, marg=venda-(custo+sobra), margPct=venda>0?(marg/venda)*100:0
          const cobrar=pol?.sobra_herda_geral===false?Boolean(pol?.cobrar_sobra):Boolean(orc.cobrar_sobra_padrao)
          return <tr key={ref} className="hover:bg-slate-50/70">
            <td className="px-4 py-3"><button onClick={()=>alternar(ref)}>{selecionados.has(ref)?<CheckSquare size={17} className="text-blue-600"/>:<Square size={17} className="text-slate-400"/>}</button></td>
            <td className="px-3 py-3">{index+1}</td>
            <td className="px-3 py-3"><Link href={`/orcamento/${orcamentoId}/tipologia/${encodeURIComponent(ref)}`} className="font-bold text-slate-900 hover:text-blue-700">{itemNome(item,index)}</Link><p className="max-w-[330px] text-xs text-slate-500">{itemDescricao(item)}</p><p className="mt-1 text-[10px] text-slate-400">{comps.filter(c=>c.categoria==='perfil').length} perfis · {comps.filter(c=>c.categoria==='acessorio').length} acessórios · {comps.filter(c=>c.categoria==='vidro').length} vidros · Cor {itemCor(item,orc)}</p></td>
            <td className="px-3 py-3">{item?.ambiente||item?.wvetro_item?.Ambiente||'—'}</td><td className="px-3 py-3 whitespace-nowrap">{itemMedida(item)}</td><td className="px-3 py-3">{item?.quantidade||item?.wvetro_item?.Qtde||1}</td>
            <td className="px-3 py-3 whitespace-nowrap">{money(custo)}</td><td className="px-3 py-3 whitespace-nowrap">{money(sobra)}</td><td className="px-3 py-3 whitespace-nowrap font-semibold">{money(custo+sobra)}</td><td className="px-3 py-3 whitespace-nowrap font-bold">{money(venda)}</td><td className="px-3 py-3 whitespace-nowrap">{money(marg)}<div className="text-xs text-slate-500">{pct(margPct)}%</div></td>
            <td className="px-3 py-3"><button onClick={()=>void mudarSobra(ref,!cobrar)} disabled={ocupado} className={`relative h-7 w-12 rounded-full transition ${cobrar?'bg-blue-600':'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${cobrar?'left-6':'left-1'}`}/></button></td>
            <td className="relative px-3 py-3"><button onClick={()=>setMenuItem(menuItem===ref?null:ref)} className="rounded-lg border p-2"><MoreVertical size={16}/></button>{menuItem===ref&&<div className="absolute right-3 top-11 z-30 w-64 rounded-xl border bg-white p-2 shadow-xl">
              <Link href={`/orcamento/${orcamentoId}/tipologia/${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Ver detalhes da tipologia</Link>
              <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis&itemRef=${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Perfis / custos</Link>
              <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=acessorios&itemRef=${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Acessórios</Link>
              <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=vidros&itemRef=${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Vidros</Link>
              <Link href={`/orcamento/${orcamentoId}/materiais?refs=${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Lista de corte desta tipologia</Link>
              <Link href={`/orcamento/${orcamentoId}/plano-corte?refs=${encodeURIComponent(ref)}`} className="block rounded-lg px-3 py-2 hover:bg-slate-50">Plano de corte desta tipologia</Link>
            </div>}</td>
          </tr>
        })}</tbody>
      </table></div>
    </section>

    <p className="text-xs text-slate-500">Regra automática de sobra: preto e branco não cobram por padrão; demais cores cobram. A decisão pode ser alterada individualmente ou em lote sem apagar a origem W.Vetro.</p>
  </div></main>
}