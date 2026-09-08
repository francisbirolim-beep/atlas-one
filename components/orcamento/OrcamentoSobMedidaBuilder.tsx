'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import TipologiaMiniatura from './TipologiaMiniatura'

type ClienteResumo = { id:string; nome:string; telefone?:string|null; whatsapp?:string|null; cidade?:string|null }
type ItemSelecionado = { uid:string; tipologiaId:string; nome:string; categoria:string; linhaId:string; cor:string; contramarco:string; vidro:string; arremate:string; quantidade:number }

const ROTULOS_CATEGORIA: Record<string,string> = {
  porta:'Portas', janela:'Janelas', modulo_fixo:'Módulos Fixos', fachada:'Fachadas', box:'Boxes', painel_ripado:'Painéis / Ripados',
  acm:'ACM', cobertura_claraboia:'Coberturas', contramarco_arremate:'Contramarcos / Arremates', espelho:'Espelhos',
  portao_grade:'Portões / Grades', guarda_corpo_corrimao:'Guarda-corpos / Corrimãos', vidro:'Vidros', tela_mosquiteira:'Telas Mosquiteiras', outros:'Outros',
}

function normalizar(valor:string){ return valor.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim() }
function uid(){ return `${Date.now()}-${Math.random().toString(36).slice(2,9)}` }

