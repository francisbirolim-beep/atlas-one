'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import {CheckCircle2,FileDown,FileText,ImageOff,Loader2,Pencil,RefreshCw,ShieldCheck} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'

type Linha={
 id:string;codigo:string;descricao:string;tipo:string;tratamento:string;
 quantidade_barras:number;tamanho_barra_mm:number;peso_kg?:number|null;sobra_kg?:number|null;imagem_url?:string|null;imagem_pendente?:boolean;status_validacao:string;status_compra:string;validado_em?:string|null;
 codigo_origem:string;descricao_origem:string;tipo_origem:string;tratamento_origem:string;
 quantidade_origem:number;tamanho_origem_mm:number;observacao_correcao?:string|null
}
type Preview={
 indice:number;codigo:string;descricao:string;tipo:string;tratamento:string;
 quantidade:number;tamanho_mm:number;peso_kg:number|null;sobra_kg:number|null;
 sugestao?:{codigo:string;descricao:string;tipo:string;tratamento:string;tamanho_barra_mm:number;ocorrencias:number}|null
}
type Editavel={
 indice:number;codigo:string;descricao:string;tipo:string;tratamento:string;
 quantidade_barras:number;tamanho_barra_mm:number;justificativa:string
}
const etapas=[
 {id:'necessidade',titulo:'Falta comprar'},
 {id:'cotacao',titulo:'Em cotação'},
 {id:'comprado',titulo:'Comprado'},
 {id:'entrega',titulo:'Aguardando chegar'},
 {id:'recebido',titulo:'Recebido'},
]
const qtd=(v:number)=>Number(v||0).toLocaleString('pt-BR')
const val=(v:string|number|null|undefined)=>String(v??'')
const api='/api/vendas/wvetro/barras'

