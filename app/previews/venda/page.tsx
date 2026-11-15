'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, FilePlus2, ImageOff, MapPin, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, UserPlus, UsersRound, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Cliente={id:string;nome:string;apelido?:string|null;cpf_cnpj?:string|null;telefone?:string|null;whatsapp?:string|null;cidade?:string|null}
type Obra={id:string;nome:string;cidade?:string|null;bairro?:string|null;endereco?:string|null}
type Produto={id:string;codigo:string;nome:string;descricao:string;categoria:string;unidade:string;linha:string|null;fotoUrl:string|null;preco:number|null;precoPromocional:number|null}
type Item={produto:Produto;quantidade:number}
type Modo='cadastrado'|'novo'|'consumidor'
type Etapa=1|2|3
type Cadastro={nome:string;cpfCnpj:string;telefone:string;email:string;cep:string;rua:string;numero:string;bairro:string;cidade:string;uf:string}
const novoCadastro:Cadastro={nome:'',cpfCnpj:'',telefone:'',email:'',cep:'',rua:'',numero:'',bairro:'',cidade:'',uf:''}
const c='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const preco=(p:Produto)=>p.precoPromocional!=null&&p.precoPromocional>0?p.precoPromocional:p.preco
function Foto({p}:{p:Produto}){return <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{p.fotoUrl&&/^https?:\/\//i.test(p.fotoUrl)?<img src={p.fotoUrl} alt={p.nome} loading="lazy" className="h-full w-full object-contain"/>:<div className="text-center text-slate-400"><ImageOff size={17} className="mx-auto"/><span className="text-[8px]">Sem foto</span></div>}</div>}

export default function PreviaVenda(){
 const [etapa,setEtapa]=useState<Etapa>(1)
 const [modo,setModo]=useState<Modo>('cadastrado'),[buscaCliente,setBuscaCliente]=useState('')
 const [clientes,setClientes]=useState<Cliente[]>([]),[cliente,setCliente]=useState<Cliente|null>(null)
 const [cadastro,setCadastro]=useState<Cadastro>(novoCadastro),[errosCadastro,setErrosCadastro]=useState('')
 const [obras,setObras]=useState<Obra[]>([]),[obraId,setObraId]=useState('')
 const [consultaClientes,setConsultaClientes]=useState(false),[erroClientes,setErroClientes]=useState('')
 const [buscaProduto,setBuscaProduto]=useState(''),[catalogo,setCatalogo]=useState<Produto[]>([])
 const [consultaProdutos,setConsultaProdutos]=useState(false),[erroProdutos,setErroProdutos]=useState('')
 const [itens,setItens]=useState<Item[]>([]),[pagamento,setPagamento]=useState('pix')
 const [aviso,setAviso]=useState('')
 const [cadastroAberto,setCadastroAberto]=useState(false)

 useEffect(()=>{
   if(modo!=='cadastrado'||buscaCliente.trim().length<2||cliente){setClientes([]);setConsultaClientes(false);return}
   const ctrl=new AbortController()
   const timer=setTimeout(()=>{
     void (async()=>{
       setConsultaClientes(true);setErroClientes('')
       try{
         const t=await tokenAtual();if(!t)throw Error('Sessão expirada')
         const r=await fetch('/api/previews/comercial?tipo=clientes&q='+encodeURIComponent(buscaCliente.trim()),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
         const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível buscar clientes.')
         setClientes(j.clientes||[])
       }catch(e){if((e as {name?:string})?.name!=='AbortError')setErroClientes(e instanceof Error?e.message:'Erro na pesquisa.')}
       finally{if(!ctrl.signal.aborted)setConsultaClientes(false)}
     })()
   },220)
   return()=>{ctrl.abort();clearTimeout(timer)}
 },[buscaCliente,modo,cliente])

 useEffect(()=>{
   setObras([]);setObraId('')
   if(!cliente?.id || modo==='consumidor'||cliente.id.startsWith('previa:'))return
   let vivo=true
   void (async()=>{
     try{
       const t=await tokenAtual();if(!t)return
       const r=await fetch('/api/previews/comercial?tipo=obras&clienteId='+encodeURIComponent(cliente.id),{headers:{Authorization:'Bearer '+t},cache:'no-store'})
       const j=await r.json();if(vivo&&r.ok)setObras(j.obras||[])
     }catch{}
   })()
   return()=>{vivo=false}
 },[cliente?.id,modo])

 useEffect(()=>{
   if(etapa!==2){setCatalogo([]);return}
   const ctrl=new AbortController()
   const timer=setTimeout(()=>{
     void (async()=>{
       setConsultaProdutos(true);setErroProdutos('')
       try{
         const t=await tokenAtual();if(!t)throw Error('Sessão expirada')
         const r=await fetch('/api/previews/comercial?tipo=produtos&q='+encodeURIComponent(buscaProduto),{headers:{Authorization:'Bearer '+t},signal:ctrl.signal,cache:'no-store'})
         const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível consultar produtos')
         if(!ctrl.signal.aborted)setCatalogo(j.produtos||[])
       }catch(e){if((e as {name?:string})?.name!=='AbortError')setErroProdutos(e instanceof Error?e.message:'Erro na pesquisa.')}
       finally{if(!ctrl.signal.aborted)setConsultaProdutos(false)}
     })()
   },buscaProduto?240:60)
   return()=>{ctrl.abort();clearTimeout(timer)}
 },[etapa,buscaProduto])

 const nomeCliente=modo==='consumidor'?'Consumidor final':cliente?.nome||cadastro.nome||'Nenhum cliente selecionado'
 const escolhido=obras.find(o=>o.id===obraId)
 const total=useMemo(()=>itens.reduce((sum,i)=>sum+(preco(i.produto)||0)*i.quantidade,0),[itens])
 const pendentes=itens.filter(i=>preco(i.produto)==null).length
 const totalQtd=itens.reduce((sum,i)=>sum+i.quantidade,0)
 function alterarQuantidade(id:string, delta:number){
   setItens(atual=>atual.map(i=>i.produto.id===id?{...i,quantidade:Math.max(0,i.quantidade+delta)}:i).filter(i=>i.quantidade>0))
 }
 function incluir(p:Produto){setItens(atual=>{const achou=atual.find(i=>i.produto.id===p.id);return achou?atual.map(i=>i.produto.id===p.id?{...i,quantidade:i.quantidade+1}:i):[...atual,{produto:p,quantidade:1}]})}
 function modoNovo(m:Modo){
   setModo(m);setCliente(null);setObraId('');setBuscaCliente('');setClientes([]);setAviso('');setCadastroAberto(m==='novo')
 }
 function cadastrarPrevia(){
   const obrig=[cadastro.nome,cadastro.cpfCnpj,cadastro.telefone,cadastro.rua,cadastro.numero,cadastro.bairro,cadastro.cidade,cadastro.uf]
   if(obrig.some(v=>!v.trim()))return setErrosCadastro('Para vincular uma venda ao cliente, preencha os dados marcados com *.')
   setCliente({id:'previa:'+Date.now(),nome:cadastro.nome.trim(),cpf_cnpj:cadastro.cpfCnpj.trim(),telefone:cadastro.telefone.trim(),cidade:cadastro.cidade.trim()})
   setErrosCadastro('');setCadastroAberto(false);setAviso('Cliente preenchido somente nesta prévia: não foi salvo no cadastro real.')
 }
 function prosseguir(){
   if(modo!=='consumidor'&&!cliente){setAviso('Escolha um cliente existente ou preencha o cadastro completo para continuar.');return}
   setAviso('');setEtapa(2)
 }
 function revisar(){
   if(!itens.length){setAviso('Adicione ao menos um produto para montar a prévia da venda.');return}
   setAviso('');setEtapa(3)
 }
 function voltar(){setAviso('');setEtapa(etapa===3?2:1)}
 const etapas=[{n:1,t:'Cliente e vínculo'},{n:2,t:'Itens e pagamento'},{n:3,t:'Revisar venda'}] as const
 return <main className="min-h-screen bg-[#f3f6fb] px-3 pb-16 pt-5 text-slate-900 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-[1410px] space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3">
     <div className="flex items-center gap-3"><Link href="/" aria-label="Voltar ao início" className="rounded-xl border bg-white p-2.5 text-slate-600 hover:bg-blue-50"><ArrowLeft size={19}/></Link>
       <div><p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Atlas One / Comercial / Prévia</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Nova Venda</h1><p className="text-xs text-slate-500 sm:text-sm">Primeiro o cliente. Depois a obra, os produtos e a forma de pagamento.</p></div></div>
     <div className="flex items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">PRÉVIA · SEM GRAVAR VENDAS</span><Link href="/previews/consulta-preco" className="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold hover:bg-blue-50">Consulta de Preço</Link></div>
   </header>
   <nav aria-label="Etapas da venda" className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-2 shadow-sm">
     {etapas.map(e=><div key={e.n} className={'flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-[11px] font-bold sm:text-sm '+(etapa===e.n?'bg-blue-700 text-white':etapa>e.n?'bg-emerald-50 text-emerald-700':'text-slate-400')}><span className={'grid h-6 w-6 shrink-0 place-items-center rounded-full '+(etapa===e.n?'bg-white/20':etapa>e.n?'bg-emerald-200':'bg-slate-100')}>{etapa>e.n?<Check size={13}/>:e.n}</span>{e.t}</div>)}
   </nav>
   {aviso&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">{aviso}</p>}
   {etapa===1&&<>
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black"><UsersRound size={21} className="text-blue-700"/> Como será esta venda?</h2>
      <p className="mt-1 text-xs text-slate-500">Escolha o atendimento. Para vincular ou registrar a venda no histórico do cliente, é necessário cadastro completo.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {([{id:'cadastrado',titulo:'Cliente cadastrado',descricao:'Buscar um cliente no Atlas e escolher uma obra, se houver.',ico:'👤'},
           {id:'novo',titulo:'Cadastrar cliente',descricao:'Preencher o cadastro completo durante o atendimento.',ico:'📝'},
           {id:'consumidor',titulo:'Venda comum',descricao:'Consumidor final, sem vínculo de cliente ou obra.',ico:'🛍️'}] as const).map(m=>
          <button type="button" key={m.id} aria-pressed={modo===m.id} onClick={()=>modoNovo(m.id)} className={'rounded-2xl border-2 p-4 text-left transition '+(modo===m.id?'border-blue-600 bg-blue-50':'border-slate-200 hover:border-blue-300')}>
            <span className="text-2xl">{m.ico}</span><b className="mt-3 block text-sm">{m.titulo}</b><span className="mt-1 block text-xs leading-relaxed text-slate-500">{m.descricao}</span><span className={'mt-4 inline-flex items-center gap-1 text-xs font-bold '+(modo===m.id?'text-blue-700':'text-slate-400')}>{modo===m.id?'Selecionado':'Selecionar'} <ChevronRight size={14}/></span>
          </button>)}
      </div>
    </section>
    {modo==='cadastrado'&&<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 font-black"><Search size={19} className="text-blue-700"/> Localizar cliente</h3>
      <p className="mt-1 text-xs text-slate-500">Pesquise por nome, apelido, CPF/CNPJ ou telefone no cadastro real (somente leitura).</p>
      {cliente?<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><div><b className="text-sm">{cliente.nome}</b><p className="mt-1 text-xs text-blue-800">{cliente.cpf_cnpj||'Documento não informado'} · {cliente.cidade||'Cidade não informada'}</p></div><button type="button" onClick={()=>{setCliente(null);setBuscaCliente('');setObraId('')}} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Trocar cliente</button></div>:
      <><div className="relative mt-3"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input autoComplete="off" value={buscaCliente} onInput={e=>setBuscaCliente(e.currentTarget.value)} placeholder="Digite pelo menos 2 letras para procurar..." className={c+' pl-10'}/></div>
      {consultaClientes&&<p className="mt-2 text-xs text-slate-500">Procurando cliente...</p>}
      {erroClientes&&<p role="alert" className="mt-2 text-xs text-red-700">{erroClientes}</p>}
      {clientes.length>0&&<div className="mt-2 max-h-64 overflow-y-auto rounded-xl border">{clientes.map(p=><button key={p.id} type="button" onClick={()=>{setCliente(p);setClientes([]);setAviso('')}} className="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-blue-50 last:border-b-0"><span><b className="block text-sm">{p.nome}</b><span className="text-xs text-slate-500">{p.cpf_cnpj||p.telefone||p.whatsapp||'Sem documento/telefone'}{p.cidade?' · '+p.cidade:''}</span></span><ChevronRight size={16}/></button>)}</div>}
      {buscaCliente.length>=2&&!consultaClientes&&!clientes.length&&!erroClientes&&<p className="mt-3 text-xs text-slate-500">Não encontrou? Use <button type="button" onClick={()=>modoNovo('novo')} className="font-bold text-blue-700 underline">Cadastrar cliente agora</button>.</p>}</>}
    </section>}
    {modo==='novo'&&<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black"><UserPlus size={19} className="text-blue-700"/> Cadastro completo do cliente</h3><p className="mt-1 text-xs text-slate-500">Dados necessários para o histórico e para vendas vinculadas.</p></div><button type="button" onClick={()=>setCadastroAberto(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white">{cliente?'Editar dados':'Abrir cadastro'}</button></div>
      {cliente&&<div className="mt-4 rounded-xl bg-emerald-50 p-4"><b className="text-sm text-emerald-800">{cliente.nome}</b><p className="mt-1 text-xs text-emerald-700">Cadastro preenchido para a prévia, sem gravar no Atlas.</p></div>}
    </section>}
    {modo==='consumidor'&&<section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-3"><ShoppingBag size={28} className="text-emerald-700"/><div><h3 className="font-black text-emerald-900">Venda comum · Consumidor final</h3><p className="mt-1 text-xs text-emerald-800">Não precisa cadastrar cliente. Sem vínculo de obra; para boleto, venda a prazo ou acompanhamento identificado, selecione um cliente cadastrado.</p></div></div></section>}
    {modo!=='consumidor'&&cliente&&<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 font-black"><MapPin size={19} className="text-blue-700"/> Vincular a alguma obra?</h3><p className="mt-1 text-xs text-slate-500">Opcional: pode vender normalmente no cadastro do cliente, sem escolher uma obra.</p>
      <div className="mt-4 space-y-2">
        <label className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm '+(!obraId?'border-blue-500 bg-blue-50':'border-slate-200')}><input type="radio" name="obra" checked={!obraId} onChange={()=>setObraId('')}/> Venda comum vinculada ao cliente, sem obra</label>
        {obras.map(o=><label key={o.id} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm '+(obraId===o.id?'border-blue-500 bg-blue-50':'border-slate-200')}><input type="radio" name="obra" checked={obraId===o.id} onChange={()=>setObraId(o.id)}/><span><b>{o.nome}</b><span className="ml-2 text-xs text-slate-500">{o.cidade||''}</span></span></label>)}
        {!obras.length&&<p className="text-xs text-slate-500">Não há obras vinculadas disponíveis para seleção nesta prévia.</p>}
      </div>
    </section>}
    <div className="flex justify-end"><button type="button" onClick={prosseguir} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-extrabold text-white hover:bg-blue-800">Continuar para os produtos <ArrowRight size={17}/></button></div>
   </>}
   {etapa===2&&<>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><div><p className="text-[11px] font-bold text-blue-600">Atendimento</p><b className="text-sm text-blue-950">{nomeCliente}</b><p className="text-xs text-blue-800">{modo==='consumidor'?'Venda sem cadastro':escolhido?'Obra: '+escolhido.nome:'Venda no cadastro do cliente · sem obra'}</p></div><button type="button" onClick={voltar} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold">Alterar cliente/obra</button></div>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-black"><Search size={19} className="text-blue-700"/> Selecionar produtos</h2>
        <p className="mt-1 text-xs text-slate-500">Busque pelo código ou descrição. Os preços são os cadastrados atualmente no Atlas.</p>
        <div className="relative mt-4"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={buscaProduto} onInput={e=>setBuscaProduto(e.currentTarget.value)} placeholder="Perfil, acessório, vidro, produto pronto..." className={c+' pl-10'}/></div>
        {consultaProdutos&&<p className="mt-3 text-xs text-slate-500">Buscando itens...</p>}
        {erroProdutos&&<p className="mt-3 text-xs text-red-700">{erroProdutos}</p>}
        {!consultaProdutos&&!erroProdutos&&!catalogo.length&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Nenhum item para essa busca. Experimente outro termo.</p>}
        <div className="mt-3 max-h-[570px] space-y-2 overflow-y-auto">
        {catalogo.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
          <Foto p={p}/><div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{p.nome}</b><p className="mt-1 text-[11px] text-slate-500">{p.codigo||'Sem código'} · {p.unidade}</p><p className={preco(p)!=null?'mt-1 text-sm font-extrabold text-blue-700':'mt-1 text-xs font-bold text-amber-700'}>{preco(p)!=null?moeda(preco(p)!):'Preço a cadastrar'}</p></div>
          <button type="button" onClick={()=>incluir(p)} aria-label={'Adicionar '+p.nome} className="shrink-0 rounded-lg bg-blue-700 p-2.5 text-white hover:bg-blue-800"><Plus size={18}/></button>
        </div>)}
        </div>
      </section>
      <aside className="rounded-2xl border bg-white p-4 shadow-sm sm:sticky sm:top-4">
        <h3 className="flex items-center gap-2 font-black"><ShoppingCart size={19} className="text-blue-700"/> Itens da venda <span className="ml-auto rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{totalQtd}</span></h3>
        {!itens.length&&<div className="mt-4 grid min-h-36 place-items-center rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Seu carrinho está vazio. Escolha itens à esquerda.</div>}
        <div className="mt-3 space-y-3">{itens.map(i=><div key={i.produto.id} className="border-b pb-3 last:border-0"><div className="flex gap-2"><Foto p={i.produto}/><div className="min-w-0 flex-1"><b className="block line-clamp-2 text-xs">{i.produto.nome}</b><p className="mt-1 text-[11px] text-slate-500">{preco(i.produto)!=null?moeda(preco(i.produto)!):'Preço pendente'} /{i.produto.unidade}</p>
          <div className="mt-2 flex items-center gap-1"><button type="button" aria-label="Diminuir quantidade" onClick={()=>alterarQuantidade(i.produto.id,-1)} className="rounded border p-1.5"><Minus size={13}/></button><span className="min-w-7 text-center text-xs font-bold">{i.quantidade}</span><button type="button" aria-label="Aumentar quantidade" onClick={()=>alterarQuantidade(i.produto.id,1)} className="rounded border p-1.5"><Plus size={13}/></button><button type="button" aria-label="Remover item" onClick={()=>setItens(a=>a.filter(x=>x.produto.id!==i.produto.id))} className="ml-auto rounded p-1.5 text-red-600"><Trash2 size={14}/></button></div></div></div></div>)}</div>
        <div className="mt-4 border-t pt-4"><p className="flex justify-between text-xs text-slate-500"><span>Itens</span><b>{totalQtd}</b></p><div className="mt-2 flex justify-between"><b>Total conhecido</b><b className="text-xl text-blue-800">{moeda(total)}</b></div>{pendentes>0&&<p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{pendentes} item(ns) sem preço cadastrado. O total só ficará completo após a precificação.</p>}</div>
        <div className="mt-4"><label className="mb-1.5 block text-xs font-bold text-slate-600">Forma de pagamento (prévia)</label><select className={c} value={pagamento} onChange={e=>setPagamento(e.target.value)}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option>{modo!=='consumidor'&&<><option value="boleto">Boleto</option><option value="prazo">A prazo</option></>}</select></div>
        <button type="button" onClick={revisar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-800">Revisar venda <ArrowRight size={17}/></button>
      </aside>
    </div>
   </>}
   {etapa===3&&<section className="mx-auto max-w-3xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
     <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardCheck size={28}/></div>
     <h2 className="mt-3 text-center text-xl font-black">Revisão da venda</h2><p className="mt-1 text-center text-xs text-slate-500">Confira como a venda ficará antes de implementar a gravação definitiva.</p>
     <div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
       <p><span className="block text-xs text-slate-500">Cliente / consumidor</span><b>{nomeCliente}</b></p>
       <p><span className="block text-xs text-slate-500">Vínculo</span><b>{modo==='consumidor'?'Venda comum ao consumidor':escolhido?'Obra: '+escolhido.nome:'Cadastro do cliente sem obra'}</b></p>
       <p><span className="block text-xs text-slate-500">Forma de pagamento</span><b>{({pix:'PIX',dinheiro:'Dinheiro',debito:'Cartão de débito',credito:'Cartão de crédito',boleto:'Boleto',prazo:'A prazo'} as Record<string,string>)[pagamento]}</b></p>
       <p><span className="block text-xs text-slate-500">Itens</span><b>{totalQtd} unidade(s) · {itens.length} produto(s)</b></p>
     </div>
     <div className="mt-5 space-y-3">{itens.map(i=><div key={i.produto.id} className="flex justify-between gap-3 border-b pb-3 text-sm"><span><b>{i.quantidade} × {i.produto.nome}</b><span className="block text-xs text-slate-500">{i.produto.codigo||'Sem código'}</span></span><b className="shrink-0">{preco(i.produto)!=null?moeda(preco(i.produto)!*i.quantidade):'A precificar'}</b></div>)}</div>
     <div className="mt-5 flex items-center justify-between rounded-xl bg-blue-50 p-4"><b>Total conhecido</b><b className="text-2xl font-black text-blue-900">{moeda(total)}</b></div>
     {pendentes>0&&<p className="mt-3 text-xs text-amber-800">Existem itens sem preço cadastrado, portanto este não é o total final.</p>}
     <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><b>Prévia sem movimentação:</b> nenhum cliente, venda, pagamento, estoque ou obra será alterado ao navegar aqui. A efetivação da venda será implementada após sua aprovação da tela.</div>
     <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={voltar} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold">Voltar e ajustar</button><button type="button" onClick={()=>{setEtapa(1);setItens([]);setCliente(null);setBuscaCliente('');setObraId('');setModo('cadastrado');setAviso('')}} className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white">Iniciar nova simulação</button></div>
   </section>}
  </div>
  {cadastroAberto&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Cadastro completo do cliente" onClick={()=>setCadastroAberto(false)}>
    <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">Cadastro de cliente · Prévia</p><h2 className="text-xl font-black">Novo cliente</h2><p className="mt-1 text-xs text-slate-500">Campos marcados com * serão necessários para a venda vinculada.</p></div><button aria-label="Fechar" type="button" onClick={()=>setCadastroAberto(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {([{k:'nome',l:'Nome / Razão social *'},{k:'cpfCnpj',l:'CPF / CNPJ *'},{k:'telefone',l:'Telefone / WhatsApp *'},{k:'email',l:'E-mail'},{k:'cep',l:'CEP'},{k:'rua',l:'Rua / avenida *'},{k:'numero',l:'Número *'},{k:'bairro',l:'Bairro *'},{k:'cidade',l:'Cidade *'},{k:'uf',l:'Estado (UF) *'}] as const).map(x=><label key={x.k} className="text-xs font-semibold text-slate-600">{x.l}<input value={cadastro[x.k]} onChange={e=>setCadastro(v=>({...v,[x.k]:e.target.value}))} className={c+' mt-1.5'}/></label>)}
      </div>
      {errosCadastro&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{errosCadastro}</p>}
      <p className="mt-4 text-[11px] text-amber-700">Este cadastro não é enviado ao banco nesta prévia; serve apenas para avaliar o fluxo.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setCadastroAberto(false)} className="rounded-xl border px-4 py-3 text-xs font-bold">Voltar</button><button type="button" onClick={cadastrarPrevia} className="rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white">Usar cliente na prévia</button></div>
    </div>
  </div>}
 </main>
}
