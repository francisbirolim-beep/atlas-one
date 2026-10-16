'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {tokenAtual} from '@/lib/auth'
import {calcularPedidoMinimo} from '@/lib/comprasCotacaoAssistida'
import type {ComprasAcessos} from '@/lib/comprasPermissoesServer'
import CarrinhosFluxoAprovado from '@/components/compras/CarrinhosFluxoAprovado'

type Cliente={id:string;nome:string}
type Obra={id:string;cliente_id:string;nome:string}
type Produto={id:string;codigo:string|null;nome:string;categoria:string|null;unidade:string|null;foto_url:string|null}
type Fornecedor={id:string;nome:string;pedido_minimo:number|null}
type Sol={id:string;solicitante_id:string;solicitante_nome:string;destino:'obra'|'estoque';cliente_id:string|null;obra_id:string|null;status:string;created_at:string;observacoes?:string|null}
type Item={id:string;solicitacao_id:string;ordem:number;destino:'obra'|'estoque';cliente_id:string|null;obra_id:string|null;categoria:string;descricao:string;quantidade_necessaria:number|null;unidade:string;produto_id:string|null;status:string;foto_url:string|null;identificacao_status:string}
type Cart={id:string;fornecedor_id:string;status:string;pedido_emitido_em:string|null;created_at:string}
type CartLine={id:string;carrinho_id:string;item_id:string;quantidade_obra:number;quantidade_estoque:number;preco_unitario:number|null}
type Evento={id:number;solicitacao_id:string;item_id:string|null;entidade:string;acao:string;created_at:string;autor_nome:string;detalhe:string}
type Payload={acessos:ComprasAcessos;usuarioId:string;solicitacoes:Sol[];itens:Item[];clientes:Cliente[];obras:Obra[];produtos:Produto[];fornecedores:Fornecedor[];carrinhos:Cart[];linhas:CartLine[];historico:Evento[]}
type NovoItem={modo:'mesma'|'obra'|'estoque';cliente_id:string;obra_id:string;categoria:string;descricao:string;quantidade_necessaria:string;unidade:string;foto:File|null}
type Sugestao={id:string;nome:string;ultimoPrecoPago:number|null;precoCatalogo:number|null;pedidoMinimo:number;ultimaCompra:string|null;preferencial:boolean}
type Cotacao={estoque:{fisico:number;reservado:number;disponivel:number};fornecedores:Sugestao[]}
type SugestaoProduto={id:string;codigo:string|null;nome:string;categoria:string;foto_url:string|null;pontuacao:number;origem:'historico_validado'|'correspondencia_texto';motivo:string}
type RespostaSugestoes={itemId:string;sugestoes:SugestaoProduto[];aviso:string;modo:string}
const novo=(modo:NovoItem['modo']='obra'):NovoItem=>({modo,cliente_id:'',obra_id:'',categoria:'acessorio',descricao:'',quantidade_necessaria:'',unidade:'UN',foto:null})
const resolverDestino=(linhas:NovoItem[],index:number):{destino:'obra'|'estoque';cliente_id:string|null;obra_id:string|null}=>{
 const atual=linhas[index]
 if(!atual)return {destino:'estoque',cliente_id:null,obra_id:null}
 if(atual.modo==='mesma'&&index>0)return resolverDestino(linhas,index-1)
 if(atual.modo==='estoque'||(atual.modo==='mesma'&&index===0))return {destino:'estoque',cliente_id:null,obra_id:null}
 return {destino:'obra',cliente_id:atual.cliente_id||null,obra_id:atual.obra_id||null}
}
function FotoItem({foto}:{foto:File|null}){
 const [url,setUrl]=useState<string|null>(null)
 useEffect(()=>{if(!foto){setUrl(null);return}const u=URL.createObjectURL(foto);setUrl(u);return()=>URL.revokeObjectURL(u)},[foto])
 return <div className="flex items-center gap-2">{url&&<img alt="Foto escolhida do material" src={url} className="h-16 w-16 rounded-lg border bg-white object-contain"/>}<span className="text-xs text-slate-500">{foto?foto.name:'Você pode anexar uma foto real do material'}</span></div>
}
const moeda=(v:number|null|undefined)=>v==null?'Não informado':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dt=(s:string|null)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const stat=(s:string)=>({aguardando_validacao:'Aguardando validação',em_cotacao:'Em cotação',aguardando_minimo:'Aguardando pedido mínimo',comprado:'Comprado',aguardando_entrega:'Aguardando entrega',recebido_parcial:'Recebido parcial',recebido:'Recebido',cancelado:'Cancelado',rascunho:'Carrinho aberto',pedido_emitido:'Pedido comprado'}[s]||s)
const categorias=[['perfil','Perfil'],['acessorio','Acessório'],['vidro','Vidro'],['produto_pronto','Produto pronto'],['outros','Outros']]
const situacoesNecessidade=[
 {id:'aguardando',titulo:'Aguardando análise',classe:'border-rose-200 bg-rose-50',borda:'border-l-rose-400'},
 {id:'cotacao',titulo:'Em cotação',classe:'border-blue-200 bg-blue-50',borda:'border-l-blue-400'},
 {id:'aprovacao',titulo:'Aguardando pedido mínimo',classe:'border-amber-200 bg-amber-50',borda:'border-l-amber-400'},
 {id:'comprado',titulo:'Comprado / aguardando entrega',classe:'border-indigo-200 bg-indigo-50',borda:'border-l-indigo-400'},
 {id:'recebido',titulo:'Recebido',classe:'border-emerald-200 bg-emerald-50',borda:'border-l-emerald-400'},
 {id:'cancelado',titulo:'Cancelado / histórico',classe:'border-slate-200 bg-slate-50',borda:'border-l-slate-400'},
] as const
function statusColuna(s:string){
 if(s==='aguardando_validacao')return 'aguardando'
 if(s==='em_cotacao')return 'cotacao'
 if(s==='aguardando_minimo')return 'aprovacao'
 if(['comprado','aguardando_entrega'].includes(s))return 'comprado'
 if(['recebido_parcial','recebido'].includes(s))return 'recebido'
 return 'cancelado'
}
const colunasFornecedor=[
 {id:'montagem',titulo:'Em montagem',cor:'bg-amber-50 border-amber-200'},
 {id:'pronto',titulo:'Pronto para enviar',cor:'bg-emerald-50 border-emerald-200'},
 {id:'comprado',titulo:'Pedido emitido / aguardando chegada',cor:'bg-blue-50 border-blue-200'},
 {id:'recebido',titulo:'Recebido',cor:'bg-teal-50 border-teal-200'}
] as const
function statusFornecedor(status:string,atingiu:boolean){
 if(['recebido','recebido_parcial'].includes(status))return 'recebido'
 if(['pedido_emitido','aguardando_entrega'].includes(status))return 'comprado'
 return atingiu?'pronto':'montagem'
}


