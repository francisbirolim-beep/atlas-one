'use client'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import type {ItemEsquadria} from '@/lib/tipos'
import {diferencasItemWVetro,statusItemWVetro,resolverTipologiaDigitada} from '@/lib/wvetroValidacaoItem'
import {tokenAtual} from '@/lib/auth'

type Props={item:ItemEsquadria;original?:ItemEsquadria;fluxo:unknown;cardId:string;catalogo:Record<string,string>;ocupado:boolean;onConfirmar:(modo:'correto'|'corrigir')=>Promise<boolean>;onTipo:(tipo:string,texto:string|null)=>void;onCampo:(campo:keyof ItemEsquadria,valor:any)=>void;onRestaurar:()=>void}
export default function ConferenciaItemWVetro({item,original,fluxo,cardId,catalogo,ocupado,onConfirmar,onTipo,onCampo,onRestaurar}:Props){
 const [corrigindo,setCorrigindo]=useState(false)
 const [linhas,setLinhas]=useState<string[]>([])
 const [novaVariavel,setNovaVariavel]=useState('')
 const [novoValor,setNovoValor]=useState('')
 useEffect(()=>{
  if(!corrigindo)return
  let ativo=true
  void supabase.from('linhas_tecnicas').select('nome').eq('ativo',true).order('nome').limit(150)
   .then(({data})=>{if(ativo&&data)setLinhas(data.map((linha:any)=>String(linha.nome)).filter(Boolean))})
  return ()=>{ativo=false}
 },[corrigindo])
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
  {mudou&&<p className="text-xs text-blue-700">Campos alterados: {Object.keys(diffs).map(c=>({tipo_esquadria:'tipologia',tipo_outro_texto:'descrição da tipologia',largura_mm:'largura',altura_mm:'altura',linha_nome:'linha',configuracao_nome:'configuração',variaveis:'variáveis técnicas',observacao_tempera:'observação de têmpera',observacao_producao:'observação de produção'}[c]||c)).join(', ')}.</p>}
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={ocupado||!original||mudou||estado!=='pendente'} onClick={()=>void onConfirmar('correto')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Está certo</button>
   <button type="button" disabled={ocupado||!original||(corrigindo&&!mudou)} onClick={()=>{
    if(!corrigindo){setCorrigindo(true);return}
    void onConfirmar('corrigir').then(salvo=>{if(salvo)setCorrigindo(false)})
   }} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
    {ocupado?'Registrando…':!corrigindo?'Corrigir e ensinar':mudou?'Salvar correções e ensinar':'Altere os campos abaixo'}
   </button>
   <button type="button" disabled={ocupado||buscando||!original} onClick={()=>void buscarAprendizado()} className="rounded-lg border px-3 py-2 text-xs text-blue-800 disabled:opacity-40">{buscando?'Consultando…':'Ver aprendizado'}</button>
  </div>
  {corrigindo&&original&&<div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-3">
   <p className="text-xs font-semibold text-blue-900">Modo de correção da esquadria</p>
   <p className="text-xs text-slate-700">Troque a linha, configuração ou variáveis técnicas aqui. Ambiente, tipologia, descrição, folhas, medidas, quantidade, cor e observações podem ser alterados nos campos desta esquadria logo abaixo. Ao terminar, clique em “Salvar correções e ensinar”.</p>
   <div>
    <label htmlFor={`linha-correcao-${item.id}`} className="block mb-1 text-xs text-slate-700">Linha de alumínio</label>
    <input id={`linha-correcao-${item.id}`} list={`linhas-correcao-${item.id}`} value={item.linha_nome||''}
     onChange={e=>onCampo('linha_nome',e.target.value||null)} disabled={ocupado}
     placeholder="Selecione ou digite outra linha" className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs"/>
    <datalist id={`linhas-correcao-${item.id}`}>{linhas.map(nome=><option key={nome} value={nome}/>)}</datalist>
   </div>
   <div>
    <label htmlFor={`config-correcao-${item.id}`} className="block mb-1 text-xs text-slate-700">Configuração / descrição técnica</label>
    <input id={`config-correcao-${item.id}`} value={item.configuracao_nome||''}
     onChange={e=>onCampo('configuracao_nome',e.target.value||null)} disabled={ocupado}
     placeholder="Informe a configuração correta" className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs"/>
   </div>
   <div className="space-y-2">
    <p className="text-xs text-slate-700 font-medium">Variáveis técnicas (trilho, vidro, montagem e outras)</p>
    {Object.entries(item.variaveis||{}).filter(([chave])=>!chave.startsWith('wvetro_')).map(([chave,valor])=><div key={chave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2 items-center">
     <span className="text-[11px] text-slate-700 break-all">{chave.replace(/_/g,' ')}</span>
     <input aria-label={`Valor de ${chave}`} value={String(valor??'')} disabled={ocupado} maxLength={4000}
       onChange={e=>onCampo('variaveis',{...(item.variaveis||{}),[chave]:e.target.value})}
       className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs"/>
     <button type="button" disabled={ocupado} aria-label={`Remover variável ${chave}`} onClick={()=>{
       const novas={...(item.variaveis||{})};delete novas[chave];onCampo('variaveis',novas)
     }} className="text-xs text-rose-700 underline">Excluir</button>
    </div>)}
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
     <input aria-label="Nome da nova variável" placeholder="Nome" value={novaVariavel} onChange={e=>setNovaVariavel(e.target.value)}
      disabled={ocupado} className="min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-xs"/>
     <input aria-label="Valor da nova variável" placeholder="Valor" value={novoValor} onChange={e=>setNovoValor(e.target.value)}
      disabled={ocupado} className="min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-xs"/>
     <button type="button" disabled={ocupado||!novaVariavel.trim()||novaVariavel.trim().startsWith('wvetro_')} onClick={()=>{
       const chave=novaVariavel.trim().replace(/\s+/g,'_')
       if(chave.length>100||Object.prototype.hasOwnProperty.call(item.variaveis||{},chave))return
       onCampo('variaveis',{...(item.variaveis||{}),[chave]:novoValor})
       setNovaVariavel('');setNovoValor('')
     }} className="rounded-lg bg-blue-100 px-2 text-xs text-blue-900 disabled:opacity-40">Adicionar</button>
    </div>
   </div>
   <p className="text-[11px] text-amber-800">Ao trocar linha, configuração ou variáveis, a receita técnica anterior ficará pendente de nova conferência, sem perder a validação da esquadria.</p>
   <button type="button" disabled={ocupado} onClick={()=>{onRestaurar();setCorrigindo(false)}} className="text-xs underline text-slate-600">Descartar correções desta esquadria</button>
  </div>}
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
