'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {tokenAtual} from '@/lib/auth'
import {calcularPedidoMinimo} from '@/lib/comprasCotacaoAssistida'
import type {ComprasAcessos} from '@/lib/comprasPermissoesServer'

type Cliente={id:string;nome:string}
type Obra={id:string;cliente_id:string;nome:string}
type Produto={id:string;codigo:string|null;nome:string;categoria:string|null;unidade:string|null;foto_url:string|null}
type Fornecedor={id:string;nome:string;pedido_minimo:number|null}
type Sol={id:string;solicitante_id:string;solicitante_nome:string;destino:'obra'|'estoque';cliente_id:string|null;obra_id:string|null;status:string;created_at:string}
type Item={id:string;solicitacao_id:string;ordem:number;categoria:string;descricao:string;quantidade_necessaria:number|null;unidade:string;produto_id:string|null;status:string;foto_url:string|null;identificacao_status:string}
type Cart={id:string;fornecedor_id:string;status:string;pedido_emitido_em:string|null;created_at:string}
type CartLine={id:string;carrinho_id:string;item_id:string;quantidade_obra:number;quantidade_estoque:number;preco_unitario:number|null}
type Evento={id:number;solicitacao_id:string;item_id:string|null;entidade:string;acao:string;created_at:string;autor_nome:string}
type Payload={acessos:ComprasAcessos;usuarioId:string;solicitacoes:Sol[];itens:Item[];clientes:Cliente[];obras:Obra[];produtos:Produto[];fornecedores:Fornecedor[];carrinhos:Cart[];linhas:CartLine[];historico:Evento[]}
type NovoItem={categoria:string;descricao:string;quantidade_necessaria:string;unidade:string;foto:File|null}
type Sugestao={id:string;nome:string;ultimoPrecoPago:number|null;precoCatalogo:number|null;pedidoMinimo:number;ultimaCompra:string|null;preferencial:boolean}
type Cotacao={estoque:{fisico:number;reservado:number;disponivel:number};fornecedores:Sugestao[]}
const novo=():NovoItem=>({categoria:'acessorio',descricao:'',quantidade_necessaria:'',unidade:'UN',foto:null})
const moeda=(v:number|null|undefined)=>v==null?'Não informado':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dt=(s:string|null)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const stat=(s:string)=>({aguardando_validacao:'Aguardando validação',em_cotacao:'Em cotação',aguardando_minimo:'Aguardando pedido mínimo',comprado:'Comprado',aguardando_entrega:'Aguardando entrega',recebido_parcial:'Recebido parcial',recebido:'Recebido',cancelado:'Cancelado',rascunho:'Carrinho aberto',pedido_emitido:'Pedido comprado'}[s]||s)
const categorias=[['perfil','Perfil'],['acessorio','Acessório'],['vidro','Vidro'],['produto_pronto','Produto pronto'],['outros','Outros']]

