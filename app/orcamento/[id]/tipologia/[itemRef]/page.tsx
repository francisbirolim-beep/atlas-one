'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, FileText, Loader2, Pencil, Printer, Settings2 } from 'lucide-react'
import {
  carregarPrecificacaoOrcamento,
  salvarPoliticaItem,
  type CategoriaPrecificacao,
  type PrecificacaoOrcamento,
} from '@/lib/orcamentoPrecificacao'

type Aba='resumo'|'perfis'|'acessorios'|'vidros'|'variaveis'|'corte'|'plano'|'servicos'
const ABAS:Array<{id:Aba;label:string}>=[
  {id:'resumo',label:'Resumo'},{id:'perfis',label:'Perfis'},{id:'acessorios',label:'Acessórios'},
  {id:'vidros',label:'Vidros'},{id:'variaveis',label:'Variáveis'},{id:'corte',label:'Lista de corte'},
  {id:'plano',label:'Plano de corte'},{id:'servicos',label:'Serviços / Despesas'},
]
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
function money(v:unknown){return numero(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function pct(v:unknown){return numero(v).toLocaleString('pt-BR',{maximumFractionDigits:2})}
function itemRef(item:any,index:number){return String(item?.id||`item-${index+1}`)}
function nome(item:any,index:number){const r=item?.wvetro_item||{};return r?.Modelo||item?.configuracao_nome||item?.tipo_outro_texto||item?.tipo_esquadria||`Item ${index+1}`}
function medida(item:any){const r=item?.wvetro_item||{};const l=item?.largura_mm||r?.Largura,a=item?.altura_mm||r?.Altura;return l&&a?`${l} × ${a} mm`:'—'}
function categoriaAba(aba:Aba):CategoriaPrecificacao[]{
  if(aba==='perfis')return['perfil'];if(aba==='acessorios')return['acessorio'];if(aba==='vidros')return['vidro']
  if(aba==='servicos')return['mao_obra','instalacao','deslocamento','frete','pintura','terceiro','consumivel','outro'];return[]
}

export default function TipologiaOrcamentoPage(){
  const params=useParams()
  const orcamentoId=String(params?.id||'')
  const ref=decodeURIComponent(String(params?.itemRef||''))
  const [dados,setDados]=useState<PrecificacaoOrcamento|null>(null)
  const [aba,setAba]=useState<Aba>('resumo')
  const [carregando,setCarregando]=useState(true)
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')

  async function carregar(){setCarregando(true);setDados(await carregarPrecificacaoOrcamento(orcamentoId));setCarregando(false)}
  useEffect(()=>{if(orcamentoId)void carregar()},[orcamentoId])

  const itens=Array.isArray(dados?.orcamento?.itens)?dados!.orcamento.itens:[]
  const indice=itens.findIndex((it:any,i:number)=>itemRef(it,i)===ref)
  const item=indice>=0?itens[indice]:null
  const politica=(dados?.politicas||[]).find(p=>String(p.item_ref)===ref)
  const componentes=(dados?.componentes||[]).filter(c=>String(c.item_ref||'')===ref)
  const compsAba=useMemo(()=>{const cats=categoriaAba(aba);return cats.length?componentes.filter(c=>cats.includes(c.categoria)):componentes},[componentes,aba])
  const custo=numero(politica?.custo_produtivo)+numero(politica?.custo_extras)
  const sobra=numero(politica?.custo_sobra)
  const vendaPrecificada=numero(politica?.preco_venda)
  const vendaOriginal=numero(item?.wvetro_item?.ValorTotalAlterado||item?.preco_total||item?.wvetro_item?.ValorTotal||item?.wvetro_item?.Total)
  const venda=vendaPrecificada>0?vendaPrecificada:vendaOriginal
  const cobrar=politica?.sobra_herda_geral===false?Boolean(politica?.cobrar_sobra):Boolean(dados?.orcamento?.cobrar_sobra_padrao)
  const margem=venda-(custo+(cobrar?sobra:0)), margemPct=venda>0?margem/venda*100:0

  async function mudarSobra(){setOcupado(true);setErro('');const r=await salvarPoliticaItem(orcamentoId,ref,{sobra_herda_geral:false,cobrar_sobra:!cobrar});setOcupado(false);if(!r.ok)setErro(r.error);else await carregar()}

  if(carregando)return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500"><Loader2 className="animate-spin"/></div>
  if(!dados||!item)return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Tipologia não encontrada.</div>
  const raw=item?.wvetro_item||{}
  const variaveis=item?.variaveis||item?.variaveis_respostas||{}
  const qtdPerfis=componentes.filter(c=>c.categoria==='perfil').length,qtdAcess=componentes.filter(c=>c.categoria==='acessorio').length,qtdVidros=componentes.filter(c=>c.categoria==='vidro').length

  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-[1450px] space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href={`/orcamento/${orcamentoId}/composicao`} className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar ao orçamento</Link>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">Item {indice+1} · {nome(item,indice)}</h1>{dados.orcamento.wvetro_fluxo?.origem==='wvetro_api'&&<span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">W.Vetro</span>}</div>
        <p className="mt-1 text-sm text-slate-500">{raw?.Nome||item?.descricao||''}</p>
      </div>
      <div className="flex flex-wrap gap-2"><Link href={`/orcamento/${orcamentoId}/materiais?refs=${encodeURIComponent(ref)}`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><Printer size={15}/> Imprimir desta tipologia</Link><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis&itemRef=${encodeURIComponent(ref)}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Settings2 size={15}/> Editar componentes</Link></div>
    </header>

    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Medida</p><b>{medida(item)}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Quantidade</p><b>{item?.quantidade||raw?.Qtde||1}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Custo</p><b>{money(custo)}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Sobra</p><b>{money(sobra)}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Custo c/ sobra</p><b>{money(custo+sobra)}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Venda</p><b>{money(venda)}</b></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-400">Margem</p><b>{money(margem)}</b><p className="text-xs text-slate-500">{pct(margemPct)}%</p></div>
    </section>

    <section className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3">
      <span className="text-sm font-semibold">Cobrar sobra</span><button onClick={()=>void mudarSobra()} disabled={ocupado} className={`relative h-7 w-12 rounded-full ${cobrar?'bg-blue-600':'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white ${cobrar?'left-6':'left-1'}`}/></button><span className="text-xs text-slate-500">{cobrar?'Sim':'Não'} · regra individual desta tipologia</span>
      <div className="ml-auto flex gap-2 text-xs text-slate-500"><span>{qtdPerfis} perfis</span><span>·</span><span>{qtdAcess} acessórios</span><span>·</span><span>{qtdVidros} vidros</span></div>
    </section>

    <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-white p-2">{ABAS.map(a=><button key={a.id} onClick={()=>setAba(a.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${aba===a.id?'bg-blue-50 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}>{a.label}</button>)}</nav>

    {aba==='resumo'&&<section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Resumo da tipologia</h2><div className="mt-4 divide-y text-sm">{[
        ['Descrição',nome(item,indice)],['Linha',raw?.Linha||item?.linha_nome||'—'],['Ambiente',raw?.Ambiente||item?.ambiente||'—'],['Medida',medida(item)],['Quantidade',String(item?.quantidade||raw?.Qtde||1)],['Cor',item?.cor||raw?.Cor||dados.orcamento.acabamento||'—'],['Vidro',raw?.Vidro||item?.vidro||'—'],
      ].map(([k,v])=><div key={k} className="flex justify-between gap-4 py-2"><span className="text-slate-500">{k}</span><b className="text-right">{v}</b></div>)}</div></div>
      <div className="rounded-2xl border bg-white p-5 lg:col-span-2"><h2 className="font-bold">Ações rápidas</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=perfis&itemRef=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Perfis · incluir, substituir, excluir e custos</Link>
        <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=acessorios&itemRef=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Acessórios · incluir, substituir e excluir</Link>
        <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=vidros&itemRef=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Vidros · composição e custos</Link>
        <Link href={`/orcamento/${orcamentoId}/materiais?refs=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Lista de corte desta tipologia</Link>
        <Link href={`/orcamento/${orcamentoId}/plano-corte?refs=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Plano de corte desta tipologia</Link>
        <Link href={`/orcamento/${orcamentoId}/precificacao?etapa=servicos&itemRef=${encodeURIComponent(ref)}`} className="rounded-xl border p-4 font-semibold hover:border-blue-300">Serviços / despesas</Link>
      </div></div>
    </section>}

    {['perfis','acessorios','vidros','servicos'].includes(aba)&&<section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">{ABAS.find(a=>a.id===aba)?.label}</h2><p className="text-xs text-slate-500">Dados desta tipologia, com custo adotado no Atlas.</p></div><Link href={`/orcamento/${orcamentoId}/precificacao?etapa=${aba==='servicos'?'servicos':aba}&itemRef=${encodeURIComponent(ref)}`} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"><Pencil size={14}/> Editar</Link></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-400"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Qtd.</th><th className="px-4 py-3">Un.</th><th className="px-4 py-3">Custo unit.</th><th className="px-4 py-3">Custo total</th><th className="px-4 py-3">Situação</th></tr></thead><tbody className="divide-y">{compsAba.map(c=><tr key={c.id}><td className="px-4 py-3 font-mono">{c.codigo||'—'}</td><td className="px-4 py-3 font-medium">{c.descricao}</td><td className="px-4 py-3">{c.quantidade}</td><td className="px-4 py-3">{c.unidade}</td><td className="px-4 py-3">{money(c.custo_unitario)}</td><td className="px-4 py-3 font-semibold">{money(c.custo_total)}</td><td className="px-4 py-3">{c.custo_pendente?<span className="text-amber-700">Pendente</span>:<span className="text-emerald-700">Validado</span>}</td></tr>)}{!compsAba.length&&<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum componente nesta seção.</td></tr>}</tbody></table></div>
    </section>}

    {aba==='variaveis'&&<section className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2"><Boxes size={18}/><h2 className="font-bold">Variáveis e dados originais</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries({...raw,...variaveis}).filter(([,v])=>['string','number','boolean'].includes(typeof v)).slice(0,60).map(([k,v])=><div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] uppercase text-slate-400">{k}</p><p className="mt-1 text-sm font-semibold">{String(v)}</p></div>)}</div></section>}
    {aba==='corte'&&<section className="rounded-2xl border bg-white p-6 text-center"><FileText className="mx-auto text-blue-600"/><h2 className="mt-2 font-bold">Lista de corte desta tipologia</h2><p className="mt-1 text-sm text-slate-500">A impressão será filtrada somente para este item.</p><Link href={`/orcamento/${orcamentoId}/materiais?refs=${encodeURIComponent(ref)}`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Abrir lista</Link></section>}
    {aba==='plano'&&<section className="rounded-2xl border bg-white p-6 text-center"><Settings2 className="mx-auto text-blue-600"/><h2 className="mt-2 font-bold">Plano de corte desta tipologia</h2><p className="mt-1 text-sm text-slate-500">Mostra barras, cortes, aproveitamento e sobra somente deste item.</p><Link href={`/orcamento/${orcamentoId}/plano-corte?refs=${encodeURIComponent(ref)}`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Abrir plano</Link></section>}
  </div></main>
}