export default function ComprasSolicitacoes(){
 const [d,setD]=useState<Payload|null>(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[msg,setMsg]=useState('')
 const [destino,setDestino]=useState<'obra'|'estoque'>('estoque'),[clienteId,setClienteId]=useState(''),[obraId,setObraId]=useState('')
 const [itens,setItens]=useState<NovoItem[]>([novo()]),[revisar,setRevisar]=useState(false)
 const [abaPedido,setAbaPedido]=useState<'itens'|'observacoes'|'historico'>('itens')
 const [abrirId,setAbrirId]=useState<string|null>(null),[buscaProduto,setBuscaProduto]=useState('')
 const [visaoSolicitacoes,setVisaoSolicitacoes]=useState<'kanban'|'lista'>('kanban'),[pedidoAberto,setPedidoAberto]=useState<string|null>(null),[visaoCompras,setVisaoCompras]=useState<'fornecedor'|'cliente'|'lista'>('fornecedor')
 const [qObra,setQObra]=useState(''),[qEstoque,setQEstoque]=useState(''),[preco,setPreco]=useState(''),[fornecedorId,setFornecedorId]=useState(''),[carrinhoId,setCarrinhoId]=useState('')
 const [cot,setCot]=useState<Cotacao|null>(null),[buscando,setBuscando]=useState(false)
 const [abaProduto,setAbaProduto]=useState<'fornecedores'|'historico'|'estoque'|'informacoes'>('fornecedores')
 const [sugestoes,setSugestoes]=useState<RespostaSugestoes|null>(null),[buscandoSugestoes,setBuscandoSugestoes]=useState(false)
 const [editando,setEditando]=useState<string|null>(null),[editDesc,setEditDesc]=useState(''),[editQtd,setEditQtd]=useState(''),[editDestino,setEditDestino]=useState<'obra'|'estoque'>('estoque'),[editCliente,setEditCliente]=useState(''),[editObra,setEditObra]=useState(''),[editCategoria,setEditCategoria]=useState('acessorio'),[editFoto,setEditFoto]=useState<File|null>(null)
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
 const meus=d?.acessos?.verProprios||d?.acessos?.editarProprios||d?.acessos?.solicitar
 const comprador=!!(d?.acessos?.cotar||d?.acessos?.comprar||d?.acessos?.aprovar)
 const prodFiltrados=useMemo(()=>d?.produtos.filter(p=>(p.nome+' '+p.codigo).toLowerCase().includes(buscaProduto.toLowerCase())).slice(0,30)||[],[d?.produtos,buscaProduto])
 const linhasCart=useMemo(()=>new Map((d?.carrinhos||[]).map(c=>[c.id,(d?.linhas||[]).filter(l=>l.carrinho_id===c.id)])),[d?.carrinhos,d?.linhas])
 async function enviar(){
  if(itens.some((i,index)=>{const x=resolverDestino(itens,index);return i.descricao.trim().length<2||x.destino==='obra'&&(!x.cliente_id||!x.obra_id||!(Number(i.quantidade_necessaria)>0))})){
   setErro('Revise descrição, cliente, obra e quantidade obrigatória de cada item');return
  }
  setErro('');setMsg('');setBusy(true)
  try{const form=new FormData()
   form.append('payload',JSON.stringify({
    itens:itens.map((i,index)=>({categoria:i.categoria,descricao:i.descricao,
     quantidade_necessaria:i.quantidade_necessaria||null,unidade:i.unidade,
     ...resolverDestino(itens,index)}))}))
   itens.forEach((i,idx)=>{if(i.foto)form.append('foto_'+idx,i.foto)})
   const r=await request('/api/compras/solicitacoes',{method:'POST',body:form})
   setMsg(`Solicitação enviada para Compras. ${r.itens} item(ns) aguardando validação.`)
   setItens([novo()]);setRevisar(false);await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao enviar')}
  finally{setBusy(false)}
 }
 async function alterarItem(acao:'editar'|'cancelar'|'identificar',itemId:string,extra:Record<string,unknown>={}){
  try{
   setBusy(true);setErro('')
   const parametros={acao,itemId,...extra}
   const form=acao==='editar'&&editFoto?new FormData():null
   if(form){form.append('payload',JSON.stringify(parametros));form.append('foto',editFoto!)}
   const resposta=await request('/api/compras/solicitacoes',form?{method:'PATCH',body:form}:
    {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(parametros)})
   setMsg(resposta.aviso|| (resposta.estado==='cancelado'?'Item excluído da lista ativa, com histórico preservado.':'Alteração registrada no histórico.'))
   setEditFoto(null);setEditando(null);await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha na alteração')}finally{setBusy(false)}
 }
 async function consultarProduto(pid:string|null){
  setCot(null);if(!pid)return
  try{setBuscando(true);setCot(await request('/api/compras/cotacao-assistida?produtoId='+encodeURIComponent(pid)))
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar fornecedores')}finally{setBuscando(false)}
 }
 async function consultarSugestoes(itemId:string){
  setSugestoes(null)
  try{setBuscandoSugestoes(true);const resultado:RespostaSugestoes=await request('/api/compras/identificacao-assistida?itemId='+encodeURIComponent(itemId))
   setSugestoes(resultado)
  }catch(e){setErro(e instanceof Error?e.message:'Sugestões indisponíveis; escolha manualmente')}
  finally{setBuscandoSugestoes(false)}
 }
 async function confirmarProduto(produtoId:string){
  if(!selecionado||busy)return
  const produto=d?.produtos.find(p=>p.id===produtoId)
  if(!produto)return setErro('Produto não localizado no cadastro. Atualize a lista.')
  if(!confirm('Confirmar o produto '+(produto.codigo||'sem código')+' · '+produto.nome+' para esta solicitação? A escolha ficará registrada e será usada em sugestões futuras.'))return
  try{setBusy(true);setErro('');const result=await request('/api/compras/solicitacoes',{
   method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'identificar',itemId:selecionado.id,produtoId})
  })
   setMsg(result.corrigiuSugestaoAnterior?'Produto corrigido e aprendizado atualizado.':'Produto validado pelo comprador. Confirmação registrada para futuras sugestões.')
   setBuscaProduto('');await carregar();await consultarProduto(produtoId)
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível validar produto')}finally{setBusy(false)}
 }
 function abrir(i:Item){setAbaProduto('fornecedores');setAbrirId(i.id);setSugestoes(null);setBuscaProduto('');setFornecedorId('');setCarrinhoId('');setPreco('');setQObra(String((i.destino==='obra'?i.quantidade_necessaria:0)||0));setQEstoque('0');void consultarSugestoes(i.id);void consultarProduto(i.produto_id)}
 async function adicionarCarrinho(){if(!selecionado||!fornecedorId)return setErro('Selecione um fornecedor')
  try{setBusy(true);setErro('');await request('/api/compras/carrinhos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   itemId:selecionado.id,fornecedorId,carrinhoId:carrinhoId||null,
   quantidadeObra:Number(qObra||0),quantidadeEstoque:Number(qEstoque||0),precoUnitario:preco
  })});setMsg('Item incluído no carrinho do fornecedor');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao adicionar')}
  finally{setBusy(false)}
 }
 async function cancelarPedido(s:Sol){
  if(!(d?.acessos.editarTodos||d?.acessos.editarProprios&&s.solicitante_id===d.usuarioId))return setErro('Sem permissão para excluir o pedido')
  const motivo=prompt('Motivo para excluir o pedido completo (histórico permanente):','Pedido solicitado incorretamente')
  if(motivo===null)return
  if(motivo.trim().length<3)return setErro('Informe o motivo da exclusão')
  if(!confirm('Confirma cancelar todos os itens deste pedido? O registro permanecerá no histórico. Itens já em carrinho ou compra serão enviados para revisão, sem estornar estoque.'))return
  try{setBusy(true);setErro('');const resposta=await request('/api/compras/solicitacoes',{
   method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'cancelar_pedido',solicitacaoId:s.id,motivo})
  })
   setMsg(resposta.aviso||'Pedido cancelado com histórico preservado.');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao cancelar pedido')}finally{setBusy(false)}
 }
 async function comprarCart(id:string){
  if(!confirm('Confirmar que o pedido de compra foi emitido para o fornecedor? Isso não registra entrega nem entrada em estoque.'))return
  try{setBusy(true);setErro('');await request('/api/compras/carrinhos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({carrinhoId:id})});setMsg('Pedido de compra registrado. O cliente e a obra poderão acompanhar como Comprado.');await carregar()}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível confirmar')}
  finally{setBusy(false)}
 }
 if(!d&&!erro)return <main className="p-8 text-sm">Carregando Compras...</main>
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-[1500px] space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Atlas One · Compras</p><h1 className="text-2xl font-bold">Solicitações e carrinhos</h1><p className="text-sm text-slate-500">Solicitação simples → validação → fornecedor → pedido mínimo → compra → conferência</p></div><div className="flex flex-wrap gap-2">{(d?.acessos?.receber||d?.acessos?.conferir||d?.acessos?.consultar)&&<Link href="/compras/recebimento-integrado" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Recebimento integrado</Link>}<Link href="/compras" className="rounded-lg border bg-white px-3 py-2 text-sm">Compras 360</Link></div></header>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro} <button onClick={()=>setErro('')} className="ml-2 underline">Fechar</button></p>}
  {msg&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
  {!d?.acessos?.solicitar&&!d?.acessos?.consultar&&!meus&&!comprador&&<p className="rounded-xl border bg-white p-6">Este usuário não tem acesso ao novo fluxo de Compras. As permissões são definidas no cadastro de usuários.</p>}
  {d?.acessos?.solicitar&&<section className="rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold">Fazer pedido de compra</h2>
    <p className="mb-4 text-xs text-slate-500">Adicione vários materiais. Cada item pode ir para a mesma obra, outra obra ou estoque, mantendo um só pedido.</p>
    {itens.map((i,idx)=>{
      const x=resolverDestino(itens,idx)
      const anterior=idx>0?resolverDestino(itens,idx-1):null
      const obras=(d?.obras||[]).filter(o=>o.cliente_id===i.cliente_id)
      const cor=x.destino==='estoque'?'border-emerald-200 bg-emerald-50/50':i.modo==='mesma'?'border-blue-200 bg-blue-50/50':idx===0?'border-blue-200 bg-blue-50/50':'border-orange-200 bg-orange-50/50'
      return <div key={idx} className="mb-3 rounded-2xl border border-slate-200 p-4">
       <div className="mb-3 flex items-center justify-between"><b className="text-sm">Item {idx+1}</b>
        {itens.length>1&&<button type="button" className="text-xs font-semibold text-red-600" onClick={()=>setItens(a=>{
          const at=a.filter((_,index)=>index!==idx)
          if(at[0]?.modo==='mesma'){const efetivo=resolverDestino(a,idx+1);at[0]={...at[0],modo:efetivo.destino,cliente_id:efetivo.cliente_id||'',obra_id:efetivo.obra_id||''}}
          return at})}>Remover</button>}</div>
       <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px]">
         <div className="space-y-3">
           <div className="grid gap-2 sm:grid-cols-[170px_1fr]">
             <label className="text-xs font-medium">Categoria<select value={i.categoria} className="mt-1 w-full rounded-lg border p-2.5" onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,categoria:e.target.value}:v))}>{categorias.map(c=><option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></label>
             <label className="text-xs font-medium">O que precisa comprar?<input className="mt-1 w-full rounded-lg border p-2.5" value={i.descricao} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,descricao:e.target.value}:v))} placeholder="Ex.: fechadura STAN, perfil SU007"/></label>
           </div>
           <label className="block text-xs font-medium">Foto do material (opcional, até 5 MB)
             <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,foto:e.target.files?.[0]||null}:v))}/>
           </label>
           <FotoItem foto={i.foto}/>
         </div>
         <div className={'rounded-xl border p-3 '+cor}>
           <p className={'mb-2 text-sm font-bold '+(x.destino==='estoque'?'text-emerald-800':'text-blue-800')}>Destino deste item</p>
           <select aria-label={'Destino do item '+(idx+1)} value={i.modo} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,modo:e.target.value as NovoItem['modo'],cliente_id:e.target.value==='obra'?'':v.cliente_id,obra_id:e.target.value==='obra'?'':v.obra_id}:v))} className="w-full rounded-lg border bg-white p-2.5 text-sm">
             {idx>0&&<option value="mesma">{anterior?.destino==='obra'?'Manter mesma obra do item anterior':'Manter estoque do item anterior'}</option>}
             <option value="obra">{idx===0?'Cliente e obra':'Outra obra (escolher cliente e obra)'}</option>
             <option value="estoque">Enviar para estoque</option>
           </select>
           {i.modo==='obra'&&<div className="mt-3 grid gap-2 sm:grid-cols-2">
             <label className="text-xs font-medium">Cliente *<select value={i.cliente_id} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,cliente_id:e.target.value,obra_id:''}:v))} className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="">Selecionar cliente</option>{d.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
             <label className="text-xs font-medium">Obra *<select value={i.obra_id} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,obra_id:e.target.value}:v))} className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="">Selecionar obra</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
           </div>}
           {i.modo==='mesma'&&<p className="mt-2 text-xs font-medium text-blue-700">{x.destino==='obra'?(d.clientes.find(c=>c.id===x.cliente_id)?.nome||'Cliente')+' · '+(d.obras.find(o=>o.id===x.obra_id)?.nome||'Selecione obra no item anterior'):'Mesmo destino: estoque'}</p>}
           {x.destino==='estoque'&&<p className="mt-2 text-xs text-emerald-800">Este item será destinado ao estoque geral da empresa.</p>}
         </div>
         <label className="text-xs font-medium">Quantidade {x.destino==='obra'?'*':'(opcional)'}
           <input type="number" min="0.0001" step="any" className="mt-1 w-full rounded-lg border p-2.5" value={i.quantidade_necessaria} onChange={e=>setItens(a=>a.map((v,k)=>k===idx?{...v,quantidade_necessaria:e.target.value}:v))} placeholder="A definir"/>
         </label>
       </div>
      </div>
    })}
    <div className="flex flex-wrap justify-between gap-3"><button className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold" onClick={()=>{setItens(a=>[...a,novo('mesma')]);setRevisar(false)}}>+ Adicionar outro material</button><button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={()=>setRevisar(true)}>Revisar e confirmar pedido →</button></div>
    {revisar&&<div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><b>Revise o destino de cada item antes de enviar</b>
      <ul className="mb-3 mt-2 space-y-2">{itens.map((i,k)=>{const x=resolverDestino(itens,k);return <li key={k} className="rounded-lg border bg-white p-2"><b>Item {k+1}:</b> {i.descricao||'(sem descrição)'} · {i.quantidade_necessaria||'quantidade a definir'} {i.unidade}<p className="text-xs text-slate-600">Destino: {x.destino==='estoque'?'Estoque':(d.clientes.find(c=>c.id===x.cliente_id)?.nome||'Cliente não escolhido')+' / '+(d.obras.find(o=>o.id===x.obra_id)?.nome||'Obra não escolhida')}</p></li>})}</ul>
      <button disabled={busy} onClick={()=>void enviar()} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">{busy?'Enviando...':'Confirmar e enviar um pedido com '+itens.length+' item(ns)'}</button>
    </div>}
   </section>}
  {(d?.acessos?.consultar||meus||comprador)&&<section id="lista-necessidades" className="rounded-2xl border bg-white p-5 shadow-sm">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{d.acessos.consultar||comprador?'Lista de Compra / Necessidades':'Minhas solicitações'}</h2><p className="text-xs text-slate-500">Um card por pedido, vários materiais e destinos diferentes. Clique no card para abrir itens, observações e histórico.</p></div>
    <div className="flex rounded-xl border bg-slate-100 p-1 text-xs font-semibold"><button onClick={()=>{setVisaoSolicitacoes('kanban');setPedidoAberto(null)}} className={'rounded-lg px-3 py-2 '+(visaoSolicitacoes==='kanban'?'bg-white text-blue-700 shadow-sm':'text-slate-500')}>Kanban</button><button onClick={()=>{setVisaoSolicitacoes('lista');setPedidoAberto(null)}} className={'rounded-lg px-3 py-2 '+(visaoSolicitacoes==='lista'?'bg-white text-blue-700 shadow-sm':'text-slate-500')}>Lista</button></div>
   </div>
   {visaoSolicitacoes==='kanban'&&<div className="flex gap-3 overflow-x-auto pb-3">{situacoesNecessidade.filter(c=>c.id!=='cancelado'||d.solicitacoes.some(s=>statusColuna(s.status)==='cancelado')).map(c=>{
    const pedidos=d.solicitacoes.filter(s=>statusColuna(s.status)===c.id)
    return <div key={c.id} className={'min-w-[215px] flex-1 rounded-xl border p-2 '+c.classe}><div className="mb-3 flex items-center justify-between gap-2 p-1"><h3 className="text-xs font-bold">{c.titulo}</h3><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{pedidos.length}</span></div>
     <div className="space-y-2">{pedidos.map(s=>{const iss=d.itens.filter(i=>i.solicitacao_id===s.id),primeiro=iss.find(i=>i.destino==='obra')
      const lugar=primeiro?(d.clientes.find(c=>c.id===primeiro.cliente_id)?.nome||'Cliente')+' / '+(d.obras.find(o=>o.id===primeiro.obra_id)?.nome||'Obra'):'Estoque'
      return <button key={s.id} type="button" onClick={()=>{setPedidoAberto(s.id);setAbaPedido('itens');setVisaoSolicitacoes('lista')}} className={'w-full rounded-lg border border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md '+c.borda}>
       <b className="block truncate text-xs">{lugar}</b><span className="mt-1 block text-[11px] text-slate-600">{iss.length} material(is) · {dt(s.created_at)}</span><span className="mt-1 block text-[11px] text-slate-500">Solicitado por {s.solicitante_nome}</span>
       <div className="mt-2 space-y-1 border-t pt-2">{iss.slice(0,3).map(i=><div className="flex items-center gap-2" key={i.id}>{i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url?<img alt={'Foto '+i.descricao} src={i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url||''} className="h-7 w-7 shrink-0 rounded border object-contain"/>:<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-dashed text-center text-[7px] text-amber-600">Sem foto</span>}<span className="truncate text-[10px]">{i.descricao}</span></div>)}{iss.length>3&&<p className="text-[10px] text-slate-500">+ {iss.length-3} materiais</p>}</div><span className="mt-2 block text-[11px] font-semibold text-blue-700">Abrir pedido →</span>
      </button>})}{!pedidos.length&&<p className="rounded-lg border border-dashed border-slate-200 bg-white/80 p-3 text-center text-xs text-slate-400">Nenhum pedido</p>}</div>
    </div>
   })}</div>}
   {visaoSolicitacoes==='lista'&&<>{pedidoAberto&&<button className="mb-3 rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700" onClick={()=>{setPedidoAberto(null);setVisaoSolicitacoes('kanban')}}>← Voltar ao Kanban de necessidades</button>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{d.solicitacoes.filter(s=>!pedidoAberto||s.id===pedidoAberto).map(s=><article key={s.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{'Pedido de compra · '+d.itens.filter(i=>i.solicitacao_id===s.id).length+' item(ns)'}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">{stat(s.status)}</span></div><p className="my-2 text-xs text-slate-500">Solicitado por {s.solicitante_nome} · {dt(s.created_at)}</p>
    {(d.acessos.editarTodos||d.acessos.editarProprios&&s.solicitante_id===d.usuarioId)&&<div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"><span className="w-full text-[11px] font-medium text-slate-600">Ações do pedido completo</span><button onClick={()=>{const i=d.itens.find(i=>i.solicitacao_id===s.id&&i.status==='ativo');if(!i)return;setEditando(i.id);setEditDesc(i.descricao);setEditQtd(i.quantidade_necessaria==null?'':String(i.quantidade_necessaria));setEditDestino(i.destino);setEditCliente(i.cliente_id||'');setEditObra(i.obra_id||'');setEditCategoria(i.categoria);setEditFoto(null);setPedidoAberto(s.id)}} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800">Editar pedido (por item)</button><button disabled={busy||d.itens.every(i=>i.solicitacao_id!==s.id||i.status!=='ativo')} onClick={()=>void cancelarPedido(s)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40">Excluir pedido completo</button></div>}
    <div className="mb-3 flex border-b text-xs font-semibold">{([['itens','Itens ('+d.itens.filter(i=>i.solicitacao_id===s.id).length+')'],['observacoes','Observações'],['historico','Histórico']] as const).map(([aba,texto])=><button key={aba} type="button" onClick={()=>setAbaPedido(aba)} className={'border-b-2 px-3 py-2 '+(abaPedido===aba?'border-blue-600 text-blue-700':'border-transparent text-slate-500')}>{texto}</button>)}</div>
    {abaPedido==='observacoes'&&<div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">{s.observacoes||'Nenhuma observação registrada neste pedido.'}</div>}
    {abaPedido==='historico'&&<div className="space-y-2 rounded-lg bg-slate-50 p-3">{d.historico.filter(e=>e.solicitacao_id===s.id).map(e=><div className="border-b py-1 text-[11px]" key={e.id}><b>{dt(e.created_at)} · {e.autor_nome}</b><p>{e.detalhe}</p></div>)}{!d.historico.some(e=>e.solicitacao_id===s.id)&&<p className="text-xs text-slate-500">Nenhum evento registrado.</p>}</div>}
    {abaPedido==='itens'&&<div>{(d.itens.filter(i=>i.solicitacao_id===s.id)).map(i=><div key={i.id} className="border-t py-2"><div className="flex gap-2">{(i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url)?<img src={i.foto_url||d.produtos.find(p=>p.id===i.produto_id)?.foto_url||''} alt={i.descricao} className="h-12 w-12 rounded border object-contain"/>:<div className="flex h-12 w-12 items-center rounded border border-dashed p-1 text-[9px] text-slate-400">Foto pendente</div>}
     <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{i.descricao}</p><p className="text-[11px] text-slate-500">{i.categoria} · {i.quantidade_necessaria||'Quantidade a definir'} {i.unidade} · {i.destino==='estoque'?'Estoque':(d.clientes.find(c=>c.id===i.cliente_id)?.nome||'Cliente')+' / '+(d.obras.find(o=>o.id===i.obra_id)?.nome||'Obra')} {i.status==='cancelado'?'· Excluído':i.status==='cancelamento_solicitado'?' · Exclusão pendente':''}</p></div></div>
     {(d.acessos.consultar||comprador)&&d.linhas.filter(l=>l.item_id===i.id).map(l=>{
      const ca=d.carrinhos.find(c=>c.id===l.carrinho_id)
      if(!ca||ca.status==='rascunho'||ca.status==='cancelado')return null
      const f=d.fornecedores.find(v=>v.id===ca.fornecedor_id)
      return <p key={l.id} className="mt-1 rounded bg-blue-50 p-2 text-[11px] text-blue-800">
       {f?.nome||'Fornecedor'} · Pedido em {dt(ca.pedido_emitido_em)} · Obra: {l.quantidade_obra} · Estoque: {l.quantidade_estoque} · {stat(ca.status)}
      </p>
     })}
     {comprador&&i.status==='ativo'&&<button className="mt-2 text-xs font-semibold text-blue-700 underline" onClick={()=>abrir(i)}>Validar produto / cotar / carrinho</button>}
     {(d.acessos.editarTodos||d.acessos.editarProprios&&s.solicitante_id===d.usuarioId)&&i.status==='ativo'&&<div className="mt-2 flex flex-wrap gap-2">
       <button type="button" disabled={busy} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-50" onClick={()=>{setEditando(i.id);setEditDesc(i.descricao);setEditQtd(i.quantidade_necessaria==null?'':String(i.quantidade_necessaria));setEditDestino(i.destino);setEditCliente(i.cliente_id||'');setEditObra(i.obra_id||'');setEditCategoria(i.categoria);setEditFoto(null)}}>Editar item</button>
       <button type="button" disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50" onClick={()=>{const motivo=prompt('Motivo da exclusão (ficará registrado no histórico):','Item solicitado incorretamente');if(motivo===null)return;if(!confirm('Confirmar exclusão deste item? O registro e histórico serão mantidos. Se já houver carrinho ou compra, será encaminhado para revisão do comprador.'))return;void alterarItem('cancelar',i.id,{motivo})}}>Excluir item</button>
      </div>}
     {i.status==='cancelado'&&<p className="mt-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">Item excluído · histórico preservado</p>}
     {i.status==='cancelamento_solicitado'&&<p className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">Exclusão solicitada · aguardando revisão do comprador. A compra não foi desfeita.</p>}
     {editando===i.id&&<div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
       <label className="block text-xs">Categoria<select aria-label="Categoria corrigida" value={editCategoria} onChange={e=>setEditCategoria(e.target.value)} className="mt-1 w-full rounded border p-2">{categorias.map(([valor,texto])=><option key={valor} value={valor}>{texto}</option>)}</select></label>
       <label className="block text-xs">Descrição<input aria-label="Descrição corrigida" className="mt-1 w-full rounded border p-2" value={editDesc} onChange={e=>setEditDesc(e.target.value)}/></label>
       <label className="block text-xs">Quantidade<input aria-label="Quantidade corrigida" type="number" min="0.0001" step="any" className="mt-1 w-full rounded border p-2" value={editQtd} onChange={e=>setEditQtd(e.target.value)}/></label>
       <label className="block text-xs">Destino deste item<select aria-label="Destino corrigido" value={editDestino} className="mt-1 w-full rounded border p-2" onChange={e=>{setEditDestino(e.target.value as 'obra'|'estoque');setEditCliente('');setEditObra('')}}><option value="obra">Cliente e obra</option><option value="estoque">Estoque</option></select></label>
       {editDestino==='obra'&&<><label className="block text-xs">Cliente<select aria-label="Cliente corrigido" value={editCliente} onChange={e=>{setEditCliente(e.target.value);setEditObra('')}} className="mt-1 w-full rounded border p-2"><option value="">Selecionar cliente</option>{d.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label className="block text-xs">Obra<select aria-label="Obra corrigida" className="mt-1 w-full rounded border p-2" value={editObra} onChange={e=>setEditObra(e.target.value)}><option value="">Selecionar obra</option>{d.obras.filter(o=>o.cliente_id===editCliente).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label></>}
       <label className="block text-xs">Trocar foto do material (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 w-full text-xs" onChange={e=>setEditFoto(e.target.files?.[0]||null)}/></label>
       <FotoItem foto={editFoto}/>
       <button disabled={busy} className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" onClick={()=>void alterarItem('editar',i.id,{categoria:editCategoria,descricao:editDesc,quantidade_necessaria:editQtd||null,destino:editDestino,cliente_id:editDestino==='obra'?editCliente:null,obra_id:editDestino==='obra'?editObra:null})}>Salvar alterações com histórico</button>
       <button className="ml-2 text-xs" onClick={()=>setEditando(null)}>Voltar</button></div>}
    </div>)}</div>}
    {abaPedido==='itens'&&d.historico.some(e=>e.solicitacao_id===s.id)&&<details className="mt-2 text-[11px] text-slate-500"><summary className="cursor-pointer">Últimas alterações deste pedido</summary>{d.historico.filter(e=>e.solicitacao_id===s.id).slice(0,30).map(e=><p key={e.id}>{dt(e.created_at)} · {e.autor_nome} · {e.detalhe}</p>)}</details>}
   </article>)}{!d.solicitacoes.length&&<p className="text-sm text-slate-500">Nenhuma solicitação visível para seu perfil.</p>}</div></>}
  </section>}
  {comprador&&selecionado&&<section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold">Card do produto / Escolha do fornecedor</h2><p className="text-sm text-slate-600">{selecionado.descricao}</p></div><button className="rounded-lg border px-3 py-1.5 text-xs" onClick={()=>{setAbrirId(null);setSugestoes(null)}}>Fechar</button></div>
   <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><h3 className="font-semibold">1. Conferir o produto cadastrado</h3>{selecionado.foto_url&&<img src={selecionado.foto_url} alt="Foto enviada na solicitação" className="h-32 w-32 rounded-lg border object-contain"/>}
    <input className="w-full rounded-xl border p-3 text-sm" placeholder="Pesquisar pelo nome ou código" value={buscaProduto} onChange={e=>setBuscaProduto(e.target.value)}/>
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
     <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold text-blue-900">Sugestões inteligentes do catálogo</h4><button disabled={buscandoSugestoes} onClick={()=>void consultarSugestoes(selecionado.id)} className="text-xs font-semibold text-blue-700 underline disabled:opacity-40">Atualizar sugestões</button></div>
     <p className="mt-1 text-[11px] text-blue-800">Baseadas na descrição e nas escolhas já confirmadas pelos compradores. A foto é apenas referência visual, não análise automática de imagem.</p>
     {buscandoSugestoes&&<p className="mt-2 text-xs text-blue-700">Procurando produtos relacionados...</p>}
     {!buscandoSugestoes&&sugestoes?.itemId===selecionado.id&&<div className="mt-3 space-y-2">{sugestoes.sugestoes.map(p=><button key={p.id} type="button" disabled={busy} onClick={()=>void confirmarProduto(p.id)} className="flex w-full items-center gap-3 rounded-lg border border-blue-100 bg-white p-2 text-left text-xs hover:border-blue-400 disabled:opacity-50">
      {p.foto_url?<img src={p.foto_url} alt={'Foto do produto '+p.nome} className="h-16 w-16 shrink-0 rounded border object-contain"/>:<span className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed p-1 text-center text-[9px] text-amber-700">Produto sem foto cadastrada</span>}
      <span className="flex-1"><b className="block">{p.codigo||'Sem código'} · {p.nome}</b><span className="mt-1 block text-slate-500">{p.motivo}</span><span className="mt-1 block font-semibold text-blue-700">{p.origem==='historico_validado'?'Aprendido com validação anterior · ':''}Confirmar este produto</span></span>
     </button>)}{!sugestoes.sugestoes.length&&<p className="text-xs text-slate-600">Nenhuma sugestão segura encontrada. Utilize a busca manual abaixo ou cadastre o produto com sua foto.</p>}</div>}
    </div>
    <p className="text-xs text-slate-500">Busca manual: confirme o código e a foto real. A escolha humana é obrigatória, mesmo quando há uma sugestão aprendida.</p>
    <div className="max-h-64 space-y-1 overflow-auto rounded-xl border p-2">{prodFiltrados.map(p=><button key={p.id} type="button" disabled={busy} onClick={()=>void confirmarProduto(p.id)} className={'flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-blue-50 '+(p.id===produto?.id?'bg-blue-50':'')}>
     {p.foto_url?<img src={p.foto_url} alt={p.nome} className="h-12 w-12 rounded border object-contain"/>:<span className="flex h-12 w-12 items-center rounded border border-dashed p-1 text-[9px] text-slate-400">Foto não cadastrada</span>}
     <span><b>{p.codigo||'Sem código'} · {p.nome}</b><span className="block text-slate-500">{p.id===produto?.id?'Produto vinculado — ':'Clique para validar este produto'}</span></span>
    </button>)}</div>
    <p className="text-xs">Não encontrou? <Link href="/cadastro/produtos" className="font-semibold text-blue-700 underline">Abrir cadastro de produtos</Link> e atualize a lista.</p>
   </div><div className="space-y-3"><h3 className="font-semibold">2. Estoque e fornecedores</h3>
    {!selecionado.produto_id||selecionado.identificacao_status!=='validado'?<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">O produto precisa de identificação validada antes da compra.</p>:null}
    {buscando&&<p className="text-sm">Consultando estoque e fornecedores...</p>}
    <div className="flex items-center gap-3 rounded-xl border p-3">{produto?.foto_url||selecionado.foto_url?<img src={produto?.foto_url||selecionado.foto_url||''} alt={'Foto real do produto '+selecionado.descricao} className="h-20 w-20 shrink-0 rounded-lg border object-contain"/>:<span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed text-center text-[10px] text-amber-700">Foto pendente no cadastro</span>}
     <div className="text-xs"><b className="text-sm">{produto?.nome||selecionado.descricao}</b><p className="text-slate-500">Código: {produto?.codigo||'Aguardando validação'}</p><p>Categoria: {categorias.find(x=>x[0]===selecionado.categoria)?.[1]||selecionado.categoria}</p><p>Quantidade necessária: {selecionado.quantidade_necessaria||'A definir'} {selecionado.unidade}</p></div></div>
    <div className="flex flex-wrap gap-1 rounded-xl border bg-slate-100 p-1">{([['fornecedores','Fornecedores'],['historico','Histórico de compras'],['estoque','Estoque'],['informacoes','Informações']] as const).map(([valor,nome])=><button key={valor} type="button" onClick={()=>setAbaProduto(valor)} className={'rounded-lg px-2.5 py-2 text-xs font-semibold '+(abaProduto===valor?'bg-white text-blue-700 shadow-sm':'text-slate-600')}>{nome}</button>)}</div>
    {abaProduto==='fornecedores'&&cot&&<div className="overflow-auto rounded-xl border"><table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-slate-50"><tr>{['Fornecedor','Última compra','Último valor','Pedido mínimo','Selecionar'].map(t=><th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{cot.fornecedores.map(f=><tr key={f.id} className={'border-t '+(fornecedorId===f.id?'bg-blue-50':'')}><td className="p-2 font-semibold">{f.nome}{f.preferencial?' ★':''}</td><td className="p-2">{dt(f.ultimaCompra)}</td><td className="p-2">{moeda(f.ultimoPrecoPago)}</td><td className="p-2">{moeda(f.pedidoMinimo)}</td><td className="p-2"><button type="button" className="rounded-lg border border-blue-200 px-2 py-1 font-semibold text-blue-700" onClick={()=>{setFornecedorId(f.id);setCarrinhoId('');setPreco(String(f.ultimoPrecoPago??f.precoCatalogo??''))}}>{fornecedorId===f.id?'Selecionado':'Escolher'}</button></td></tr>)}{!cot.fornecedores.length&&<tr><td colSpan={5} className="p-4 text-center text-slate-500">Sem fornecedor vinculado. Escolha ou cadastre abaixo.</td></tr>}</tbody></table></div>}
    {abaProduto==='historico'&&<div className="rounded-xl border p-3 text-xs">{cot?.fornecedores?.filter(f=>f.ultimaCompra).length?cot.fornecedores.filter(f=>f.ultimaCompra).map(f=><p key={f.id} className="border-b py-2"><b>{f.nome}</b> · Última compra {dt(f.ultimaCompra)} · Valor pago {moeda(f.ultimoPrecoPago)}</p>):<p className="text-slate-500">Não há histórico de compra vinculado ao produto.</p>}</div>}
    {abaProduto==='estoque'&&<div className="rounded-xl border bg-blue-50 p-4 text-xs"><b>Estoque físico: {cot?.estoque.fisico??'Não identificado'}</b><p className="mt-1">Reservado: {cot?.estoque.reservado??0} · Disponível: {cot?.estoque.disponivel??'—'}</p><p className="mt-2 text-slate-600">Consulta informativa. Não movimenta nem reserva materiais.</p></div>}
    {abaProduto==='informacoes'&&<div className="rounded-xl border p-3 text-xs"><b>{produto?.codigo||'Sem código'} · {produto?.nome||selecionado.descricao}</b><p>Categoria: {selecionado.categoria} · Unidade {selecionado.unidade}</p><p>Solicitado: {selecionado.destino==='obra'?(d.clientes.find(x=>x.id===selecionado.cliente_id)?.nome||'Cliente')+' / '+(d.obras.find(x=>x.id===selecionado.obra_id)?.nome||'Obra'):'Estoque'}</p><p className="mt-2 text-amber-700">Confira código e imagem real antes de confirmar.</p></div>}
    <label className="block text-xs font-semibold">Fornecedor<select className="mt-1 w-full rounded-lg border p-2" value={fornecedorId} onChange={e=>{setFornecedorId(e.target.value);setCarrinhoId('');setPreco('')}}><option value="">Selecionar</option>{d.fornecedores.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><Link href="/cadastro/fornecedores" className="text-xs font-semibold text-blue-700 underline">+ Cadastrar fornecedor, se não existir</Link>
    <label className="block text-xs">Usar carrinho existente deste fornecedor<select className="mt-1 w-full rounded-lg border p-2" value={carrinhoId} onChange={e=>setCarrinhoId(e.target.value)}><option value="">Criar carrinho novo</option>{d.carrinhos.filter(c=>c.fornecedor_id===fornecedorId&&c.status==='rascunho').map(c=><option key={c.id} value={c.id}>Carrinho {c.id.slice(0,8)} · {dt(c.created_at)}</option>)}</select></label>
    <div className="grid grid-cols-3 gap-2"><label className="text-xs">Qtde. obra<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="any" value={qObra} onChange={e=>setQObra(e.target.value)}/></label><label className="text-xs">Extra estoque<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="any" value={qEstoque} onChange={e=>setQEstoque(e.target.value)}/></label><label className="text-xs">Preço unitário<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0" step="0.01" value={preco} onChange={e=>setPreco(e.target.value)}/></label></div>
    <button disabled={busy||!selecionado.produto_id||selecionado.identificacao_status!=='validado'} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>void adicionarCarrinho()}>Adicionar ao carrinho do fornecedor</button>
   </div></div>
  </section>}
  {comprador&&<CarrinhosFluxoAprovado carrinhos={d!.carrinhos} linhas={d!.linhas} itens={d!.itens} fornecedores={d!.fornecedores} produtos={d!.produtos} clientes={d!.clientes} obras={d!.obras}
   podeComprar={d!.acessos.comprar} ocupado={busy} onComprar={id=>void comprarCart(id)}
   onAdicionarMais={()=>{setPedidoAberto(null);setVisaoSolicitacoes('kanban');document.getElementById('lista-necessidades')?.scrollIntoView({behavior:'smooth',block:'start'})}}/>}
 </div></main>
}
