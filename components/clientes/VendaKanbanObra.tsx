'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowUpRight,RefreshCw,Plus,ShoppingCart,ImageOff,RotateCcw,Trash2,ShieldCheck} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {COLUNAS_GERAIS_PADRAO,type EtapaOperacional} from '@/lib/visaoGeralProjetos'
import type {PedidoGeralCard,ProjetoGeralCard} from '@/lib/visaoGeralDemo'
import type {PermissoesKanbanObra,AcaoKanbanObra} from '@/lib/kanbanObraPermissoesServer'

type Manual={id:string;vendaId:string;titulo:string;descricao:string;etapa:string;createdAt:string}
type Retirado={id:string;vendaId:string;titulo:string;etapa:string;retiradoEm:string}
type Resposta={
 cards:ProjetoGeralCard[];ocultos:{vendaId:string;cliente:string;motivoControle:string|null}[]
 pedidos:PedidoGeralCard[];acompanhamentos:Manual[];retiradosManuais:Retirado[]
 permissoesObra:PermissoesKanbanObra|null;usuarioMaster:boolean
 kanbanObraConfigurado:boolean;atualizadoEm:string
}
const cores=[
 ['#079c51','#062f26'],['#0759e8','#092345'],['#6417e9','#29154a'],['#fa5208','#45251b'],
 ['#ed0c41','#471b2c'],['#d99500','#403014'],['#e60d74','#401b36'],['#077e85','#113639']
]
const nomesEtapas:Record<string,string>={vendido:'Vendido',separacao_materiais:'Separação de Materiais',compras:'Compras',aguardando_materiais:'Aguardando Material',medicao_final:'Medição Final',producao:'Produção',instalacao:'Instalação',finalizado:'Finalizado'}
const etapas=(Object.keys(nomesEtapas) as EtapaOperacional[])
const podeFoto=(url:unknown):url is string=>typeof url==='string'&&/^https?:\/\//i.test(url)&&!/\.(pdf|zip)(\?|$)/i.test(url)

