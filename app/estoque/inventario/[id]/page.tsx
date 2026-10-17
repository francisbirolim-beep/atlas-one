'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type P = {codigo:string|null;nome:string;categoria:string;unidade:string|null;foto_url:string|null}
type Item = {id:string;quantidade_contada:number;saldo_referencia:number|null;custo_inicial_referencia:number|null;quantidade_aplicada_delta:number|null;produto:P|null}
type Inventario = {id:string;status:string;created_at:string;observacoes:string|null;criado_por_nome:string;aprovado_por_nome:string|null;aprovado_em:string|null;local:{nome:string;codigo:string}|null}
type Dados = {ok:boolean;master:boolean;inventario:Inventario;itens:Item[]}
const n=(v:number|null)=>v==null?'Não inventariado':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3})
const moeda=(v:number|null)=>v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

export default function RevisarInventario(){
 const params=useParams<{id:string}>()
 const [dados,setDados]=useState<Dados|null>(null)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const [loading,setLoading]=useState(true)
 const [aplicando,setAplicando]=useState(false)
 async function carregar(){
  const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
  const resp=await fetch('/api/estoque/inventario/'+params.id,{cache:'no-store',headers:{Authorization:'Bearer '+token}})
  const json=await resp.json().catch(()=>({}))
  if(!resp.ok)throw new Error(json.error||'Inventário indisponível.')
  setDados(json)
 }
 useEffect(()=>{
  let ativo=true
  async function iniciar(){try{await carregar()}catch(e){if(ativo)setErro(e instanceof Error?e.message:'Erro ao carregar.')}finally{if(ativo)setLoading(false)}}
  iniciar()
  return ()=>{ativo=false}
 },[params.id])
 async function aprovar(){
  if(!dados||!dados.master||dados.inventario.status!=='rascunho')return
  if(!window.confirm('Confirmar a aplicação desta contagem? O estoque será ajustado e cada alteração ficará registrada no histórico.'))return
  setAplicando(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/estoque/inventario/'+params.id+'/aprovar',{method:'POST',headers:{Authorization:'Bearer '+token}})
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw new Error(json.error||'Erro na aprovação.')
   setMensagem('Inventário aplicado: '+json.itens+' produto(s) verificado(s), '+json.ajustes+' ajuste(s) lançados.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro na aprovação.')}
  finally{setAplicando(false)}
 }
 if(loading)return <main className="p-6 text-slate-600"><Loader2 className="inline animate-spin" size={18}/> Carregando...</main>
 if(!dados)return <main className="p-6 text-red-700">{erro||'Inventário não encontrado.'}</main>
 const {inventario,master,itens}=dados
 const pendentesCusto=itens.filter(i=>i.quantidade_contada>0&&i.saldo_referencia==null&&(i.custo_inicial_referencia==null||i.custo_inicial_referencia<=0)).length
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
  <header><Link href="/estoque/inventario" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Voltar às contagens</Link>
   <h1 className="mt-3 text-2xl font-bold text-slate-900">Revisão do inventário</h1>
   <p className="mt-1 text-sm text-slate-600">{inventario.local?.nome||'Local'} • {inventario.criado_por_nome} • {new Date(inventario.created_at).toLocaleString('pt-BR')}</p>
   <p className="mt-1 text-sm font-semibold">{inventario.status==='rascunho'?'Aguardando aprovação':inventario.status==='aplicado'?'Aplicado':'Cancelado'}</p>
  </header>
  {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
  {mensagem&&<p className="rounded-xl border bg-white p-4 text-sm font-semibold text-emerald-700">{mensagem}</p>}
  {inventario.observacoes&&<p className="rounded-xl border bg-white p-4 text-sm"><b>Observações:</b> {inventario.observacoes}</p>}
  <section className="overflow-x-auto rounded-xl border bg-white">
   <table className="min-w-[850px] w-full text-sm">
    <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Produto e imagem</th><th className="p-3 text-right">Referência do Atlas</th><th className="p-3 text-right">Contagem real</th><th className="p-3 text-right">Diferença</th>{master&&<th className="p-3 text-right">Custo de referência</th>}</tr></thead>
    <tbody>{itens.map(i=><tr key={i.id} className="border-t align-top">
     <td className="p-3"><div className="flex gap-3">
      {i.produto&&['perfil','acessorio'].includes(i.produto.categoria)&&(i.produto.foto_url
       ?<img className="h-14 w-14 shrink-0 rounded-lg border object-contain" src={i.produto.foto_url} alt={i.produto.nome}/>
       :<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-center text-[10px] text-amber-800">Foto pendente</div>)}
      <div><p className="font-semibold">{i.produto?.codigo||'—'} — {i.produto?.nome||'Produto'}</p><p className="text-xs text-slate-500">{i.produto?.unidade||'unidade'}</p></div>
     </div></td>
     <td className="p-3 text-right">{n(i.saldo_referencia)}</td>
     <td className="p-3 text-right font-semibold">{n(i.quantidade_contada)}</td>
     <td className="p-3 text-right">{inventario.status==='aplicado'?n(i.quantidade_aplicada_delta):i.saldo_referencia==null?'Primeira contagem':n(i.quantidade_contada-i.saldo_referencia)}</td>
     {master&&<td className="p-3 text-right">{moeda(i.custo_inicial_referencia)}</td>}
    </tr>)}</tbody>
   </table>
  </section>
  {inventario.status==='aplicado'&&<p className="flex items-center gap-2 text-sm font-medium text-slate-700"><CheckCircle2 size={18}/> Aplicado por {inventario.aprovado_por_nome||'Master'} em {inventario.aprovado_em?new Date(inventario.aprovado_em).toLocaleString('pt-BR'):'—'}. O histórico foi mantido.</p>}
  {inventario.status==='rascunho'&&<div className="rounded-xl border bg-white p-5">
   <div className="flex items-center gap-2"><ClipboardCheck size={20}/><h2 className="font-bold">Aplicar correções</h2></div>
   <p className="mt-2 text-sm text-slate-600">A aprovação ajusta o saldo somente dos produtos desta contagem, no local selecionado. O Atlas bloqueia alterações se algum saldo tiver mudado desde o registro. Custo técnico do cadastro de produtos não será sobrescrito.</p>
   {pendentesCusto>0&&master&&<p className="mt-2 text-sm text-amber-800">Há {pendentesCusto} produto(s) com quantidade positiva e sem custo inicial conhecido. Atualize o cadastro de custo antes de criar e aprovar uma nova contagem.</p>}
   <div className="mt-4 flex justify-end"><button disabled={!master||aplicando||pendentesCusto>0} onClick={aprovar} className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-40">{aplicando?'Aplicando...':master?'Aprovar e ajustar estoque':'Aguardando aprovação Master'}</button></div>
  </div>}
 </div></main>
}
