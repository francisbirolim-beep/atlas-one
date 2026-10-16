'use client'
import {useState} from 'react'
import type {ItemEsquadria} from '@/lib/tipos'
import {diferencasItemWVetro,statusItemWVetro,resolverTipologiaDigitada} from '@/lib/wvetroValidacaoItem'
import {tokenAtual} from '@/lib/auth'

type Props={item:ItemEsquadria;original?:ItemEsquadria;fluxo:unknown;cardId:string;catalogo:Record<string,string>;ocupado:boolean;onConfirmar:(modo:'correto'|'corrigir')=>Promise<void>;onTipo:(tipo:string,texto:string|null)=>void}
export default function ConferenciaItemWVetro({item,original,fluxo,cardId,catalogo,ocupado,onConfirmar,onTipo}:Props){
 const [mensagem,setMensagem]=useState('')
 const [buscando,setBuscando]=useState(false)
 const estado=original?statusItemWVetro(item,fluxo):'pendente'
 const diffs=original?diferencasItemWVetro(original,item):{}
 const mudou=Object.keys(diffs).length>0
 async function buscarAprendizado(){
  setBuscando(true);setMensagem('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const r=await fetch('/api/integracoes/wvetro/orcamentos/kanban',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({acao:'sugerir_item_importacao',cardId,itemId:item.id})})
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao consultar aprendizado.')
   if(!d.sugestao){setMensagem('Ainda não há correção de tipologia para este modelo e linha. Você pode escrever livremente abaixo.');return}
   const nome=d.sugestao.tipo_esquadria==='outro'?d.sugestao.tipo_outro_texto:catalogo[d.sugestao.tipo_esquadria]||d.sugestao.tipo_esquadria
   setSugestao({tipo:d.sugestao.tipo_esquadria,texto:d.sugestao.tipo_outro_texto,nome})
  }catch(e){setMensagem(e instanceof Error?e.message:'Falha ao consultar aprendizado.')}finally{setBuscando(false)}
 }
 const [sugestao,setSugestao]=useState<{tipo:string;texto:string|null;nome:string}|null>(null)
 return <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-2">
  <p className="text-xs font-semibold text-slate-800">Conferência desta esquadria · {mudou?'Alterações ainda não registradas':estado==='pendente'?'Pendente':estado==='corrigido'?'Corrigida e salva':'Validada e salva · não repetir'}</p>
  <p className="text-xs text-slate-600">Confira ambiente, tipologia, medidas e quantidade abaixo. Corrija somente o que estiver errado.</p>
  {mudou&&<p className="text-xs text-blue-700">Campos alterados: {Object.keys(diffs).map(c=>({tipo_esquadria:'tipologia',tipo_outro_texto:'descrição da tipologia',largura_mm:'largura',altura_mm:'altura'}[c]||c)).join(', ')}.</p>}
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={ocupado||!original||mudou||estado!=='pendente'} onClick={()=>void onConfirmar('correto')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Está certo</button>
   <button type="button" disabled={ocupado||!original||!mudou} onClick={()=>void onConfirmar('corrigir')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{ocupado?'Registrando…':'Corrigir e ensinar'}</button>
   <button type="button" disabled={ocupado||buscando||!original} onClick={()=>void buscarAprendizado()} className="rounded-lg border px-3 py-2 text-xs text-blue-800 disabled:opacity-40">{buscando?'Consultando…':'Ver aprendizado'}</button>
  </div>
  {!original&&<p className="text-xs text-amber-800">Salve a nova esquadria antes de conferir a importação.</p>}
  {sugestao&&<div className="text-xs text-slate-700">Correção anterior para este modelo e linha: <b>{sugestao.nome}</b>. <button type="button" disabled={ocupado} onClick={()=>{onTipo(sugestao.tipo,sugestao.texto);setSugestao(null)}} className="underline text-blue-800">Usar para conferir</button></div>}
  {mensagem&&<p role="status" className="text-xs text-slate-600">{mensagem}</p>}
 </div>
}

export function TipoImportadoWVetro({item,catalogo,onTipo}:{item:ItemEsquadria;catalogo:Record<string,string>;onTipo:(tipo:string,texto:string|null)=>void}){
 const nome=item.tipo_esquadria==='outro'?item.tipo_outro_texto||'':catalogo[item.tipo_esquadria]||item.tipo_esquadria
 const [texto,setTexto]=useState(nome)
 const [ultimo,setUltimo]=useState(nome)
 if(nome!==ultimo){setUltimo(nome);setTexto(nome)}
 function aplicar(v:string){const t=resolverTipologiaDigitada(v,catalogo);onTipo(t.tipo_esquadria,t.tipo_outro_texto)}
 return <div>
  <label htmlFor={`tipo-wvetro-${item.id}`} className="block text-xs text-slate-600 mb-1">Tipologia · busque no catálogo ou escreva livremente</label>
  <input id={`tipo-wvetro-${item.id}`} list={`tipologias-wvetro-${item.id}`} value={texto} onChange={e=>{setTexto(e.target.value);aplicar(e.target.value)}} maxLength={4000} className="w-full rounded-lg border border-slate-300 p-2 text-xs" placeholder="Ex.: Porta de correr 4 folhas"/>
  <datalist id={`tipologias-wvetro-${item.id}`}>{Object.entries(catalogo).filter(([c])=>c!=='outro').map(([c,n])=><option key={c} value={n}/>)}</datalist>
  <p className="mt-1 text-[11px] text-slate-500">{item.tipo_esquadria==='outro'?'Descrição livre aceita. A falta de cadastro não impede a conferência.':'Tipologia encontrada no catálogo.'}</p>
 </div>
}
