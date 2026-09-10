'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, Loader2, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { listarVidrosPlanoCorte, type VidroCatalogoPlano } from '@/lib/planoCorteVidros'
import type { Tipologia } from '@/lib/tipos'
import TipologiaMiniatura from './TipologiaMiniatura'

type ClienteResumo = { id:string; nome:string; apelido?:string|null; telefone?:string|null; whatsapp?:string|null; cpf_cnpj?:string|null; email?:string|null; cidade?:string|null; bairro?:string|null; endereco?:string|null; cep?:string|null }
type TipologiaOrcamento = Tipologia & { usa_vidro?: boolean | null }
type ItemSelecionado = { uid:string; tipologiaId:string; nome:string; categoria:string; linhaId:string; cor:string; contramarco:'sim'|'nao'; vidro:string; usaVidro:boolean|null; arremate:'sim'|'nao'; quantidade:number }

const ROTULOS: Record<string,string> = { porta:'Portas', janela:'Janelas', modulo_fixo:'Módulos Fixos', fachada:'Fachadas', box:'Boxes', painel_ripado:'Painéis / Ripados', acm:'ACM', cobertura_claraboia:'Coberturas', contramarco_arremate:'Contramarcos / Arremates', espelho:'Espelhos', portao_grade:'Portões / Grades', guarda_corpo_corrimao:'Guarda-corpos / Corrimãos', vidro:'Vidros', tela_mosquiteira:'Telas Mosquiteiras', outros:'Outros' }
const novoUid = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`

export default function OrcamentoSobMedidaBuilderV2() {
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('cliente')
  const [cliente,setCliente] = useState<ClienteResumo|null>(null)
  const [buscaCliente,setBuscaCliente] = useState('')
  const [clientesEncontrados,setClientesEncontrados] = useState<ClienteResumo[]>([])
  const [buscandoClientes,setBuscandoClientes] = useState(false)
  const [erroBuscaCliente,setErroBuscaCliente] = useState('')
  const [cidade,setCidade] = useState('')
  const [temperatura,setTemperatura] = useState('')
  const [tipologias,setTipologias] = useState<TipologiaOrcamento[]>([])
  const [linhas,setLinhas] = useState<LinhaTecnica[]>([])
  const [linhaSelecionadaId,setLinhaSelecionadaId] = useState('')
  const [busca,setBusca] = useState('')
  const [categoria,setCategoria] = useState('')
  const [vidros,setVidros] = useState<VidroCatalogoPlano[]>([])
  const [vidroAbertoUid,setVidroAbertoUid] = useState<string|null>(null)
  const [corPadrao,setCorPadrao] = useState('preto')
  const [contramarcoPadrao,setContramarcoPadrao] = useState<'sim'|'nao'>('sim')
  const [arrematePadrao,setArrematePadrao] = useState<'sim'|'nao'>('sim')
  const [itens,setItens] = useState<ItemSelecionado[]>([])
  const [salvo,setSalvo] = useState(false)

  useEffect(() => { Promise.all([listarTipologias(),listarLinhasTecnicas(),listarVidrosPlanoCorte()]).then(([t,l,v])=>{setTipologias(t as TipologiaOrcamento[]);setLinhas(l.filter(x=>x.ativo));setVidros(v)}) },[])

  useEffect(() => {
    const id = clienteIdParam
    if (!id) return
    let ativo = true
    ;(async()=>{
      const token = await tokenAtual(); if(!token) return
      try { const r=await fetch(`/api/clientes/busca?id=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}); const j=await r.json(); if(ativo&&r.ok&&j.cliente) selecionarCliente(j.cliente) } catch {}
    })()
    return()=>{ativo=false}
  },[clienteIdParam])

  useEffect(() => {
    const termo = buscaCliente.trim()
    if (cliente || termo.length < 2) { setClientesEncontrados([]); setBuscandoClientes(false); setErroBuscaCliente(''); return }
    let ativo = true
    const timer = window.setTimeout(async()=>{
      setBuscandoClientes(true); setErroBuscaCliente('')
      try {
        const token = await tokenAtual()
        if(!token){ if(ativo)setErroBuscaCliente('Sessão expirada. Entre novamente no Atlas.'); return }
        const r = await fetch(`/api/clientes/busca?q=${encodeURIComponent(termo)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
        const j = await r.json()
        if(!ativo)return
        if(!r.ok){setClientesEncontrados([]);setErroBuscaCliente(j.error||'Não foi possível pesquisar clientes.');return}
        setClientesEncontrados((j.clientes||[]) as ClienteResumo[])
      } catch { if(ativo){setClientesEncontrados([]);setErroBuscaCliente('Não foi possível pesquisar clientes.')} }
      finally { if(ativo)setBuscandoClientes(false) }
    },100)
    return()=>{ativo=false;window.clearTimeout(timer)}
  },[buscaCliente,cliente])

  const linha = useMemo(()=>linhas.find(l=>l.id===linhaSelecionadaId)||null,[linhas,linhaSelecionadaId])
  const categorias = useMemo(()=>{if(!linha)return[];const ids=new Set(linha.tipologia_ids||[]);return Array.from(new Set(tipologias.filter(t=>ids.has(t.id)).map(t=>t.categoria).filter(Boolean))).sort()},[linha,tipologias])
  const filtradas = useMemo(()=>{if(!linha)return[];const ids=new Set(linha.tipologia_ids||[]);return tipologias.filter(t=>ids.has(t.id)&&(!categoria||t.categoria===categoria)&&(!busca.trim()||correspondeBuscaAtlas(busca,t.label,t.chave,ROTULOS[t.categoria]||t.categoria,linha.nome,linha.fabricante,linha.descricao,...(linha.apelidos||[]))))},[linha,tipologias,categoria,busca])
  const vidroPendente = useMemo(()=>itens.some(i=>i.usaVidro===true&&!i.vidro.trim()),[itens])

  function selecionarCliente(c:ClienteResumo){setCliente(c);setBuscaCliente(c.nome);setClientesEncontrados([]);setErroBuscaCliente('');setCidade(c.cidade||'')}
  function limparCliente(){setCliente(null);setBuscaCliente('');setClientesEncontrados([]);setCidade('')}
  function adicionar(t:TipologiaOrcamento){if(!linhaSelecionadaId)return;setItens(p=>[...p,{uid:novoUid(),tipologiaId:t.id,nome:t.label,categoria:t.categoria,linhaId:linhaSelecionadaId,cor:corPadrao,contramarco:contramarcoPadrao,vidro:'',usaVidro:typeof t.usa_vidro==='boolean'?t.usa_vidro:null,arremate:contramarcoPadrao==='sim'?'sim':arrematePadrao,quantidade:1}]);setSalvo(false)}
  function atualiza(uid:string,patch:Partial<ItemSelecionado>){setItens(p=>p.map(i=>i.uid===uid?{...i,...patch}:i));setSalvo(false)}
  function contramarcoItem(uid:string,v:'sim'|'nao'){setItens(p=>p.map(i=>i.uid===uid?{...i,contramarco:v,arremate:v==='sim'?'sim':i.arremate}:i));setSalvo(false)}
  function sugestoes(i:ItemSelecionado){return (i.vidro.trim()?vidros.filter(v=>correspondeBuscaAtlas(i.vidro,v.nome,v.codigo)):vidros).slice(0,20)}
  function salvar(){if(!cliente||!itens.length||vidroPendente)return;sessionStorage.setItem('atlas_orcamento_sob_medida_builder_v1',JSON.stringify({clienteId:cliente.id,cidade,temperatura,padroes:{cor:corPadrao,contramarco:contramarcoPadrao,arremate:contramarcoPadrao==='sim'?'sim':arrematePadrao},itens}));setSalvo(true)}

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-4 lg:px-6"><Link href={cliente?`/clientes/${cliente.id}`:'/clientes/identificar'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cliente 360 · Orçamento</p><h1 className="truncate text-xl font-bold">Novo Orçamento Sob Medida</h1><p className="text-xs text-slate-500">Escolha o cliente, defina os padrões e depois selecione linha e tipologias.</p></div><div className="hidden items-center gap-2 md:flex"><span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">1 Dados</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">2 Tipologias</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">3 Configurar</span><ChevronRight size={15} className="text-slate-300"/><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">4 Precificar</span></div></div></header>
    <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6"><section className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</span><h2 className="font-bold">Dados do cliente e da obra</h2></div><div className="grid gap-3 md:grid-cols-4"><div className="relative md:col-span-2"><label className="mb-1 block text-xs font-semibold text-slate-600">Cliente</label><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={buscaCliente} autoComplete="off" onChange={e=>{setBuscaCliente(e.target.value);if(cliente&&e.target.value!==cliente.nome)setCliente(null)}} placeholder="Digite nome, telefone, CPF/CNPJ..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue-500"/>{buscandoClientes&&!cliente&&<Loader2 size={17} className="absolute right-3 top-2.5 animate-spin text-blue-500"/>}{cliente&&<button onClick={limparCliente} className="absolute right-3 top-2.5 text-slate-400"><X size={18}/></button>}</div>{!cliente&&buscaCliente.trim().length>=2&&<div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">{buscandoClientes&&clientesEncontrados.length===0&&<div className="px-3 py-3 text-xs text-slate-500">Pesquisando clientes...</div>}{!buscandoClientes&&erroBuscaCliente&&<div className="px-3 py-3 text-xs font-medium text-red-600">{erroBuscaCliente}</div>}{!buscandoClientes&&!erroBuscaCliente&&clientesEncontrados.length===0&&<div className="px-3 py-3 text-xs text-slate-500">Nenhum cliente encontrado.</div>}{clientesEncontrados.map(c=><button type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>selecionarCliente(c)} className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-blue-50"><span className="block text-sm font-semibold">{c.nome}</span><span className="text-xs text-slate-500">{c.cidade||'Cidade não informada'} · {c.whatsapp||c.telefone||'Sem telefone'}</span></button>)}</div>}</div><div><label className="mb-1 block text-xs font-semibold text-slate-600">Cidade</label><input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade da obra" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></div><div><label className="mb-1 block text-xs font-semibold text-slate-600">Temperatura</label><div className="grid grid-cols-3 gap-1.5">{(['quente','morno','frio'] as const).map(v=><button key={v} onClick={()=>setTemperatura(v)} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold capitalize ${temperatura===v?'border-blue-600 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-700'}`}>{v}</button>)}</div></div></div>{!cliente&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><span>Não encontrou o cliente? Cadastre antes de montar o orçamento.</span><Link href="/clientes/novo" className="inline-flex items-center gap-1.5 font-semibold text-blue-700"><UserPlus size={15}/>Cadastrar novo cliente</Link></div>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span><div><h2 className="font-bold">Padrões do orçamento</h2><p className="text-xs text-slate-500">Servem como padrão inicial. Cada tipologia pode receber valores próprios depois.</p></div></div><div className="grid gap-3 sm:grid-cols-3"><select value={corPadrao} onChange={e=>setCorPadrao(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="preto">Preto</option><option value="branco">Branco</option><option value="madeirado">Amadeirado</option><option value="outro">Outra cor</option></select><select value={contramarcoPadrao} onChange={e=>{const v=e.target.value as 'sim'|'nao';setContramarcoPadrao(v);if(v==='sim')setArrematePadrao('sim')}} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="sim">Contramarco: Sim</option><option value="nao">Contramarco: Não</option></select><select value={contramarcoPadrao==='sim'?'sim':arrematePadrao} disabled={contramarcoPadrao==='sim'} onChange={e=>setArrematePadrao(e.target.value as 'sim'|'nao')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100"><option value="sim">Arremate: Sim</option><option value="nao">Arremate: Não</option></select></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">3</span><div><h2 className="font-bold">Adicionar tipologias</h2><p className="text-xs text-slate-500">Primeiro escolha a linha. Depois pesquise livremente.</p></div></div><div className="grid gap-2 sm:grid-cols-3"><select value={linhaSelecionadaId} onChange={e=>{setLinhaSelecionadaId(e.target.value);setBusca('');setCategoria('')}} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">1. Escolha a linha</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} disabled={!linhaSelecionadaId} onChange={e=>setBusca(e.target.value)} placeholder="2. Ex.: porta 3..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm disabled:bg-slate-50"/></div><select value={categoria} disabled={!linhaSelecionadaId} onChange={e=>setCategoria(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"><option value="">Todas as categorias da linha</option>{categorias.map(c=><option key={c} value={c}>{ROTULOS[c]||c}</option>)}</select></div>{linhaSelecionadaId&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtradas.slice(0,80).map(t=><div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="h-28 bg-slate-50"><TipologiaMiniatura nome={t.label} className="h-full w-full"/></div><div className="flex items-center justify-between p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{t.label}</p><p className="truncate text-xs text-slate-500">{ROTULOS[t.categoria]||t.categoria}</p></div><button onClick={()=>adicionar(t)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Plus size={18}/></button></div></div>)}</div>}</div>
    </section><aside className="min-w-0 lg:sticky lg:top-4 lg:self-start"><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-bold">Tipologias no orçamento</h2><p className="text-xs text-slate-500">{itens.length} itens adicionados</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{itens.length}</span></div><div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">{itens.length===0&&<div className="py-10 text-center text-sm text-slate-500">Nenhuma tipologia adicionada ainda.</div>}{itens.map((i,idx)=><div key={i.uid} className="rounded-xl border border-slate-200 p-3"><div className="mb-3 flex items-start gap-2"><span className="text-xs font-bold">{idx+1}</span><p className="min-w-0 flex-1 truncate text-sm font-bold">{i.nome}</p><button onClick={()=>setItens(p=>p.filter(x=>x.uid!==i.uid))} className="text-red-500"><Trash2 size={16}/></button></div><div className="grid gap-2 grid-cols-2"><select value={i.cor} onChange={e=>atualiza(i.uid,{cor:e.target.value})} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="preto">Cor: Preto</option><option value="branco">Cor: Branco</option><option value="madeirado">Cor: Amadeirado</option><option value="outro">Cor: Outra</option></select><select value={i.contramarco} onChange={e=>contramarcoItem(i.uid,e.target.value as 'sim'|'nao')} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="sim">Com contramarco</option><option value="nao">Sem contramarco</option></select><select value={i.arremate} disabled={i.contramarco==='sim'} onChange={e=>atualiza(i.uid,{arremate:e.target.value as 'sim'|'nao'})} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:bg-slate-100"><option value="sim">Com arremate</option><option value="nao">Sem arremate</option></select><input type="number" min={1} value={i.quantidade} onChange={e=>atualiza(i.uid,{quantidade:Math.max(1,Number(e.target.value)||1)})} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"/>{i.usaVidro!==false&&<div className="relative col-span-2"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400"/><input value={i.vidro} onFocus={()=>setVidroAbertoUid(i.uid)} onBlur={()=>setTimeout(()=>setVidroAbertoUid(x=>x===i.uid?null:x),120)} onChange={e=>{atualiza(i.uid,{vidro:e.target.value});setVidroAbertoUid(i.uid)}} placeholder={i.usaVidro===true?'Vidro obrigatório':'Vidro'} className={`w-full rounded-lg border py-2 pl-8 pr-2 text-xs ${i.usaVidro===true&&!i.vidro.trim()?'border-amber-400 bg-amber-50':'border-slate-200'}`}/>{vidroAbertoUid===i.uid&&<div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white shadow-xl">{sugestoes(i).map(v=><button key={v.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{atualiza(i.uid,{vidro:v.nome});setVidroAbertoUid(null)}} className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-blue-50">{v.nome}</button>)}</div>}</div>}</div></div>)}</div><div className="border-t p-4"><button disabled={!cliente||!itens.length||vidroPendente} onClick={salvar} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">{salvo?<><Check size={17}/>Seleção salva</>:<>Avançar para configurar tipologias <ChevronRight size={17}/></>}</button></div></div></aside></main>
  </div>
}
