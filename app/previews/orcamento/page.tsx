'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ClipboardList, DraftingCompass, FileText, ImageOff, Minus, Package, Plus, Search, ShoppingBag, SlidersHorizontal, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'

type Modo='escolher'|'sob_medida'|'produtos'
type Categoria='todos'|'perfil'|'acessorio'|'vidro'|'pronto'|'outros'
type Produto={id:string;codigo:string;nome:string;descricao:string;categoria:string;unidade:string;linha:string|null;preco:number|null;precoPromocional:number|null;fotoUrl:string|null;fotoCandidataUrl?:string|null}
type Linha={id:string;nome:string;ativa:boolean}
type Item={produto:Produto;quantidade:number}
type Medida={id:number;tipologia:Tipologia;linha:string;largura:string;altura:string;folhas:string;cor:string;vidro:string;contramarco:string;quantidade:number}
const categorias:{id:Categoria;label:string}[]=[
  {id:'todos',label:'Todos'},{id:'perfil',label:'Perfis'},{id:'acessorio',label:'Acessórios'},
  {id:'vidro',label:'Vidros'},{id:'pronto',label:'Produtos prontos'},{id:'outros',label:'Outros'}
]
const baseInput='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const unitario=(p:Produto)=>p.precoPromocional!=null&&p.precoPromocional>0?p.precoPromocional:p.preco
const idNovo=()=>Date.now()+Math.floor(Math.random()*1000)
const normaliza=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export default function OrcamentoPreview(){
  const [modo,setModo]=useState<Modo>('escolher')
  const [cliente,setCliente]=useState('')
  const [buscaCliente,setBuscaCliente]=useState('')
  const [clientes,setClientes]=useState<{id:string;nome:string;cidade:string|null}[]>([])
  const [tipologias,setTipologias]=useState<Tipologia[]>([])
  const [linhasTecnicas,setLinhasTecnicas]=useState<LinhaTecnica[]>([])
  const [tipologiaId,setTipologiaId]=useState('')
  const [buscaTipologia,setBuscaTipologia]=useState('')
  const [linhaSobMedida,setLinhaSobMedida]=useState('')
  const [largura,setLargura]=useState('')
  const [altura,setAltura]=useState('')
  const [folhas,setFolhas]=useState('2')
  const [cor,setCor]=useState('')
  const [vidro,setVidro]=useState('')
  const [contramarco,setContramarco]=useState('a_definir')
  const [qtdMedida,setQtdMedida]=useState('1')
  const [medidas,setMedidas]=useState<Medida[]>([])
  const [categoria,setCategoria]=useState<Categoria>('todos')
  const [busca,setBusca]=useState('')
  const [linha,setLinha]=useState('')
  const [precoFiltro,setPrecoFiltro]=useState<'todos'|'com'|'sem'>('todos')
  const [linhas,setLinhas]=useState<Linha[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [itens,setItens]=useState<Item[]>([])
  const [carregando,setCarregando]=useState(false)
  const [erro,setErro]=useState('')
  const [aviso,setAviso]=useState('')
  const [revisao,setRevisao]=useState(false)
  useEffect(()=>{let ativo=true;void Promise.all([listarTipologias(),listarLinhasTecnicas()]).then(([ts,ls])=>{if(ativo){setTipologias(ts);setLinhasTecnicas(ls.filter(l=>l.ativo))}}).catch(()=>{});return()=>{ativo=false}},[])
  useEffect(()=>{
    if(buscaCliente.trim().length<2||cliente){setClientes([]);return}
    const ctrl=new AbortController()
    const timer=setTimeout(()=>void (async()=>{
      try{
        const t=await tokenAtual();if(!t)return
        const r=await fetch('/api/previews/comercial?tipo=clientes&q='+encodeURIComponent(buscaCliente),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(r.ok&&!ctrl.signal.aborted)setClientes((j.clientes||[]).slice(0,8))
      }catch{}
    })(),240)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[buscaCliente,cliente])
  useEffect(()=>{
    if(modo==='escolher'||revisao)return
    const ctrl=new AbortController()
    const timer=setTimeout(()=>void (async()=>{
      setCarregando(true);setErro('')
      try{
        const t=await tokenAtual();if(!t)throw Error('Faça login no Atlas One para consultar os itens.')
        const params=new URLSearchParams({tipo:'produtos',q:busca,categoria,precoFiltro})
        if(linha)params.set('linhaId',linha)
        const r=await fetch('/api/previews/comercial?'+params.toString(),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
        const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível consultar o catálogo.')
        if(!ctrl.signal.aborted){setProdutos(j.produtos||[]);setLinhas(j.linhas||[])}
      }catch(e){if(!ctrl.signal.aborted&&((e as {name?:string}).name!=='AbortError'))setErro(e instanceof Error?e.message:'Erro ao consultar produtos.')}
      finally{if(!ctrl.signal.aborted)setCarregando(false)}
    })(),busca?220:60)
    return()=>{ctrl.abort();clearTimeout(timer)}
  },[modo,revisao,busca,categoria,linha,precoFiltro])

  const tipologia=tipologias.find(t=>t.id===tipologiaId)
  const linhasDaTipologia=tipologia?linhasTecnicas.filter(l=>(l.tipologia_ids||[]).includes(tipologia.id)):[]
  const tipologiasFiltradas=tipologias.filter(t=>normaliza(t.label+' '+t.chave).includes(normaliza(buscaTipologia))).slice(0,70)
  const valorConhecido=itens.reduce((s,i)=>s+(unitario(i.produto)||0)*i.quantidade,0)
  const semPreco=itens.filter(i=>unitario(i.produto)==null).length
  const totalQtd=itens.reduce((s,i)=>s+i.quantidade,0)
  function adicionarProduto(p:Produto){setItens(a=>{const i=a.find(x=>x.produto.id===p.id);return i?a.map(x=>x.produto.id===p.id?{...x,quantidade:x.quantidade+1}:x):[...a,{produto:p,quantidade:1}]});setAviso('')}
  function qtdProduto(id:string,valor:number){if(!Number.isInteger(valor)||valor<1||valor>99999)return;setItens(a=>a.map(x=>x.produto.id===id?{...x,quantidade:valor}:x))}
  function adicionarSobMedida(){
    if(!tipologia){setAviso('Escolha uma tipologia cadastrada para continuar.');return}
    if(!Number(largura)||!Number(altura)||Number(largura)<=0||Number(altura)<=0){setAviso('Informe largura e altura válidas em milímetros.');return}
    if(!Number.isInteger(Number(qtdMedida))||Number(qtdMedida)<1){setAviso('Informe a quantidade da tipologia.');return}
    setMedidas(a=>[...a,{id:idNovo(),tipologia,linha:linhaSobMedida,largura,altura,folhas,cor,vidro,contramarco,quantidade:Number(qtdMedida)}])
    setAviso('')
  }
  function revisar(){
    if(modo==='sob_medida'&&!medidas.length){setAviso('Adicione pelo menos uma tipologia sob medida.');return}
    if(modo==='produtos'&&!itens.length){setAviso('Adicione pelo menos um produto.');return}
    setAviso('');setRevisao(true)
  }
  function escolherModo(v:Modo){setModo(v);setRevisao(false);setAviso('')}
  function limparFiltros(){setBusca('');setCategoria('todos');setLinha('');setPrecoFiltro('todos')}
  return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-14 pt-5 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-[1410px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Link href="/" className="rounded-xl border bg-white p-2.5" aria-label="Voltar à Home"><ArrowLeft size={19}/></Link>
          <div><p className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-700">Atlas One / Comercial / Prévia</p>
            <h1 className="text-2xl font-black sm:text-3xl">Orçamento</h1>
            <p className="text-sm text-slate-500">Escolha entre orçamento sob medida e orçamento de produtos prontos ou avulsos.</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">PRÉVIA · SEM GERAR ORÇAMENTO REAL</span>
      </header>

      {modo==='escolher'&&<section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-xl font-black">Qual orçamento você deseja fazer?</h2>
        <p className="mt-1 text-sm text-slate-500">O Pedido de Orçamento (atendimento/obra) continua no atalho próprio da Home. Aqui você monta uma proposta detalhada.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <button type="button" onClick={()=>escolherModo('sob_medida')} className="group rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-6 text-left hover:border-indigo-600">
            <DraftingCompass size={32} className="text-indigo-700"/><h3 className="mt-4 text-lg font-black">Orçamento sob medida</h3>
            <p className="mt-2 text-sm text-slate-600">Selecione tipologias existentes, linha, dimensões, folhas, cor, vidro, contramarco e quantidade. Adicione também perfis, acessórios, vidros e outros produtos ao mesmo orçamento.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-700">Montar sob medida <ArrowRight size={17}/></span>
          </button>
          <button type="button" onClick={()=>escolherModo('produtos')} className="group rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left hover:border-emerald-600">
            <Package size={32} className="text-emerald-700"/><h3 className="mt-4 text-lg font-black">Orçamento de produtos</h3>
            <p className="mt-2 text-sm text-slate-600">Orce produtos prontos, acessórios, perfis, vidros e materiais unitários por código, descrição, categoria e linha técnica, utilizando os preços cadastrados.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Montar com produtos <ArrowRight size={17}/></span>
          </button>
        </div>
      </section>}

      {modo!=='escolher'&&<>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div><p className="text-[11px] font-bold text-indigo-600">Tipo selecionado</p><b>{modo==='sob_medida'?'Orçamento sob medida + produtos':'Orçamento de produtos prontos e avulsos'}</b></div>
          <button type="button" onClick={()=>escolherModo('escolher')} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold">Alterar tipo</button>
        </div>
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black">Identificação do orçamento</h2>
          <p className="mt-1 text-xs text-slate-500">Escolha um cliente existente ou informe um nome apenas para esta simulação.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Cliente / responsável<input className={baseInput+' mt-1'} value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nome do cliente"/></label>
            <div><label className="text-xs font-bold text-slate-600">Localizar cliente cadastrado<input className={baseInput+' mt-1'} value={buscaCliente} onChange={e=>{setBuscaCliente(e.target.value);setCliente('')}} placeholder="Buscar por nome ou WhatsApp"/></label>
              {!!clientes.length&&<div className="mt-1 max-h-40 overflow-y-auto rounded-lg border bg-white">{clientes.map(x=><button type="button" key={x.id} className="block w-full border-b p-2 text-left text-xs hover:bg-blue-50" onClick={()=>{setCliente(x.nome);setBuscaCliente('');setClientes([])}}><b>{x.nome}</b> · {x.cidade||'Cidade não informada'}</button>)}</div>}
            </div>
          </div>
        </section>

        {!revisao&&modo==='sob_medida'&&<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2"><DraftingCompass size={20} className="text-indigo-700"/><h2 className="text-lg font-black">1. Configurar tipologia sob medida</h2></div>
          <p className="mt-1 text-xs text-slate-500">As tipologias e linhas vêm do catálogo existente. Os campos abaixo representam a escolha das variáveis; o cálculo técnico definitivo ainda não é executado nesta prévia.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Procurar tipologia<input className={baseInput+' mt-1'} placeholder="Ex.: janela, porta, box..." value={buscaTipologia} onChange={e=>setBuscaTipologia(e.target.value)}/></label>
            <label className="text-xs font-bold text-slate-700">Tipologia<select className={baseInput+' mt-1'} value={tipologiaId} onChange={e=>{setTipologiaId(e.target.value);setLinhaSobMedida('')}}>
              <option value="">Selecione a tipologia cadastrada</option>
              {tipologiasFiltradas.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select></label>
            <label className="text-xs font-bold text-slate-700">Linha técnica da tipologia<select className={baseInput+' mt-1'} value={linhaSobMedida} onChange={e=>setLinhaSobMedida(e.target.value)} disabled={!tipologia}>
              <option value="">Selecione / a definir</option>{linhasDaTipologia.map(l=><option value={l.nome} key={l.id}>{l.nome}</option>)}
            </select></label>
            <label className="text-xs font-bold text-slate-700">Quantidade de peças<input className={baseInput+' mt-1'} type="number" min="1" max="99999" value={qtdMedida} onChange={e=>setQtdMedida(e.target.value)}/></label>
            <label className="text-xs font-bold text-slate-700">Largura (mm)<input className={baseInput+' mt-1'} type="number" min="1" value={largura} onChange={e=>setLargura(e.target.value)} placeholder="Informe largura"/></label>
            <label className="text-xs font-bold text-slate-700">Altura (mm)<input className={baseInput+' mt-1'} type="number" min="1" value={altura} onChange={e=>setAltura(e.target.value)} placeholder="Informe altura"/></label>
            <label className="text-xs font-bold text-slate-700">Número de folhas<input className={baseInput+' mt-1'} value={folhas} onChange={e=>setFolhas(e.target.value)} placeholder="Ex.: 2"/></label>
            <label className="text-xs font-bold text-slate-700">Cor / acabamento<input className={baseInput+' mt-1'} value={cor} onChange={e=>setCor(e.target.value)} placeholder="Escolher acabamento"/></label>
            <label className="text-xs font-bold text-slate-700">Vidro / especificação<input className={baseInput+' mt-1'} value={vidro} onChange={e=>setVidro(e.target.value)} placeholder="Especificar vidro"/></label>
            <label className="text-xs font-bold text-slate-700">Contramarco<select className={baseInput+' mt-1'} value={contramarco} onChange={e=>setContramarco(e.target.value)}><option value="a_definir">A definir</option><option value="com">Com contramarco</option><option value="sem">Sem contramarco</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-amber-800">O valor da tipologia será definido pelo módulo técnico de precificação, não pela margem de produtos unitários.</p>
            <button type="button" onClick={adicionarSobMedida} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white"><Plus size={17}/> Adicionar tipologia</button>
          </div>
          {!!medidas.length&&<div className="mt-4 space-y-2 border-t pt-4"><h3 className="text-sm font-black">Tipologias adicionadas ({medidas.length})</h3>{medidas.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3"><div><b className="text-sm">{m.tipologia.label}</b><p className="text-xs text-slate-500">{m.quantidade} × {m.largura} × {m.altura} mm · {m.linha||'Linha a definir'} · {m.folhas} folha(s)</p><p className="mt-1 text-[11px] font-bold text-amber-700">Valor sob medida: a precificar</p></div><button type="button" aria-label="Remover tipologia" onClick={()=>setMedidas(a=>a.filter(x=>x.id!==m.id))} className="rounded-lg border p-2 text-red-600"><Trash2 size={16}/></button></div>)}</div>}
        </section>}

        {!revisao&&<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Search size={19} className="text-blue-700"/> {modo==='sob_medida'?'2. Adicionar produtos ao orçamento':'Selecionar produtos para orçamento'}</h2>
            <p className="mt-1 text-xs text-slate-500">Pesquise perfis, acessórios, vidros ou produtos prontos por nome, código ou descrição. Fotos reais do catálogo.</p>
            <div className="relative mt-4"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input className={baseInput+' pl-10'} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar código, descrição ou nome..."/></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{categorias.map(x=><button type="button" key={x.id} onClick={()=>{setCategoria(x.id);setLinha('')}} className={'rounded-lg border px-2 py-2.5 text-xs font-bold '+(categoria===x.id?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-slate-50')}>{x.label}</button>)}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label className="text-xs font-bold text-slate-600">Linha técnica<select className={baseInput+' mt-1'} value={linha} onChange={e=>setLinha(e.target.value)}><option value="">Todas as linhas</option>{linhas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600">Preço<select className={baseInput+' mt-1'} value={precoFiltro} onChange={e=>setPrecoFiltro(e.target.value as 'todos'|'com'|'sem')}><option value="todos">Todos</option><option value="com">Com preço</option><option value="sem">Sem preço</option></select></label>
              <button type="button" onClick={limparFiltros} className="rounded-xl border px-4 py-2.5 text-xs font-bold"><SlidersHorizontal size={14} className="mr-1 inline"/> Limpar</button>
            </div>
            {carregando&&<p className="mt-3 text-xs text-slate-500">Carregando catálogo...</p>}
            {erro&&<p role="alert" className="mt-3 text-xs text-red-700">{erro}</p>}
            {!carregando&&!erro&&!produtos.length&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Nenhum produto encontrado para esta seleção.</p>}
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{produtos.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
              <FotoProdutoPreview nome={p.nome} fotoUrl={p.fotoUrl} fotoCandidataUrl={p.fotoCandidataUrl} tamanho="pequeno"/>
              <div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{p.nome}</b><p className="mt-1 text-[11px] text-slate-500">{p.codigo||'Sem código'} · {p.unidade}{p.linha?' · '+p.linha:''}</p><p className={unitario(p)!=null?'mt-1 text-sm font-extrabold text-blue-700':'mt-1 text-xs font-bold text-amber-700'}>{unitario(p)!=null?moeda(unitario(p)!):'Preço a cadastrar'}</p></div>
              <button type="button" onClick={()=>adicionarProduto(p)} aria-label={'Adicionar '+p.nome} className="rounded-lg bg-blue-700 p-2.5 text-white"><Plus size={18}/></button>
            </div>)}</div>
          </section>
          <aside className="rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <h3 className="flex items-center gap-2 font-black"><ClipboardList size={19} className="text-blue-700"/> Itens do orçamento <span className="ml-auto rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{totalQtd}</span></h3>
            {!itens.length&&<p className="mt-4 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">Nenhum produto adicional selecionado.</p>}
            <div className="mt-3 space-y-3">{itens.map(i=><div key={i.produto.id} className="border-b pb-3">
              <b className="block text-xs">{i.produto.nome}</b><p className="mt-1 text-[11px] text-slate-500">{unitario(i.produto)!=null?moeda(unitario(i.produto)!):'Preço pendente'} / {i.produto.unidade}</p>
              <div className="mt-2 flex items-center gap-2"><label htmlFor={'qtd-orc-'+i.produto.id} className="text-xs font-semibold">Qtd.</label>
                <input id={'qtd-orc-'+i.produto.id} className="w-20 rounded-lg border px-2 py-1.5 text-center text-sm font-bold" type="number" min="1" max="99999" value={i.quantidade} onChange={e=>qtdProduto(i.produto.id,Number(e.target.value))}/>
                <button type="button" aria-label="Remover item" onClick={()=>setItens(a=>a.filter(x=>x.produto.id!==i.produto.id))} className="ml-auto p-1 text-red-600"><Trash2 size={16}/></button>
              </div>
            </div>)}</div>
            <div className="mt-4 border-t pt-3">
              <div className="flex justify-between text-sm"><span>Subtotal dos produtos com preço</span><b>{moeda(valorConhecido)}</b></div>
              {semPreco>0&&<p className="mt-2 text-[11px] font-semibold text-amber-800">{semPreco} produto(s) sem preço cadastrado. O total não é definitivo.</p>}
              {modo==='sob_medida'&&<p className="mt-2 text-[11px] font-semibold text-amber-800">As {medidas.length} tipologia(s) sob medida serão precificadas pelo cálculo próprio, separadamente.</p>}
            </div>
            <button type="button" onClick={revisar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white">Revisar orçamento <ArrowRight size={17}/></button>
          </aside>
        </div>}

        {revisao&&<section className="mx-auto max-w-4xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={24}/></div>
          <h2 className="mt-3 text-center text-xl font-black">Revisão da proposta — Simulação</h2>
          <p className="mt-1 text-center text-xs text-slate-500">Nenhum orçamento será salvo, enviado ao cliente ou convertido em pedido.</p>
          <div className="mt-5 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <p><span className="block text-xs text-slate-500">Cliente</span><b>{cliente||'Cliente a identificar'}</b></p>
            <p><span className="block text-xs text-slate-500">Tipo de orçamento</span><b>{modo==='sob_medida'?'Sob medida + produtos':'Produtos prontos / avulsos'}</b></p>
          </div>
          {!!medidas.length&&<section className="mt-5"><h3 className="mb-2 font-black">Tipologias sob medida ({medidas.length})</h3>{medidas.map(m=><div key={m.id} className="mt-2 flex justify-between gap-4 border-b pb-3 text-xs"><div><b>{m.quantidade} × {m.tipologia.label}</b><p className="mt-1 text-slate-500">{m.largura} × {m.altura} mm · {m.folhas} folha(s) · {m.linha||'Linha pendente'} · {m.cor||'Cor a definir'} · {m.vidro||'Vidro a definir'} · Contramarco: {m.contramarco}</p></div><span className="shrink-0 font-bold text-amber-700">A precificar</span></div>)}</section>}
          {!!itens.length&&<section className="mt-5"><h3 className="mb-2 font-black">Produtos ({itens.length})</h3>{itens.map(i=><div key={i.produto.id} className="mt-2 flex justify-between gap-3 border-b pb-3 text-xs"><div><b>{i.quantidade} × {i.produto.nome}</b><p className="text-slate-500">{i.produto.codigo} · {i.produto.unidade}</p></div><b>{unitario(i.produto)!=null?moeda(unitario(i.produto)!*i.quantidade):'Sem preço'}</b></div>)}</section>}
          <div className="mt-5 rounded-xl bg-blue-50 p-4"><div className="flex justify-between font-black"><span>Subtotal conhecido dos produtos</span><span>{moeda(valorConhecido)}</span></div>
            {(medidas.length>0||semPreco>0)&&<p className="mt-2 text-xs font-bold text-amber-800">Total da proposta pendente: tipologias e/ou produtos sem preço dependem de precificação. Nenhum valor foi inventado.</p>}
          </div>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <b>Somente prévia:</b> as variáveis ainda não executam fórmulas de engenharia, corte, perdas ou margem de tipologias. A integração definitiva será feita depois da sua aprovação.
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={()=>setRevisao(false)} className="rounded-xl border px-4 py-3 text-xs font-bold">Voltar para editar</button><button type="button" onClick={()=>{setModo('escolher');setMedidas([]);setItens([]);setRevisao(false);setCliente('')}} className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white">Nova simulação</button></div>
        </section>}
      </>}
    </div>
  </main>
}