export default function VendaKanbanObra({clienteId,vendaId}:{clienteId:string;vendaId:string}){
 const [dados,setDados]=useState<Resposta|null>(null)
 const [carregando,setCarregando]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [formAberto,setFormAberto]=useState(false)
 const [titulo,setTitulo]=useState('')
 const [descricao,setDescricao]=useState('')
 const [etapa,setEtapa]=useState<EtapaOperacional>('vendido')
 const [arrastando,setArrastando]=useState<string|null>(null)
 const permissoes=dados?.permissoesObra
 const ler=useCallback(async()=>{
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Faça login novamente para consultar a obra.')
   const res=await fetch('/api/visao-geral-projetos?vendaId='+encodeURIComponent(vendaId),{
     cache:'no-store',headers:{Authorization:'Bearer '+token}
   })
   const payload=await res.json().catch(()=>({}))
   if(!res.ok)throw Error(payload.erro||'Não foi possível consultar o Kanban da obra.')
   setDados(payload);setErro('')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar esta obra.')}
  finally{setCarregando(false)}
 },[vendaId])
 useEffect(()=>{
  void ler()
  const timer=window.setInterval(()=>void ler(),15_000)
  const acordou=()=>{if(document.visibilityState==='visible')void ler()}
  document.addEventListener('visibilitychange',acordou)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',acordou)}
 },[ler])
 async function salvar(acao:Exclude<AcaoKanbanObra,'consultar'>,cardId?:string,proximaEtapa?:string){
  if(!permissoes?.[acao]||salvando||!dados?.kanbanObraConfigurado)return
  if(acao==='criar'&&titulo.trim().length<3){setErro('Informe o nome do card (mínimo 3 letras).');return}
  const explicacao={criar:'criar este acompanhamento',mover:'mover este acompanhamento',retirar:'retirar este card do painel',restaurar:'restaurar este card'}[acao]
  const motivo=window.prompt('Motivo para '+explicacao+' (mínimo 8 caracteres):',acao==='criar'?'Controle separado desta obra.':'Atualização do acompanhamento da obra.')
  if(!motivo)return
  if(motivo.trim().length<8){setErro('Motivo de pelo menos 8 caracteres é obrigatório.');return}
  if(!window.confirm('Confirma '+explicacao+'? Esta ação NÃO altera compras, produção, estoque ou financeiros.'))return
  setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const res=await fetch('/api/kanban-obra/cards',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao,cardId,etapa:proximaEtapa||etapa,titulo,descricao,motivo:motivo.trim()})
   })
   const j=await res.json().catch(()=>({}))
   if(!res.ok||!j.ok)throw Error(j.erro||'Não foi possível registrar a alteração.')
   if(acao==='criar'){setTitulo('');setDescricao('');setEtapa('vendido');setFormAberto(false)}
   await ler()
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setSalvando(false);setArrastando(null)}
 }
 async function controlarProjeto(acao:'ocultar'|'restaurar'){
  if(!dados?.usuarioMaster||salvando)return
  const motivo=window.prompt(acao==='ocultar'?
   'Motivo para retirar o card PRINCIPAL da Visão Geral (sem excluir a venda):':
   'Motivo para reconstruir/restaurar o card PRINCIPAL a partir dos dados da obra:',
   acao==='ocultar'?'Card antigo incorreto; será refeito no acompanhamento da obra.':'Corrigido vínculo da obra; reconstruir espelho da venda.')
  if(!motivo||motivo.trim().length<8)return
  if(!window.confirm('Confirma? A venda, o cliente e os pedidos permanecem inalterados.'))return
  setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão inválida.')
   const res=await fetch('/api/visao-geral-projetos/controle',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao,motivo:motivo.trim()})
   })
   const j=await res.json().catch(()=>({}))
   if(!res.ok||!j.ok)throw Error(j.erro||'Não foi possível atualizar a visão geral.')
   await ler()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao organizar card.')}
  finally{setSalvando(false)}
 }
 const projeto=dados?.cards?.find(c=>c.vendaId===vendaId)
 const oculto=dados?.ocultos?.find(c=>c.vendaId===vendaId)
 const manuais=dados?.acompanhamentos||[]
 const pedidos=(dados?.pedidos||[]).filter(p=>p.vendaId===vendaId)
 return <section aria-label="Kanban da obra" className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-[#07182b] shadow-lg">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243b58] p-4">
   <div>
    <h2 className="text-lg font-extrabold text-white">Kanban desta obra</h2>
    <p className="text-xs text-slate-300">Esta venda tem seu próprio quadro. O Kanban Geral mostra o mesmo andamento e os pedidos vinculados.</p>
    <p className="mt-1 text-[11px] text-sky-200">Card da venda = dados reais · Cartões azuis = acompanhamento manual · Compras = pedidos reais</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    {dados?.usuarioMaster&&<Link href="/configuracoes/usuarios" className="inline-flex items-center gap-1 rounded-lg border border-[#3c5876] px-3 py-2 text-xs font-bold text-white"><ShieldCheck size={14}/> Autorizar equipe</Link>}
    {permissoes?.criar&&dados?.kanbanObraConfigurado&&<button type="button" onClick={()=>setFormAberto(v=>!v)} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={14}/> Novo card</button>}
    <button type="button" onClick={()=>void ler()} disabled={carregando} className="inline-flex items-center gap-1 rounded-lg border border-[#3c5876] px-3 py-2 text-xs font-bold text-white"><RefreshCw size={14}/> Atualizar</button>
    <Link href="/visao-geral-projetos" className="inline-flex items-center gap-1 rounded-lg border border-[#3c5876] px-3 py-2 text-xs font-bold text-white">Kanban Geral <ArrowUpRight size={13}/></Link>
   </div>
  </div>
  {erro&&<p role="alert" className="m-3 rounded-md bg-rose-950 p-3 text-xs text-rose-100">{erro}</p>}
  {carregando&&!dados&&<p className="p-5 text-xs text-slate-200">Carregando dados reais desta venda...</p>}
  {dados&&!dados.kanbanObraConfigurado&&<p className="m-3 rounded-md border border-amber-600 bg-amber-950/40 p-3 text-xs text-amber-100">Os cards manuais ainda não estão habilitados no banco. O espelho das etapas reais continua disponível, sem alterações de dados.</p>}
  {formAberto&&permissoes?.criar&&<div className="m-3 grid gap-2 rounded-lg border border-blue-500 bg-[#102743] p-4 md:grid-cols-[1fr_1fr_180px_auto]">
   <label className="text-xs text-slate-200">Título do acompanhamento<input value={titulo} maxLength={120} onChange={e=>setTitulo(e.target.value)} className="mt-1 w-full rounded bg-white px-2 py-2 text-slate-900" placeholder="Ex.: Aguardando alumínio"/></label>
   <label className="text-xs text-slate-200">Observação<input value={descricao} maxLength={1000} onChange={e=>setDescricao(e.target.value)} className="mt-1 w-full rounded bg-white px-2 py-2 text-slate-900" placeholder="Descrição opcional"/></label>
   <label className="text-xs text-slate-200">Etapa<select value={etapa} onChange={e=>setEtapa(e.target.value as EtapaOperacional)} className="mt-1 w-full rounded bg-white px-2 py-2 text-slate-900">{etapas.map(e=><option key={e} value={e}>{nomesEtapas[e]}</option>)}</select></label>
   <button type="button" disabled={salvando} onClick={()=>void salvar('criar')} className="self-end rounded bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">Criar e espelhar</button>
  </div>}
  {dados?.usuarioMaster&&<div className="mx-3 mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-100">
   {oculto?<><span className="rounded bg-amber-950 px-2 py-1">Card principal retirado: {oculto.motivoControle}</span><button disabled={salvando} onClick={()=>void controlarProjeto('restaurar')} className="rounded bg-blue-700 px-2 py-1.5 font-bold">Restaurar card da venda</button></>:
   projeto?<button disabled={salvando} onClick={()=>void controlarProjeto('ocultar')} className="rounded border border-rose-500 px-3 py-1.5 font-bold text-rose-100">Retirar card principal incorreto</button>:null}
   <span className="text-slate-400">Retirar não exclui a obra. Para corrigir vínculos, utilize o cadastro da venda.</span>
  </div>}
  <div className="overflow-x-auto px-3 pb-4 pt-3">
   <div className="grid min-w-max gap-2" style={{gridTemplateColumns:'repeat(8,minmax(175px,1fr))'}}>
    {COLUNAS_GERAIS_PADRAO.map((col,i)=>{
     const [cor,base]=cores[i]
     const cardReal=projeto&&col.criterios.includes(projeto.etapaOperacional as EtapaOperacional)?projeto:null
     const cardsManuais=manuais.filter(m=>col.criterios.includes(m.etapa as EtapaOperacional))
     const cardsCompras=pedidos.filter(p=>col.criterios.includes(p.status==='aguardando'?'aguardando_materiais':'compras'))
     return <div key={col.id} onDragOver={e=>{if(arrastando&&permissoes?.mover){e.preventDefault();e.dataTransfer.dropEffect='move'}}}
      onDrop={e=>{if(arrastando&&permissoes?.mover){e.preventDefault();const id=arrastando;setArrastando(null);void salvar('mover',id,col.criterios[0])}}}
      className="min-h-[260px] overflow-hidden rounded-lg border border-white/10" style={{background:base}}>
      <h3 className="flex items-center justify-between px-2 py-3 text-[11px] font-bold text-white" style={{background:cor}}>
       <span>{col.nome}</span><span className="rounded-full bg-white/15 px-1.5">{Number(!!cardReal)+cardsManuais.length+cardsCompras.length}</span>
      </h3>
      <div className="space-y-2 p-1.5">
       {cardReal&&<div className="rounded-lg border border-emerald-300 bg-white p-2.5 text-slate-900 shadow">
        <p className="text-[11px] font-extrabold">{cardReal.cliente}</p>
        <p className="text-[10px] text-slate-600">Orçamento {cardReal.numeroOrcamento}</p>
        <p className="mt-2 rounded bg-emerald-50 p-1 text-[10px] font-semibold text-emerald-800">Venda real · {cardReal.projeto}</p>
        {!!cardReal.pendencias?.length&&<p className="mt-2 text-[10px] text-amber-800">{cardReal.pendencias[0]}</p>}
       </div>}
       {cardsCompras.map(p=>{const foto=p.detalhesCompra?.find(item=>podeFoto(item.fotoUrl))?.fotoUrl
        return <Link key={p.id} href="/compras/solicitacoes" className="block rounded-lg border-l-4 border-l-violet-500 bg-white p-2 text-slate-900 shadow">
         <div className="flex items-center gap-1 text-[10px] font-bold text-violet-700"><ShoppingCart size={13}/> Compra vinculada</div>
         <p className="mt-1 text-[11px] font-semibold">{p.descricao}</p>
         {foto?<img src={foto} alt="Foto real do produto vinculado" className="mt-1 h-16 w-full rounded object-cover"/>:<p className="mt-1 flex items-center gap-1 rounded bg-slate-100 p-2 text-[10px] text-slate-500"><ImageOff size={12}/> Imagem do produto pendente</p>}
         <p className="mt-1 text-[10px] text-slate-500">{p.recebidos} de {p.itens} itens recebidos</p>
        </Link>})}
       {cardsManuais.map(m=><div key={m.id} draggable={permissoes?.mover&&!salvando}
        onDragStart={e=>{e.dataTransfer.setData('text/plain',m.id);setArrastando(m.id)}} onDragEnd={()=>setArrastando(null)}
        className="rounded-lg border-l-4 border-l-sky-500 bg-white p-2.5 text-slate-900 shadow">
        <p className="text-[9px] font-bold uppercase text-sky-700">Acompanhamento manual</p>
        <p className="mt-1 text-[11px] font-extrabold">{m.titulo}</p>
        {m.descricao&&<p className="mt-1 text-[10px] text-slate-600">{m.descricao}</p>}
        {permissoes?.mover&&<select aria-label={'Mover '+m.titulo} disabled={salvando} value={m.etapa} onChange={e=>void salvar('mover',m.id,e.target.value)} className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1 py-1.5 text-[10px]">
         {etapas.map(e=><option key={e} value={e}>{nomesEtapas[e]}</option>)}
        </select>}
        {permissoes?.retirar&&<button type="button" disabled={salvando} onClick={()=>void salvar('retirar',m.id)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-700"><Trash2 size={12}/> Retirar card</button>}
       </div>)}
       {!cardReal&&!cardsManuais.length&&!cardsCompras.length&&<p className="rounded border border-dashed border-white/20 py-6 text-center text-[10px] text-slate-400">Sem cards</p>}
      </div>
     </div>
    })}
   </div>
  </div>
  {!!dados?.retiradosManuais?.length&&permissoes?.restaurar&&<div className="border-t border-[#314e70] p-3 text-xs text-slate-200">
   <p className="mb-2 font-bold">Cartões de acompanhamento retirados ({dados.retiradosManuais.length})</p>
   <div className="flex flex-wrap gap-2">{dados.retiradosManuais.map(c=><div key={c.id} className="inline-flex items-center gap-2 rounded-lg border border-[#3e5a79] px-2 py-1.5">
    <span>{c.titulo}</span><button disabled={salvando} onClick={()=>void salvar('restaurar',c.id)} className="inline-flex items-center gap-1 font-bold text-sky-200"><RotateCcw size={12}/> Restaurar</button>
   </div>)}</div>
  </div>}
  <p className="border-t border-[#2f4863] px-4 py-2 text-[10px] text-slate-400">Atualização automática a cada 15 segundos enquanto a tela estiver aberta. As mudanças operacionais continuam no Cliente 360 e no Compras 360. {dados?.atualizadoEm?'Última consulta: '+new Date(dados.atualizadoEm).toLocaleString('pt-BR'):''}</p>
 </section>
}