export default function ComprasSolicitacoes(){
 const [d,setD]=useState<Payload|null>(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[msg,setMsg]=useState('')
 const [destino,setDestino]=useState<'obra'|'estoque'>('estoque'),[clienteId,setClienteId]=useState(''),[obraId,setObraId]=useState('')
 const [itens,setItens]=useState<NovoItem[]>([novo()]),[revisar,setRevisar]=useState(false)
 const [abrirId,setAbrirId]=useState<string|null>(null),[buscaProduto,setBuscaProduto]=useState('')
 const [qObra,setQObra]=useState(''),[qEstoque,setQEstoque]=useState(''),[preco,setPreco]=useState(''),[fornecedorId,setFornecedorId]=useState(''),[carrinhoId,setCarrinhoId]=useState('')
 const [cot,setCot]=useState<Cotacao|null>(null),[buscando,setBuscando]=useState(false)
 const [editando,setEditando]=useState<string|null>(null),[editDesc,setEditDesc]=useState(''),[editQtd,setEditQtd]=useState('')
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const token=await tokenAtual();if(!token)throw Error('Sessão expirada, entre novamente')
  const r=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...init?.headers},cache:'no-store'})
  const json=await r.json().catch(()=>({}));if(!r.ok)throw Error(json.error||'Falha de comunicação');return json
 },[])
 const carregar=useCallback(async()=>{
  try{setBusy(true);setD(await request('/api/compras/solicitacoes'))}catch(e){setErro(e instanceof Error?e.message:'Erro de consulta')}
  finally{setBusy(false)}
 },[request])
 useEffect(()=>{void carregar()},[carregar])
 const selecionado=d?.itens.find(i=>i.id===abrirId)
 const obra=d?.obras.filter(o=>o.cliente_id===clienteId)||[]
 const produto=d?.produtos.find(p=>p.id===selecionado?.produto_id)
 const meus=d?.acessos?.verProprios||d?.acessos?.editarProprios
 const comprador=!!(d?.acessos?.cotar||d?.acessos?.comprar)
 const prodFiltrados=useMemo(()=>d?.produtos.filter(p=>(p.nome+' '+p.codigo).toLowerCase().includes(buscaProduto.toLowerCase())).slice(0,30)||[],[d?.produtos,buscaProduto])
 const linhasCart=useMemo(()=>new Map((d?.carrinhos||[]).map(c=>[c.id,(d?.linhas||[]).filter(l=>l.carrinho_id===c.id)])),[d?.carrinhos,d?.linhas])
 async function enviar(){
  if(destino==='obra'&&(!clienteId||!obraId)){setErro('Selecione o cliente e a obra');return}
  if(itens.some(i=>i.descricao.trim().length<2||destino==='obra'&&!(Number(i.quantidade_necessaria)>0))){setErro('Descreva cada material e informe a quantidade quando for para uma obra');return}
  setErro('');setMsg('');setBusy(true)
  try{const form=new FormData()
   form.append('payload',JSON.stringify({destino,cliente_id:clienteId,obra_id:obraId,
    itens:itens.map(i=>({categoria:i.categoria,descricao:i.descricao,quantidade_necessaria:i.quantidade_necessaria||null,unidade:i.unidade}))}))
   itens.forEach((i,idx)=>{if(i.foto)form.append('foto_'+idx,i.foto)})
   const r=await request('/api/compras/solicitacoes',{method:'POST',body:form})
   setMsg(`Solicitação enviada para Compras. ${r.itens} item(ns) aguardando validação.`)
   setItens([novo()]);setRevisar(false);await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao enviar')}
  finally{setBusy(false)}
 }
 async function alterarItem(acao:'editar'|'cancelar'|'identificar',itemId:string,extra:Record<string,unknown>={}){
  try{setBusy(true);setErro('');await request('/api/compras/solicitacoes',{method:'PATCH',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({acao,itemId,...extra})});setMsg('Alteração registrada com histórico.');setEditando(null);await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha na alteração')}finally{setBusy(false)}
 }
 async function consultarProduto(pid:string|null){
  setCot(null);if(!pid)return
  try{setBuscando(true);setCot(await request('/api/compras/cotacao-assistida?produtoId='+encodeURIComponent(pid)))
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar fornecedores')}finally{setBuscando(false)}
 }
 function abrir(i:Item){setAbrirId(i.id);setBuscaProduto('');setFornecedorId('');setCarrinhoId('');setPreco('');setQObra(String((d?.solicitacoes.find(s=>s.id===i.solicitacao_id)?.destino==='obra'?i.quantidade_necessaria:0)||0));setQEstoque('0');void consultarProduto(i.produto_id)}
 async function adicionarCarrinho(){if(!selecionado||!fornecedorId)return setErro('Selecione um fornecedor')
  try{setBusy(true);setErro('');await request('/api/compras/carrinhos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   itemId:selecionado.id,fornecedorId,carrinhoId:carrinhoId||null,
   quantidadeObra:Number(qObra||0),quantidadeEstoque:Number(qEstoque||0),precoUnitario:preco
  })});setMsg('Item incluído no carrinho do fornecedor');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao adicionar')}
  finally{setBusy(false)}
 }
 async function comprarCart(id:string){
  if(!confirm('Confirmar que o pedido de compra foi emitido para o fornecedor? Isso não registra entrega nem entrada em estoque.'))return
  try{setBusy(true);setErro('');await request('/api/compras/carrinhos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({carrinhoId:id})});setMsg('Pedido de compra registrado. O cliente e a obra poderão acompanhar como Comprado.');await carregar()}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível confirmar')}
  finally{setBusy(false)}
 }
 if(!d&&!erro)return <main className="p-8 text-sm">Carregando Compras...</main>
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-[1500px] space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Atlas One · Compras</p><h1 className="text-2xl font-bold">Solicitações e carrinhos</h1><p className="text-sm text-slate-500">Solicitação simples → validação → fornecedor → pedido mínimo → compra → conferência</p></div><Link href="/compras" className="rounded-lg border bg-white px-3 py-2 text-sm">Compras 360</Link></header>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro} <button onClick={()=>setErro('')} className="ml-2 underline">Fechar</button></p>}
  {msg&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
  {!d?.acessos?.solicitar&&!d?.acessos?.consultar&&!meus&&!comprador&&<p className="rounded-xl border bg-white p-6">Este usuário não tem acesso ao novo fluxo de Compras. As permissões são definidas no cadastro de usuários.</p>}
  {d?.acessos?.solicitar&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Fazer pedido de compra</h2><p className="mb-4 text-xs text-slate-500">Apenas informe o que precisa; o comprador identifica o código, estoque e fornecedor depois.</p>
   <div className="mb-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Destino obrigatório<select value={destino} onChange={e=>{setDestino(e.target.value as 'estoque'|'obra');setClienteId('');setObraId('');setRevisar(false)}} className="mt-1 w-full rounded-lg border p-2"><option value="estoque">Estoque</option><option value="obra">Cliente e obra</option></select></label>
   {destino==='obra'&&<><label className="text-sm font-medium">Cliente<select value={clienteId} onChange={e=>{setClienteId(e.target.value);setObraId('')}} className="mt-1 w-full rounded-lg border p-2"><option value="">Selecionar cliente</option>{d.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label className="text-sm font-medium">Obra do cliente<select value={obraId} onChange={e=>setObraId(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">Selecionar obra</option>{obra.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label></>}</div>
   {itens.map((i,idx)=><div key={idx} className="mb-3 rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center justify-between"><b className="text-sm">Item {idx+1}</b>{itens.length>1&&<button className="text-xs text-red-700" onClick={()=>setItens(x=>x.filter((_,a)=>a!==idx))}>Remover</button>}</div>
    <div className="grid gap-3 md:grid-cols-[170px_1fr_135px]"><label className="text-xs">Categoria<select value={i.categoria} className="mt-1 w-full rounded-lg border p-2" onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,categoria:e.target.value}:v))}>{categorias.map(c=><option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></label><label className="text-xs">O que precisa comprar?<input className="mt-1 w-full rounded-lg border p-2" value={i.descricao} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,descricao:e.target.value}:v))} placeholder="Ex.: fechadura bico de papagaio, linha Suprema"/></label><label className="text-xs">Quantidade {destino==='obra'?'*':'(opcional)'}<input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-lg border p-2" value={i.quantidade_necessaria} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,quantidade_necessaria:e.target.value}:v))} placeholder="Comprador define"/></label></div>
    <label className="mt-2 block text-xs">Foto do material (opcional, até 5 MB) <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,foto:e.target.files?.[0]||null}:v))}/></label>
   </div>)}
   <div className="flex flex-wrap gap-2"><button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{setItens(a=>[...a,novo()]);setRevisar(false)}}>+ Adicionar outro material</button><button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={()=>setRevisar(true)}>Revisar e confirmar</button></div>
   {revisar&&<div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><b>Confirme sua solicitação</b><p className="my-2">Destino: {destino==='estoque'?'Estoque':(d.clientes.find(c=>c.id===clienteId)?.nome||'Cliente')+' / '+(d.obras.find(o=>o.id===obraId)?.nome||'Obra')}</p><ul className="mb-3 list-disc pl-5">{itens.map((i,k)=><li key={k}>{i.descricao||'(sem descrição)'} · {i.quantidade_necessaria||'quantidade a definir'}</li>)}</ul><button disabled={busy} onClick={()=>void enviar()} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">{busy?'Enviando...':'Confirmar e enviar para Compras'}</button></div>}
  </section>}
  {(d?.acessos?.consultar||meus||comprador)&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-2 text-lg font-bold">{d.acessos.consultar||comprador?'Lista de faltas e solicitações':'Minhas solicitações'}</h2><p className="mb-3 text-xs text-slate-500">Cada solicitação agrupa seus materiais. Cancelamentos e alterações preservam o histórico.</p>
   <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{d.solicitacoes.map(s=><article key={s.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{s.destino==='estoque'?'Estoque':(d.clientes.find(c=>c.id===s.cliente_id)?.nome||'Cliente')+' · '+(d.obras.find(o=>o.id===s.obra_id)?.nome||'Obra')}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">{stat(s.status)}</span></div><p className="my-2 text-xs text-slate-500">Solicitado por {s.solicitante_nome} · {dt(s.created_at)}</p>
    {(d.itens.filter(i=>i.solicitacao_id===s.id)).map(i=><div key={i.id} className="border-t py-2"><div className="flex gap-2">{(i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url)?<img src={i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url||''} alt={i.descricao} className="h-12 w-12 rounded border object-contain"/>:<div className="flex h-12 w-12 items-center rounded border border-dashed p-1 text-[9px] text-slate-400">Foto pendente</div>}
     <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{i.descricao}</p><p className="text-[11px] text-slate-500">{i.categoria} · {i.quantidade_necessaria||'Quantidade a definir'} {i.unidade} {i.status==='cancelado'?'· Cancelado':''}</p></div></div>
     {(d.acessos.consultar||comprador)&&d.linhas.filter(l=>l.item_id===i.id).map(l=>{
      const ca=d.carrinhos.find(c=>c.id===l.carrinho_id)
      if(!ca||ca.status==='rascunho'||ca.status==='cancelado')return null
      const f=d.fornecedores.find(v=>v.id===ca.fornecedor_id)
      return <p key={l.id} className="mt-1 rounded bg-blue-50 p-2 text-[11px] text-blue-800">
       {f?.nome||'Fornecedor'} · Pedido em {dt(ca.pedido_emitido_em)} · Obra: {l.quantidade_obra} · Estoque: {l.quantidade_estoque} · {stat(ca.status)}
      </p>
     })}
     {comprador&&i.status!=='cancelado'&&<button className="mt-2 text-xs font-semibold text-blue-700 underline" onClick={()=>abrir(i)}>Validar produto / cotar / carrinho</button>}
     {!comprador&&(d.acessos.editarTodos||d.acessos.editarProprios&&s.solicitante_id===d.usuarioId)&&i.status==='ativo'&&<div className="mt-1 flex gap-2"><button className="text-xs text-blue-700 underline" onClick={()=>{setEditando(i.id);setEditDesc(i.descricao);setEditQtd(i.quantidade_necessaria==null?'':String(i.quantidade_necessaria))}}>Editar</button><button className="text-xs text-red-700 underline" onClick={()=>{if(confirm('Cancelar este item? O histórico ficará preservado.'))void alterarItem('cancelar',i.id)}}>Cancelar</button></div>}
     {editando===i.id&&<div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2"><input aria-label="Descrição corrigida" className="w-full rounded border p-2 text-xs" value={editDesc} onChange={e=>setEditDesc(e.target.value)}/><input aria-label="Quantidade corrigida" type="number" className="w-full rounded border p-2 text-xs" value={editQtd} onChange={e=>setEditQtd(e.target.value)}/><button disabled={busy} className="rounded bg-blue-700 px-3 py-1 text-xs text-white" onClick={()=>void alterarItem('editar',i.id,{descricao:editDesc,quantidade_necessaria:editQtd||null})}>Salvar correção</button><button className="ml-2 text-xs" onClick={()=>setEditando(null)}>Voltar</button></div>}
    </div>)}
    {d.historico.some(e=>e.solicitacao_id===s.id)&&<details className="mt-2 text-[11px] text-slate-500"><summary className="cursor-pointer">Histórico de alterações</summary>{d.historico.filter(e=>e.solicitacao_id===s.id).slice(0,30).map(e=><p key={e.id}>{dt(e.created_at)} · {e.autor_nome} · {e.acao} · {e.entidade.replace('compras_solicitacao_','')}</p>)}</details>}
   </article>)}{!d.solicitacoes.length&&<p className="text-sm text-slate-500">Nenhuma solicitação visível para seu perfil.</p>}</div>
  </section>}
  {comprador&&selecionado&&<section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold">Identificar material e escolher fornecedor</h2><p className="text-sm text-slate-600">{selecionado.descricao}</p></div><button className="rounded-lg border px-3 py-1.5 text-xs" onClick={()=>setAbrirId(null)}>Fechar</button></div>
   <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><h3 className="font-semibold">1. Conferir o produto cadastrado</h3>{selecionado.foto_url&&<img src={selecionado.foto_url} alt="Foto enviada na solicitação" className="h-32 w-32 rounded-lg border object-contain"/>}
    <input className="w-full rounded-xl border p-3 text-sm" placeholder="Pesquisar pelo nome ou código" value={buscaProduto} onChange={e=>setBuscaProduto(e.target.value)}/>
    <p className="text-xs text-slate-500">Sugestões por correspondência de texto. O comprador deve validar; identificação por IA ainda não está ativada.</p>
    <div className="max-h-64 space-y-1 overflow-auto rounded-xl border p-2">{prodFiltrados.map(p=><button key={p.id} type="button" onClick={()=>{void alterarItem('identificar',selecionado.id,{produtoId:p.id}).then(()=>consultarProduto(p.id));setBuscaProduto('')}} className={'flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-blue-50 '+(p.id===produto?.id?'bg-blue-50':'')}>
     {p.foto_url?<img src={p.foto_url} alt={p.nome} className="h-12 w-12 rounded border object-contain"/>:<span className="flex h-12 w-12 items-center rounded border border-dashed p-1 text-[9px] text-slate-400">Imagem não cadastrada</span>}
     <span><b>{p.codigo||'Sem código'} · {p.nome}</b><span className="block text-slate-500">{p.id===produto?.id?'Produto vinculado — ':'Clique para validar este produto'}</span></span>
    </button>)}</div>
    <p className="text-xs">Não encontrou? <Link href="/cadastro/produtos" className="font-semibold text-blue-700 underline">Abrir cadastro de produtos</Link> e atualize a lista.</p>
   </div><div className="space-y-3"><h3 className="font-semibold">2. Estoque e fornecedores</h3>
    {!selecionado.produto_id||selecionado.identificacao_status!=='validado'?<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">O produto precisa de identificação validada antes da compra.</p>:null}
    {buscando&&<p className="text-sm">Consultando estoque e fornecedores...</p>}
    {cot&&<><div className="rounded-xl border bg-slate-50 p-3 text-sm"><b>Estoque físico: {cot.estoque.fisico}</b> · Reservado: {cot.estoque.reservado} · Disponível: {cot.estoque.disponivel}</div><p className="text-xs font-semibold">Fornecedores relacionados ({cot.fornecedores.length})</p>
     <div className="max-h-64 space-y-2 overflow-auto">{cot.fornecedores.map(f=><button key={f.id} type="button" className={'block w-full rounded-xl border p-3 text-left text-xs '+(fornecedorId===f.id?'border-blue-500 bg-blue-50':'')} onClick={()=>{setFornecedorId(f.id);setCarrinhoId('');setPreco(String(f.ultimoPrecoPago??f.precoCatalogo??''))}}><b>{f.nome}{f.preferencial?' · Preferencial':''}</b><p>Última compra: {dt(f.ultimaCompra)} · Preço pago: {moeda(f.ultimoPrecoPago)}</p><p>Pedido mínimo: {moeda(f.pedidoMinimo)}</p></button>)}{!cot.fornecedores.length&&<p className="text-xs">Nenhum fornecedor vinculado: selecione ou cadastre um abaixo.</p>}</div></>}
    <label className="block text-xs font-semibold">Fornecedor<select className="mt-1 w-full rounded-lg border p-2" value={fornecedorId} onChange={e=>{setFornecedorId(e.target.value);setCarrinhoId('');setPreco('')}}><option value="">Selecionar</option>{d.fornecedores.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><Link href="/cadastro/fornecedores" className="text-xs font-semibold text-blue-700 underline">+ Cadastrar fornecedor, se não existir</Link>
    <label className="block text-xs">Usar carrinho existente deste fornecedor<select className="mt-1 w-full rounded-lg border p-2" value={carrinhoId} onChange={e=>setCarrinhoId(e.target.value)}><option value="">Criar carrinho novo</option>{d.carrinhos.filter(c=>c.fornecedor_id===fornecedorId&&c.status==='rascunho').map(c=><option key={c.id} value={c.id}>Carrinho {c.id.slice(0,8)} · {dt(c.created_at)}</option>)}</select></label>
    <div className="grid grid-cols-3 gap-2"><label className="text-xs">Qtde. obra<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="any" value={qObra} onChange={e=>setQObra(e.target.value)}/></label><label className="text-xs">Extra estoque<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="any" value={qEstoque} onChange={e=>setQEstoque(e.target.value)}/></label><label className="text-xs">Preço unitário<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="0.01" value={preco} onChange={e=>setPreco(e.target.value)}/></label></div>
    <button disabled={busy||!selecionado.produto_id||selecionado.identificacao_status!=='validado'} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>void adicionarCarrinho()}>Adicionar ao carrinho do fornecedor</button>
   </div></div>
  </section>}
  {comprador&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-1 text-lg font-bold">Carrinhos por fornecedor</h2><p className="mb-3 text-xs text-slate-500">Vermelho: abaixo de 80% do mínimo · Amarelo: próximo do mínimo · Verde: pedido mínimo atingido. Compra e recebimento têm confirmações distintas.</p>
   <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{d!.carrinhos.map(c=>{const f=d!.fornecedores.find(x=>x.id===c.fornecedor_id),linhas=linhasCart.get(c.id)||[]
    const sim=linhas.map(l=>({necessidadeId:l.item_id,descricao:d!.itens.find(i=>i.id===l.item_id)?.descricao||'Produto',fornecedorId:c.fornecedor_id,quantidadeObra:l.quantidade_obra,quantidadeEstoque:l.quantidade_estoque,precoUnitario:l.preco_unitario,unidade:'UN'}))
    const resumo=calcularPedidoMinimo(sim,{id:c.fornecedor_id,nome:f?.nome||'Fornecedor',pedido_minimo:f?.pedido_minimo??0})
    const cor=c.status!=='rascunho'?'border-slate-300':resumo.atingiuMinimo?'border-emerald-400':resumo.subtotal>=resumo.minimo*0.8&&resumo.minimo>0?'border-amber-400':'border-red-400'
    return <article key={c.id} className={'rounded-xl border-2 bg-white p-4 '+cor}><div className="flex justify-between gap-2"><b className="text-sm">{f?.nome||'Fornecedor'}</b><span className="text-xs">{stat(c.status)}</span></div><div className="mt-2 space-y-1 text-xs">{linhas.map(l=><p key={l.id} className="border-t py-1">{d!.itens.find(i=>i.id===l.item_id)?.descricao||'Item'} · obra {l.quantidade_obra} · estoque {l.quantidade_estoque}</p>)}</div>
    <p className="mt-2 text-xs">Subtotal: <b>{moeda(resumo.subtotal)}</b> · Mínimo: {moeda(resumo.minimo)}</p>{c.status==='rascunho'&&<p className="text-xs font-bold">{resumo.falta>0?'Faltam '+moeda(resumo.falta):'Pedido mínimo atingido'}</p>}
    {c.status==='rascunho'&&d!.acessos.comprar&&<button disabled={busy||!resumo.atingiuMinimo} onClick={()=>void comprarCart(c.id)} className="mt-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Confirmar pedido comprado</button>}
    {c.status==='pedido_emitido'&&<p className="mt-2 text-xs text-slate-600">Comprado em {dt(c.pedido_emitido_em)} · Aguardando NF e conferência física</p>}
   </article>})}{!d!.carrinhos.length&&<p className="text-sm text-slate-500">Nenhum carrinho criado ainda. Abra uma solicitação e valide os produtos.</p>}</div>
  </section>}
 </div></main>
}
