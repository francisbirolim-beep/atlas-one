'use client'
import {FormEvent,useState} from 'react'
import {FileText,Pencil,Plus,Trash2} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {UNIDADES_CMV,unidadePadraoCmv,rotuloUnidadeCmv,mostrarQuantidadeCmv} from '@/lib/vendaCmvUnidades'
export type RecebimentoCmv={
 id:string;categoria:string;peso_kg:number|null;preco_kg:number|null;quantidade?:number|null;unidade?:string|null;preco_unitario?:number|null;valor_total:number;fornecedor:string;
 nota_numero?:string|null;romaneio_numero?:string|null;data_recebimento:string;
 anexo_nome?:string|null;anexo_url?:string|null;observacoes?:string|null;
 criado_por_nome?:string|null;versao:number;cancelado_em?:string|null;motivo_cancelamento?:string|null;conferido_em?:string|null;conferido_por_nome?:string|null
}
export type HistoricoRecebimento={id:string;recebimento_id:string;alterado_em:string;alterado_por_nome:string|null;antes:Record<string,unknown>;depois:Record<string,unknown>}
const moedas=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const kg=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:3})+' kg'
const num=(s:string)=>{const t=s.trim();if(!t)return 0;return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t)||0}
function hoje(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
export default function VendaCmvRecebimentos({vendaId,categoria,registros,historico,disponivel,onAtualizar}:{
 vendaId:string;categoria:string;registros:RecebimentoCmv[];historico:HistoricoRecebimento[];
 disponivel:boolean;onAtualizar:()=>Promise<void>
}){
 const [abrir,setAbrir]=useState(false)
 const [editar,setEditar]=useState<string|null>(null)
 const [excluir,setExcluir]=useState<string|null>(null)
 const [motivo,setMotivo]=useState('')
 const [peso,setPeso]=useState('')
 const [preco,setPreco]=useState('')
 const [unidade,setUnidade]=useState(unidadePadraoCmv(categoria))
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [sucesso,setSucesso]=useState('')
 const [selecionados,setSelecionados]=useState<string[]>([])
 const bloqueado=!disponivel
 const registrosCategoria=registros.filter(r=>r.categoria===categoria&&!r.cancelado_em)
 const pendentesConferencia=registrosCategoria.filter(r=>!r.conferido_em)
 const todosSelecionados=pendentesConferencia.length>0&&pendentesConferencia.every(r=>selecionados.includes(r.id))
 const onChangePeso=(v:string)=>setPeso(v)
 const onChangePreco=(v:string)=>setPreco(v)
 function abrirForm(registro?:RecebimentoCmv){
  setErro('');setSucesso('');setExcluir(null);setMotivo('')
  setEditar(registro?.id||null);setUnidade((registro?.unidade||unidadePadraoCmv(categoria)) as typeof unidade)
  setPeso(registro?String(registro.quantidade??(categoria==='perfil'?registro.peso_kg??'':'' )).replace('.',','):'')
  setPreco(registro?String(registro.preco_unitario??registro.preco_kg??'').replace('.',','):'')
  setAbrir(true)
 }
 async function enviar(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(salvando)return
  const form=e.currentTarget
  const dados=new FormData(form)
  dados.set('vendaId',vendaId);dados.set('categoria',categoria)
  if(editar){
   const registro=registrosCategoria.find(r=>r.id===editar)
   if(!registro)return
   dados.set('recebimentoId',registro.id);dados.set('versao',String(registro.versao))
  }
  setSalvando(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv/recebimentos',{
    method:editar?'PATCH':'POST',headers:{Authorization:'Bearer '+token},body:dados
   })
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Erro ao gravar recebimento.')
   setAbrir(false);setEditar(null);await onAtualizar()
   setSucesso('Recebimento salvo separadamente. Nenhum custo comprado foi duplicado.')
  }catch(error){setErro(error instanceof Error?error.message:'Falha ao registrar recebimento.')}
  finally{setSalvando(false)}
 }
 async function cancelar(registro:RecebimentoCmv){
  if(salvando||motivo.trim().length<5)return
  setErro('');setSucesso('');setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv/recebimentos',{method:'DELETE',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,recebimentoId:registro.id,versao:registro.versao,motivo:motivo.trim()})})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Falha ao cancelar.')
   setExcluir(null);setMotivo('');await onAtualizar()
   setSucesso('Recebimento cancelado com histórico e documento preservados.')
  }catch(error){setErro(error instanceof Error?error.message:'Falha ao cancelar recebimento.')}
  finally{setSalvando(false)}
 }
 async function validarRecebidos(ids:string[]){
  if(salvando||bloqueado||ids.length===0)return
  setSalvando(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv/recebimentos',{method:'PUT',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,ids})})
   const data=await resp.json()
   if(!resp.ok)throw new Error(data.error||'Falha ao conferir recebimentos.')
   setSelecionados([]);await onAtualizar()
   setSucesso(String(data.validados||0)+' recebimento(s) confirmado(s) sem duplicar o custo comprado.')
  }catch(error){setErro(error instanceof Error?error.message:'Falha ao confirmar recebimentos.')}
  finally{setSalvando(false)}
 }
 return <section className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><b className="text-sm text-slate-800">Recebimento de material</b>
    <p className="text-[11px] text-slate-500">Quantidade recebida na unidade selecionada (kg, unidade, peça ou pacote) e valor recebido. Sem alterar Compras ou o orçamento.</p>
   </div>
   <button type="button" disabled={salvando} onClick={()=>abrir?setAbrir(false):abrirForm()}
    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">
    <Plus size={13}/>{abrir?'Fechar formulário':'Cadastrar recebido'}
   </button>
  </div>
  {bloqueado&&<p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Prévia de conferência: você pode abrir o formulário e escolher KG, UN, PC ou PCT, mas não pode salvar nem confirmar até homologarmos a estrutura de recebimentos em um banco separado. Nenhuma compra existente será alterada.</p>}
  {erro&&<p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
  {sucesso&&<p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">{sucesso}</p>}
  {abrir&&<form key={editar||'novo'} onSubmit={enviar} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
   <p className="mb-3 text-xs font-bold">{editar?'Corrigir recebimento existente':'Cadastrar o que chegou (nota/romaneio)'}</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold">Quantidade recebida ({rotuloUnidadeCmv(unidade)}) *<input name="quantidade" required inputMode="decimal" value={peso} onChange={e=>onChangePeso(e.target.value)}
     placeholder="Ex.: 110" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Unidade *<select name="unidade" required value={unidade} onChange={e=>setUnidade(e.target.value as typeof unidade)} className="mt-1 w-full rounded-lg border bg-white p-2.5">{UNIDADES_CMV.map(u=><option key={u} value={u}>{u==='KG'?'Quilo (KG)':u==='UN'?'Unidade (UN)':u==='PC'?'Peça (PC)':'Pacote (PCT)'}</option>)}</select></label>
    <label className="text-xs font-semibold">Preço por {rotuloUnidadeCmv(unidade)} (R$) *<input name="preco_unitario" required inputMode="decimal" value={preco} onChange={e=>onChangePreco(e.target.value)}
     placeholder="Ex.: 8,32" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <div className="rounded-lg border bg-white p-2.5"><div className="text-[11px] font-semibold text-slate-500">Custo recebido calculado</div><b className="text-lg">{moedas(Math.round(num(peso)*num(preco)*100)/100)}</b></div>
    <label className="text-xs font-semibold">Fornecedor *<input required maxLength={150} name="fornecedor"
     defaultValue={registrosCategoria.find(r=>r.id===editar)?.fornecedor||''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Número da nota fiscal<input name="nota_numero" maxLength={100}
     defaultValue={registrosCategoria.find(r=>r.id===editar)?.nota_numero||''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Número do romaneio<input name="romaneio_numero" maxLength={100}
     defaultValue={registrosCategoria.find(r=>r.id===editar)?.romaneio_numero||''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Data do recebimento *<input required name="data_recebimento" type="date"
     defaultValue={registrosCategoria.find(r=>r.id===editar)?.data_recebimento||hoje()} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold sm:col-span-2">Anexo da nota ou romaneio (PDF ou imagem, até 15 MB)<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full rounded-lg border bg-white p-2.5"/>
     {editar&&<span className="block text-[11px] font-normal text-slate-500">Sem novo arquivo, o anexo anterior é preservado.</span>}</label>
    <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Observações<input name="observacoes" maxLength={1000}
     defaultValue={registrosCategoria.find(r=>r.id===editar)?.observacoes||''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
   </div>
   <p className="mt-2 text-[11px] text-slate-500">Informe pelo menos a nota fiscal ou o romaneio. Cada entrega parcial pode ter um registro. A correção mantém histórico.</p>
   <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={()=>setAbrir(false)} className="rounded-lg border bg-white px-3 py-2 text-xs">Cancelar</button>
    <button disabled={bloqueado||salvando||num(peso)<=0||num(preco)<=0} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
     {salvando?'Salvando...':editar?'Salvar correção':'Registrar recebimento'}</button></div>
  </form>}
  {pendentesConferencia.length>0&&<div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2 text-xs">
    <button type="button" disabled={salvando} onClick={()=>setSelecionados(todosSelecionados?[]:pendentesConferencia.map(r=>r.id))} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">{todosSelecionados?'Desmarcar todos':'Selecionar todos'}</button>
    <button type="button" disabled={bloqueado||salvando||selecionados.filter(id=>pendentesConferencia.some(r=>r.id===id)).length===0} onClick={()=>void validarRecebidos(selecionados.filter(id=>pendentesConferencia.some(r=>r.id===id)))} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">Confirmar selecionados ({selecionados.filter(id=>pendentesConferencia.some(r=>r.id===id)).length})</button>
    <span className="text-slate-500">Confirma recebimentos já registrados; não lança novos custos.</span>
   </div>}
  {registrosCategoria.length>0?<div className="space-y-2">{registrosCategoria.map(r=><div key={r.id} className="rounded-lg border p-3 text-xs">
   <div className="flex flex-wrap items-start justify-between gap-2">
    <div><b>{r.unidade?mostrarQuantidadeCmv(Number(r.quantidade||0),r.unidade):kg(Number(r.peso_kg||0))} × {moedas(Number(r.preco_unitario??r.preco_kg??0))}/{rotuloUnidadeCmv(r.unidade||'KG')}</b>
     {!r.unidade&&categoria!=='perfil'&&<p className="font-semibold text-amber-800">Registro antigo em kg: conferir a unidade antes de comparar quantidades.</p>}
     <p className="mt-1 text-slate-500">{r.fornecedor} · {r.data_recebimento}
      {r.nota_numero?' · NF '+r.nota_numero:''}{r.romaneio_numero?' · Romaneio '+r.romaneio_numero:''}</p>
     {r.anexo_url&&<a href={r.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 underline"><FileText size={12}/>{r.anexo_nome||'Anexo'}</a>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
     {!r.conferido_em&&<label className="inline-flex items-center gap-1 text-slate-600"><input type="checkbox" aria-label="Selecionar recebimento" disabled={salvando} checked={selecionados.includes(r.id)} onChange={e=>setSelecionados(prev=>e.target.checked?[...prev,r.id]:prev.filter(id=>id!==r.id))}/> Selecionar</label>}
     {r.conferido_em&&<span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Recebido confirmado{r.conferido_por_nome?' por '+r.conferido_por_nome:''}</span>}
     <b className="text-sm">{moedas(Number(r.valor_total))}</b>
     {!r.conferido_em&&<button type="button" disabled={salvando||bloqueado} onClick={()=>void validarRecebidos([r.id])} className="rounded-lg border border-emerald-300 px-2 py-1.5 font-semibold text-emerald-700 disabled:opacity-50">Confirmar este</button>}
     <button type="button" disabled={salvando||bloqueado} onClick={()=>abrirForm(r)} className="rounded-lg border px-2 py-1.5 text-blue-700"><Pencil size={13}/></button>
     <button type="button" disabled={salvando||bloqueado} onClick={()=>{setExcluir(excluir===r.id?null:r.id);setMotivo('');setAbrir(false)}} className="rounded-lg border px-2 py-1.5 text-red-700"><Trash2 size={13}/></button>
    </div>
   </div>
   {excluir===r.id&&<div className="mt-3 space-y-2 rounded-lg bg-red-50 p-3">
    <b>Cancelar apenas este recebimento?</b><p>O documento e a auditoria serão preservados. Não altera a compra.</p>
    <input required minLength={5} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo obrigatório (mín. 5 caracteres)" className="w-full rounded-lg border bg-white p-2"/>
    <button type="button" disabled={salvando||motivo.trim().length<5} onClick={()=>void cancelar(r)} className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-40">Confirmar cancelamento</button>
   </div>}
   {historico.some(h=>h.recebimento_id===r.id)&&<details className="mt-2 border-t pt-2"><summary className="cursor-pointer text-slate-600">Histórico de ajustes</summary>
    {historico.filter(h=>h.recebimento_id===r.id).map(h=><p key={h.id} className="mt-1 text-slate-500">{h.alterado_por_nome||'Usuário'} · {new Date(h.alterado_em).toLocaleString('pt-BR')} · Valor anterior: {moedas(Number(h.antes.valor_total||0))} → {moedas(Number(h.depois.valor_total||0))}</p>)}
   </details>}
  </div>)}</div>:<p className="text-xs text-slate-500">Nenhum recebimento registrado nesta categoria.</p>}
 </section>
}