export default function OrcamentoSobMedidaBuilder(){
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('cliente')
  const buscaSeq = useRef(0)
  const [cliente,setCliente] = useState<ClienteResumo|null>(null)
  const [buscaCliente,setBuscaCliente] = useState('')
  const [clientesEncontrados,setClientesEncontrados] = useState<ClienteResumo[]>([])
  const [buscandoCliente,setBuscandoCliente] = useState(false)
  const [cidade,setCidade] = useState('')
  const [temperatura,setTemperatura] = useState('')
  const [tipologias,setTipologias] = useState<Tipologia[]>([])
  const [linhas,setLinhas] = useState<LinhaTecnica[]>([])
  const [busca,setBusca] = useState('')
  const [categoria,setCategoria] = useState('')
  const [linhaFiltro,setLinhaFiltro] = useState('')
  const [linhaPadraoId,setLinhaPadraoId] = useState('')
  const [corPadrao,setCorPadrao] = useState('preto')
  const [contramarcoPadrao,setContramarcoPadrao] = useState('sim')
  const [vidroPadrao,setVidroPadrao] = useState('')
  const [arrematePadrao,setArrematePadrao] = useState('padrao')
  const [itens,setItens] = useState<ItemSelecionado[]>([])
  const [salvo,setSalvo] = useState(false)

  useEffect(()=>{ Promise.all([listarTipologias(),listarLinhasTecnicas()]).then(([ts,ls])=>{ setTipologias(ts); setLinhas(ls.filter(l=>l.ativo)) }) },[])

  useEffect(()=>{
    if(!clienteIdParam) return
    supabase.from('clientes').select('id,nome,telefone,whatsapp,cidade').eq('id',clienteIdParam).maybeSingle().then(({data})=>{
      if(!data) return
      const c=data as ClienteResumo; setCliente(c); setBuscaCliente(c.nome||''); setCidade(c.cidade||'')
    })
  },[clienteIdParam])

  useEffect(()=>{
    const termo=buscaCliente.trim()
    const seq=++buscaSeq.current
    if(cliente || termo.length<3){ setClientesEncontrados([]); setBuscandoCliente(false); return }
    setBuscandoCliente(true)
    supabase.from('clientes').select('id,nome,telefone,whatsapp,cidade').ilike('nome',`%${termo}%`).order('nome').limit(10).then(({data})=>{
      if(seq!==buscaSeq.current) return
      setClientesEncontrados((data||[]) as ClienteResumo[])
      setBuscandoCliente(false)
    },()=>{ if(seq===buscaSeq.current){ setClientesEncontrados([]); setBuscandoCliente(false) } })
  },[buscaCliente,cliente])

  const categorias=useMemo(()=>Array.from(new Set(tipologias.map(t=>t.categoria).filter(Boolean))).sort(),[tipologias])
  const filtradas=useMemo(()=>{
    const q=normalizar(busca)
    const linhaPadrao=linhas.find(l=>l.id===linhaPadraoId)
    const linhaBusca=linhas.find(l=>l.id===linhaFiltro)
    return tipologias.filter(t=>{
      const texto=normalizar(`${t.label} ${t.chave} ${ROTULOS_CATEGORIA[t.categoria]||t.categoria}`)
      if(q&&!texto.includes(q)) return false
      if(categoria&&t.categoria!==categoria) return false
      if(linhaPadrao&&!(linhaPadrao.tipologia_ids||[]).includes(t.id)) return false
      if(linhaBusca&&!(linhaBusca.tipologia_ids||[]).includes(t.id)) return false
      return true
    })
  },[busca,categoria,linhaFiltro,linhaPadraoId,linhas,tipologias])

  function selecionarCliente(c:ClienteResumo){ setCliente(c); setBuscaCliente(c.nome); setCidade(c.cidade||''); setClientesEncontrados([]) }
  function adicionar(t:Tipologia){
    const linhaCompativel=linhas.find(l=>(l.tipologia_ids||[]).includes(t.id))
    setItens(prev=>[...prev,{uid:uid(),tipologiaId:t.id,nome:t.label,categoria:t.categoria,linhaId:linhaPadraoId||linhaCompativel?.id||'',cor:corPadrao,contramarco:contramarcoPadrao,vidro:vidroPadrao,arremate:arrematePadrao,quantidade:1}]); setSalvo(false)
  }
  function atualizarItem(id:string,patch:Partial<ItemSelecionado>){ setItens(prev=>prev.map(item=>item.uid===id?{...item,...patch}:item)); setSalvo(false) }
  function linhasDoItem(item:ItemSelecionado){ return linhas.filter(l=>(l.tipologia_ids||[]).includes(item.tipologiaId)) }
  function salvarPreview(){
    if(!cliente||!itens.length) return
    window.sessionStorage.setItem('atlas_orcamento_sob_medida_builder_v1',JSON.stringify({clienteId:cliente.id,cidade,temperatura,padroes:{linhaId:linhaPadraoId,cor:corPadrao,contramarco:contramarcoPadrao,vidro:vidroPadrao,arremate:arrematePadrao},itens})); setSalvo(true)
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-4 lg:px-6">
      <Link href={cliente?`/clientes/${cliente.id}`:'/clientes/identificar'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cliente 360 · Orçamento</p><h1 className="truncate text-xl font-bold">Novo Orçamento Sob Medida</h1><p className="text-xs text-slate-500">Escolha o cliente, defina os padrões e adicione todas as tipologias antes de configurar cada peça.</p></div>
      <div className="hidden items-center gap-2 md:flex"><span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">1 Dados</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">2 Tipologias</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">3 Configurar</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">4 Precificar</span></div>
    </div></header>

    <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
      <section className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span><h2 className="font-bold">Dados do cliente e da obra</h2></div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2"><label className="mb-1 block text-xs font-semibold text-slate-600">Cliente</label><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={buscaCliente} autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="search" onChange={e=>{const valor=e.target.value; setBuscaCliente(valor); if(cliente&&valor!==cliente.nome) setCliente(null)}} placeholder="Digite pelo menos 3 letras..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue-500"/>{cliente&&<button type="button" onClick={()=>{setCliente(null);setBuscaCliente('')}} className="absolute right-3 top-2.5 text-slate-400"><X size={18}/></button>}</div>
              {!cliente&&buscaCliente.trim().length>=3&&<div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{buscandoCliente&&<div className="px-3 py-3 text-xs text-slate-500">Buscando clientes...</div>}{!buscandoCliente&&clientesEncontrados.length===0&&<div className="px-3 py-3 text-xs text-slate-500">Nenhum cliente encontrado.</div>}{clientesEncontrados.map(c=><button type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>selecionarCliente(c)} className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-blue-50"><span className="block text-sm font-semibold">{c.nome}</span><span className="text-xs text-slate-500">{c.cidade||'Cidade não informada'} · {c.whatsapp||c.telefone||'Sem telefone'}</span></button>)}</div>}
            </div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Cidade</label><input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade da obra" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Temperatura</label><select value={temperatura} onChange={e=>setTemperatura(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Selecione</option><option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option></select></div>
          </div>
          {!cliente&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><span>Não encontrou o cliente? Cadastre antes de montar o orçamento.</span><Link href="/clientes/novo" className="inline-flex items-center gap-1.5 font-semibold text-blue-700"><UserPlus size={15}/>Cadastrar novo cliente</Link></div>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span><div><h2 className="font-bold">Dados técnicos iniciais</h2><p className="text-xs text-slate-500">São apenas padrões. Cada tipologia pode ter linha, cor, contramarco, vidro e arremate diferentes.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Linha padrão</label><select value={linhaPadraoId} onChange={e=>{setLinhaPadraoId(e.target.value); setLinhaFiltro(e.target.value)}} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Automática pela tipologia</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Cor</label><select value={corPadrao} onChange={e=>setCorPadrao(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="preto">Preto</option><option value="branco">Branco</option><option value="madeirado">Amadeirado</option><option value="outro">Outra cor</option></select></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Contramarco</label><select value={contramarcoPadrao} onChange={e=>setContramarcoPadrao(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="sim">Sim</option><option value="nao">Não</option></select></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Vidro</label><input value={vidroPadrao} onChange={e=>setVidroPadrao(e.target.value)} placeholder="Ex.: temperado 8 mm" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Arremate</label><select value={arrematePadrao} onChange={e=>setArrematePadrao(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="padrao">Padrão</option><option value="sim">Sim</option><option value="nao">Não</option></select></div>
        </div></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">3</span><div><h2 className="font-bold">Adicionar tipologias</h2><p className="text-xs text-slate-500">Clique em + para incluir quantas peças forem necessárias no mesmo orçamento.</p></div></div><div className="grid gap-2 sm:grid-cols-3">
          <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar tipologia..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"/></div>
          <select value={categoria} onChange={e=>setCategoria(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Todas as categorias</option>{categorias.map(c=><option key={c} value={c}>{ROTULOS_CATEGORIA[c]||c}</option>)}</select>
          <select value={linhaPadraoId||linhaFiltro} disabled={Boolean(linhaPadraoId)} onChange={e=>setLinhaFiltro(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-600"><option value="">Todas as linhas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        </div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtradas.slice(0,80).map(t=><div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm"><div className="h-28 bg-slate-50"><TipologiaMiniatura nome={t.label} className="h-full w-full"/></div><div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{t.label}</p><p className="truncate text-xs text-slate-500">{ROTULOS_CATEGORIA[t.categoria]||t.categoria}</p></div><button type="button" onClick={()=>adicionar(t)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Adicionar"><Plus size={18}/></button></div></div></div>)}</div></div>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start"><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-bold">Tipologias no orçamento</h2><p className="text-xs text-slate-500">{itens.length} {itens.length===1?'item adicionado':'itens adicionados'}</p></div><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 text-sm font-bold text-blue-700">{itens.length}</span></div><div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">
        {itens.length===0&&<div className="py-10 text-center text-sm text-slate-500">Nenhuma tipologia adicionada ainda.</div>}
        {itens.map((item,index)=><div key={item.uid} className="rounded-xl border border-slate-200 p-3"><div className="mb-3 flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.nome}</p><p className="text-[11px] text-slate-500">Cada peça pode ter variáveis próprias.</p></div><button type="button" onClick={()=>setItens(prev=>prev.filter(i=>i.uid!==item.uid))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <select value={item.linhaId} onChange={e=>atualizarItem(item.uid,{linhaId:e.target.value})} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">Linha</option>{linhasDoItem(item).map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select>
          <select value={item.cor} onChange={e=>atualizarItem(item.uid,{cor:e.target.value})} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="preto">Preto</option><option value="branco">Branco</option><option value="madeirado">Amadeirado</option><option value="outro">Outra cor</option></select>
          <select value={item.contramarco} onChange={e=>atualizarItem(item.uid,{contramarco:e.target.value})} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="sim">Com contramarco</option><option value="nao">Sem contramarco</option></select>
          <input value={item.vidro} onChange={e=>atualizarItem(item.uid,{vidro:e.target.value})} placeholder="Vidro" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs"/>
          <select value={item.arremate} onChange={e=>atualizarItem(item.uid,{arremate:e.target.value})} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="padrao">Arremate padrão</option><option value="sim">Com arremate</option><option value="nao">Sem arremate</option></select>
          <input type="number" min={1} value={item.quantidade} onChange={e=>atualizarItem(item.uid,{quantidade:Math.max(1,Number(e.target.value)||1)})} className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs"/>
        </div></div>)}
      </div><div className="border-t border-slate-100 p-4"><button disabled={!cliente||itens.length===0} onClick={salvarPreview} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{salvo?<><Check size={17}/>Seleção salva para próxima etapa</>:<>Avançar para configurar tipologias <ChevronRight size={17}/></>}</button>{salvo&&<p className="mt-2 text-center text-xs text-emerald-700">Preview validável: os dados ficaram guardados nesta sessão. A próxima etapa conectará cada tipologia às variáveis técnicas e à precificação.</p>}</div></div></aside>
    </main>
  </div>
}