export default function VendaBarrasWVetro({vendaId,numeroWvetro,onAbrirCorte,modo='lista'}:{
 vendaId:string;numeroWvetro:string;onAbrirCorte:()=>void;modo?:'lista'|'kanban'
}){
 const [lista,setLista]=useState<Linha[]>([])
 const [historico,setHistorico]=useState<Array<{evento:string;justificativa?:string;validado_por_nome?:string;created_at:string}>>([])
 const [arquivo,setArquivo]=useState<File|null>(null)
 const [preview,setPreview]=useState<Preview[]>([])
 const [edicoes,setEdicoes]=useState<Editavel[]>([])
 const [ocupado,setOcupado]=useState(false)
 const [erro,setErro]=useState('')
 const [msg,setMsg]=useState('')
 const [selecionadas,setSelecionadas]=useState<string[]>([])
 const [editando,setEditando]=useState<string|null>(null)
 const [draft,setDraft]=useState<Editavel|null>(null)
 const fileInput=useRef<HTMLInputElement>(null)

 const carregar=useCallback(async()=>{
  try{
   const token=await tokenAtual()
   if(!token)return
   const r=await fetch(api+'?vendaId='+encodeURIComponent(vendaId),
    {headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw new Error(json.error||'Não foi possível consultar as barras.')
   setLista(json.barras||[])
   setHistorico(json.aprendizados||[])
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar barras.')}
 },[vendaId])
 useEffect(()=>{void carregar()},[carregar])

 const total=lista.reduce((s,x)=>s+Number(x.quantidade_barras||0),0)
 const todosSelecionados=lista.length>0&&lista.every(row=>selecionadas.includes(row.id))
 function alternarItem(id:string){setSelecionadas(anterior=>anterior.includes(id)?anterior.filter(x=>x!==id):[...anterior,id])}
 function alternarTodos(){setSelecionadas(todosSelecionados?[]:lista.map(row=>row.id))}
 async function enviarSelecionadosCompras(){
  const ids=lista.filter(row=>selecionadas.includes(row.id)).map(row=>row.id)
  if(!ids.length){setErro('Selecione um ou mais materiais antes de validar e enviar a Compras.');return}
  if(!window.confirm('Validar e enviar '+ids.length+' linha(s) de barras comerciais para o Kanban de Compras desta venda? Itens já enviados não serão duplicados.'))return
  setOcupado(true);setErro('');setMsg('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch(api,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({vendaId,acao:'validar_enviar_compras',barras:ids})})
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw new Error(json.error||'Não foi possível liberar os itens para Compras.')
   setMsg(json.enviadas+' linha(s) enviada(s) para Compras. '+json.jaEmCompras+' linha(s) já estava(m) no fluxo e foram preservadas. Confira os cards na aba Compras desta venda.')
   setSelecionadas([])
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao enviar para Compras.')}
  finally{setOcupado(false)}
 }
 const valido=lista.filter(x=>x.status_validacao!=='pendente').length
 const grupo=useMemo(()=>Object.fromEntries(etapas.map(e=>[e.id,lista.filter(x=>Boolean(x.validado_em)&&x.status_compra===e.id)])),[lista])
 async function analisar(){
  if(!arquivo)return
  setOcupado(true);setErro('');setMsg('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const fd=new FormData()
   fd.append('vendaId',vendaId);fd.append('acao','analisar');fd.append('arquivo',arquivo)
   const r=await fetch(api,{method:'POST',headers:{Authorization:'Bearer '+token},body:fd})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw new Error(json.error||'Não foi possível analisar o relatório.')
   setPreview(json.linhas||[])
   setEdicoes((json.linhas||[]).map((x:Preview)=>({
    indice:x.indice,codigo:x.codigo,descricao:x.descricao,tipo:x.tipo,tratamento:x.tratamento,
    quantidade_barras:x.quantidade,tamanho_barra_mm:x.tamanho_mm,justificativa:'',
   })))
   setMsg(json.linhas.length+' linhas e '+json.totalBarras+' barras encontradas no orçamento WVetro #'+json.numeroWvetro+'. Revise antes de validar.')
  }catch(e){setErro(e instanceof Error?e.message:'PDF indisponível.')}
  finally{setOcupado(false)}
 }
 async function importar(){
  if(!arquivo||!edicoes.length||ocupado)return
  if(!window.confirm('Confirmar as '+edicoes.length+' linhas de barras comerciais do WVetro nesta venda? Não serão efetuadas compras, movimentações de estoque ou alterações nos cortes.'))return
  setOcupado(true);setErro('');setMsg('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const fd=new FormData()
   fd.append('vendaId',vendaId);fd.append('acao','importar')
   fd.append('arquivo',arquivo);fd.append('edicoes',JSON.stringify(edicoes))
   const r=await fetch(api,{method:'POST',headers:{Authorization:'Bearer '+token},body:fd})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw new Error(json.error||'Não foi possível registrar as barras.')
   setPreview([]);setEdicoes([]);setArquivo(null)
   if(fileInput.current)fileInput.current.value=''
   setMsg('Foram registradas '+json.importados+' linhas de barras para compra. Origem e validação documentadas.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar barras.')}
  finally{setOcupado(false)}
 }
 async function validarPendentes(){
  const ids=lista.filter(row=>row.status_validacao==='pendente').map(row=>row.id)
  if(!ids.length||ocupado)return
  if(!window.confirm('Validar '+ids.length+' linha(s) de barras, sem alterações, conforme o relatório original WVetro? Confira códigos, acabamentos e quantidades antes de confirmar.'))return
  setOcupado(true);setErro('');setMsg('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch(api,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao:'validar_lote',barras:ids})})
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw new Error(json.error||'Falha ao validar barras.')
   setMsg(json.validadas+' barra(s) do relatório conferidas. Histórico de validação registrado.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha de validação.')}
  finally{setOcupado(false)}
 }
 async function salvarEdicao(row:Linha,acao:'corrigir'|'mover',status?:string){
  setOcupado(true);setErro('');setMsg('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const dados={vendaId,barraId:row.id,acao,
    ...(acao==='corrigir'?{dados:draft,justificativa:draft?.justificativa||''}:{status})}
   const r=await fetch(api,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(dados)})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw new Error(json.error||'Falha ao salvar.')
   setEditando(null);setDraft(null)
   setMsg(acao==='corrigir'?'Conferência salva com histórico para aprendizado.':'Card movido sem alterar outras barras.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.')}
  finally{setOcupado(false)}
 }
 function editar(row:Linha){
  setEditando(row.id)
  setDraft({indice:0,codigo:row.codigo,descricao:row.descricao,tipo:row.tipo,
   tratamento:row.tratamento,quantidade_barras:row.quantidade_barras,
   tamanho_barra_mm:row.tamanho_barra_mm,justificativa:''})
 }
 function mudarPreview(i:number,changes:Partial<Editavel>){
  setEdicoes(prev=>prev.map((e,j)=>i===j?{...e,...changes}:e))
 }
 function editarCampo(chave:keyof Editavel,valor:string){
  setDraft(prev=>prev?{...prev,[chave]:chave==='quantidade_barras'||chave==='tamanho_barra_mm'?Number(valor):valor}:prev)
 }
 return <section className="mb-5 space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h3 className="text-base font-bold text-slate-900">{modo==='lista'?'Lista de compra · Barras Utilizadas':'Acompanhamento das barras comerciais'} · WVetro #{numeroWvetro||'—'}</h3>
    <p className="mt-1 text-xs text-slate-600">Fonte: relatório <b>Barras Utilizadas</b>. Quantidade em barras inteiras (BR), não em peças cortadas. Cada acabamento, código e comprimento permanece separado.</p>
    <p className="mt-1 text-[11px] text-emerald-800">{lista.length} linha(s) · {qtd(total)} barras · {lista.filter(x=>Boolean(x.validado_em)).length}/{lista.length} linha(s) liberadas para Compras</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    {modo==='lista'&&lista.length>0&&<Link target="_blank" href={'/compras/barras/'+vendaId+'?conferencia=estoque'+(selecionadas.length?'&barras='+selecionadas.join(','):'')} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><FileDown size={13}/>Conferir estoque / Imprimir PDF</Link>}
    {modo==='lista'&&<button type="button" onClick={onAbrirCorte} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700">Ver lista de corte na Produção</button>}
    <button type="button" disabled={ocupado} onClick={()=>void carregar()} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw size={13}/>Atualizar</button>
   </div>
  </div>
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
  {msg&&<p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{msg}</p>}
  {!lista.length&&modo==='lista'&&<div className="rounded-xl border bg-white p-4">
   <b className="text-sm text-slate-800">Importar relatório Barras Utilizadas do WVetro</b>
   <p className="mt-1 text-xs text-slate-500">Abra o orçamento no WVetro, selecione “BARRAS UTILIZADAS” e envie o PDF. O Atlas verifica o número do orçamento antes de importar. Nenhuma compra é criada sem validação.</p>
   <div className="mt-3 flex flex-wrap items-center gap-3">
    <input ref={fileInput} type="file" accept=".pdf,application/pdf" onChange={e=>{setArquivo(e.target.files?.[0]||null);setPreview([]);setEdicoes([])}} className="max-w-full text-xs"/>
    <button type="button" disabled={!arquivo||ocupado} onClick={()=>void analisar()} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{ocupado?'Conferindo...':'Analisar PDF das barras'}</button>
   </div>
  </div>}
  {modo==='lista'&&preview.length>0&&<div className="rounded-xl border bg-white p-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-slate-800">Conferência do relatório antes da importação</b><button disabled={ocupado} onClick={()=>void importar()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><ShieldCheck size={14}/>Validar e registrar {edicoes.length} linha(s)</button></div>
   <p className="my-2 text-[11px] text-slate-500">Ao corrigir qualquer campo, informe o motivo. O relatório original é preservado como referência de aprendizado.</p>
   <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-xs">
    <thead className="bg-slate-100"><tr><th className="p-2 text-left">Código</th><th>Descrição</th><th>Acabamento</th><th>Tipo</th><th>Qtd. BR</th><th>Barra (mm)</th><th>Justificativa da correção</th><th>Aprendizado</th></tr></thead>
    <tbody>{edicoes.map((e,i)=><tr key={e.indice} className="border-t">
     {(['codigo','descricao','tratamento','tipo','quantidade_barras','tamanho_barra_mm','justificativa'] as const).map(c=><td key={c} className="p-1"><input className="w-full min-w-[80px] rounded border px-2 py-1" aria-label={c+' '+e.codigo} type={c==='quantidade_barras'||c==='tamanho_barra_mm'?'number':'text'} value={e[c]} onChange={ev=>mudarPreview(i,{[c]:c==='quantidade_barras'||c==='tamanho_barra_mm'?Number(ev.target.value):ev.target.value})}/></td>)}
    <td className="p-2">{preview[i]?.sugestao&&<button type="button" className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700"
     onClick={()=>mudarPreview(i,{codigo:preview[i].sugestao!.codigo,descricao:preview[i].sugestao!.descricao,
      tipo:preview[i].sugestao!.tipo,tratamento:preview[i].sugestao!.tratamento,
      tamanho_barra_mm:preview[i].sugestao!.tamanho_barra_mm,
      justificativa:'Sugestão de correção supervisionada confirmada nesta obra'})}>
     Sugestão anterior ({preview[i].sugestao!.ocorrencias})</button>}</td>
    </tr>)}</tbody>
   </table></div>
  </div>}
  {modo==='lista'&&lista.length>0&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white p-3">
   <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={alternarTodos} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">{todosSelecionados?'Desmarcar todos':'Selecionar todos'}</button>
    <span className="text-xs font-semibold text-slate-600">{selecionadas.length} de {lista.length} material(is) selecionado(s)</span>
   </div>
   <button type="button" disabled={ocupado||!selecionadas.length} onClick={()=>void enviarSelecionadosCompras()} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><CheckCircle2 size={13} className="mr-1 inline"/>Validar e liberar para Compras</button>
  </div>}
  {modo==='lista'&&lista.length>0&&<div className="overflow-x-auto rounded-xl border bg-white">
   <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Relação de barras comerciais da obra · {lista.length} linhas · {qtd(total)} barras</div>
   <table className="w-full min-w-[1100px] text-left text-xs">
    <thead className="bg-slate-100 text-slate-700"><tr>
     <th className="p-2"><input aria-label="Selecionar todas as barras da obra" type="checkbox" checked={todosSelecionados} onChange={alternarTodos}/></th><th className="p-2">Imagem do perfil</th><th className="p-2">Código</th><th className="p-2">Descrição</th>
     <th className="p-2">Acabamento / cor</th><th className="p-2">Tipo</th>
     <th className="p-2 text-right">Qtd. de barras (BR)</th>
     <th className="p-2 text-right">Comprimento barra</th>
     <th className="p-2 text-right">Peso (kg)</th><th className="p-2 text-right">Sobra (kg)</th>
     <th className="p-2">Conferência</th><th className="p-2">Ações</th>
    </tr></thead>
    <tbody>{lista.map(row=><tr key={row.id} className="border-t align-top">
     <td className="p-2"><input type="checkbox" aria-label={'Selecionar perfil '+row.codigo} checked={selecionadas.includes(row.id)} onChange={()=>alternarItem(row.id)}/></td>
     <td className="p-2"><div className={'flex w-[92px] flex-col items-center gap-1 rounded-lg border p-1 '+(!row.imagem_url?'border-amber-300 bg-amber-50':'border-slate-200')}>
      {row.imagem_url?<img src={row.imagem_url} alt={'Imagem técnica do perfil '+row.codigo} className="h-12 w-12 object-contain"/>:<ImageOff size={18} className="text-amber-500"/>}
      {!row.imagem_url&&<span className="text-center text-[10px] font-semibold text-amber-700">Imagem pendente</span>}
     </div></td>
     <td className="p-2 font-mono font-bold text-slate-900">{row.codigo}</td>
     <td className="p-2 text-slate-800">{row.descricao}</td>
     <td className="p-2">{row.tratamento}</td><td className="p-2">{row.tipo}</td>
     <td className="p-2 text-right font-bold text-blue-800">{qtd(row.quantidade_barras)} BR</td>
     <td className="p-2 text-right">{qtd(row.tamanho_barra_mm)} mm</td>
     <td className="p-2 text-right">{row.peso_kg==null?'—':Number(row.peso_kg).toLocaleString('pt-BR',{maximumFractionDigits:3})}</td>
     <td className="p-2 text-right">{row.sobra_kg==null?'—':Number(row.sobra_kg).toLocaleString('pt-BR',{maximumFractionDigits:3})}</td>
     <td className="p-2"><span className={row.status_validacao==='pendente'?'font-semibold text-amber-700':'font-semibold text-emerald-700'}>{row.validado_em?'Liberado para compras':row.status_validacao==='corrigido'?'Corrigido; conferir estoque':'Conferir estoque'}</span></td>
     <td className="p-2">
      <button type="button" disabled={ocupado} onClick={()=>editar(row)} className="rounded border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700"><Pencil size={11} className="inline"/> Conferir / corrigir</button>
      {row.status_validacao!=='pendente'&&<Link target="_blank" href={'/compras/barras/'+vendaId+'?barraId='+row.id} className="mt-1 block text-[11px] font-semibold text-blue-700"><FileText size={11} className="inline"/> PDF da barra</Link>}
      {editando===row.id&&draft&&<div className="mt-2 min-w-[235px] space-y-1 rounded border bg-slate-50 p-2">
       {(['codigo','descricao','tratamento','tipo','quantidade_barras','tamanho_barra_mm','justificativa'] as const).map(c=><label key={c} className="block text-[10px] text-slate-600">{c}<input type={c==='quantidade_barras'||c==='tamanho_barra_mm'?'number':'text'} value={draft[c]} onChange={ev=>editarCampo(c,ev.target.value)} className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs"/></label>)}
       <button disabled={ocupado} onClick={()=>void salvarEdicao(row,'corrigir')} className="w-full rounded bg-emerald-700 px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">Salvar conferência</button>
       <button onClick={()=>{setEditando(null);setDraft(null)}} className="w-full rounded border px-2 py-1 text-[11px]">Cancelar</button>
      </div>}
     </td>
    </tr>)}</tbody>
    <tfoot className="bg-slate-100 font-bold"><tr><td colSpan={6} className="p-3">Total para compra</td><td className="p-3 text-right">{qtd(total)} BR</td><td colSpan={5} className="p-3 text-right">{lista.filter(x=>x.status_validacao==='pendente').length} linha(s) aguardando validação</td></tr></tfoot>
   </table>
  </div>}
  {modo==='kanban'&&!lista.some(x=>Boolean(x.validado_em))&&<div className="rounded-xl border border-dashed bg-white p-4 text-xs text-slate-600">Nenhum perfil liberado para Compras. Confira o estoque, selecione os materiais e valide na aba Materiais.</div>}
  {modo==='kanban'&&lista.some(x=>Boolean(x.validado_em))&&<div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-5">
   {etapas.map((e,indice)=><div key={e.id} className="min-h-32 rounded-xl border-t-4 border-emerald-300 bg-white/70 p-2">
    <div className="mb-2 flex items-center justify-between"><b className="text-xs text-slate-800">{e.titulo}</b><span className="rounded-full bg-white px-2 py-0.5 text-[10px]">{grupo[e.id]?.length||0}</span></div>
    <div className="space-y-2">{(grupo[e.id]||[]).map(row=><div key={row.id} className="rounded-lg border bg-white p-2.5 shadow-sm">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
       {row.imagem_url?<img src={row.imagem_url} alt={'Perfil '+row.codigo} className="h-10 w-10 rounded border object-contain"/>:<span className="flex h-10 w-10 flex-col items-center justify-center rounded border border-amber-300 bg-amber-50 text-[8px] text-amber-700"><ImageOff size={14}/>Pendente</span>}
       <b className="text-xs text-slate-900">{row.codigo}</b>
      </div>
      <span className="text-[11px] font-black text-blue-800">{qtd(row.quantidade_barras)} BR</span>
     </div>
     <p className="mt-1 text-[10px] text-slate-600">{row.descricao}</p>
     <p className="mt-1 text-[10px] text-slate-600">{row.tratamento} · {row.tipo}</p>
     <p className="mt-1 text-[10px] font-semibold text-slate-700">Barra {qtd(row.tamanho_barra_mm)} mm</p>
     {row.status_validacao!=='pendente'&&<Link target="_blank" href={'/compras/barras/'+vendaId+'?barraId='+row.id} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700"><FileText size={12}/>PDF deste card</Link>}
     <p className={'mt-1 text-[10px] font-semibold '+(row.status_validacao==='pendente'?'text-amber-700':'text-emerald-700')}>{row.status_validacao==='pendente'?'Pendente de validação':row.status_validacao==='corrigido'?'Corrigido e validado':'Validado'}</p>
     {editando===row.id&&draft&&<div className="mt-2 space-y-1 rounded-lg border bg-slate-50 p-2">
      {(['codigo','descricao','tratamento','tipo','quantidade_barras','tamanho_barra_mm','justificativa'] as const).map(c=><label key={c} className="block text-[10px] text-slate-600">{c}<input type={c==='quantidade_barras'||c==='tamanho_barra_mm'?'number':'text'} value={draft[c]} onChange={ev=>editarCampo(c,ev.target.value)} className="mt-0.5 w-full rounded border px-2 py-1 text-xs"/></label>)}
      <button disabled={ocupado} onClick={()=>void salvarEdicao(row,'corrigir')} className="w-full rounded bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-40">Salvar / Validar</button>
      <button onClick={()=>{setEditando(null);setDraft(null)}} className="w-full rounded border px-2 py-1 text-xs">Cancelar</button>
     </div>}
     {editando!==row.id&&<div className="mt-2 flex flex-wrap gap-1">
      <button disabled={ocupado} onClick={()=>editar(row)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold text-blue-700"><Pencil size={12}/>Validar / corrigir</button>
      {row.status_validacao!=='pendente'&&indice<4&&<button disabled={ocupado} onClick={()=>void salvarEdicao(row,'mover',etapas[indice+1].id)} className="rounded border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700">Avançar →</button>}
     </div>}
    </div>)}{!(grupo[e.id]||[]).length&&<p className="rounded-lg border border-dashed bg-white/50 p-3 text-center text-[10px] text-slate-400">Nenhuma barra</p>}</div>
   </div>)}
  </div>}
  {modo==='kanban'&&lista.length>0&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">As etapas acima são acompanhamento operacional de barras: não geram pedido de fornecedor, NF, pagamento ou baixa de estoque automaticamente. Mantenha o histórico dos cards antigos de cortes disponível abaixo para consulta.</p>}
  {historico.length>0&&<details className="rounded-lg border bg-white p-3 text-xs"><summary className="cursor-pointer font-semibold">Histórico de validações e aprendizado supervisionado ({historico.length})</summary><div className="mt-2 space-y-1">{historico.slice(0,30).map((h,i)=><p key={i} className="border-t py-1 text-slate-600">{h.evento} · {h.validado_por_nome||'Usuário'} · {new Date(h.created_at).toLocaleString('pt-BR')}{h.justificativa?' · '+h.justificativa:''}</p>)}</div></details>}
 </section>
}