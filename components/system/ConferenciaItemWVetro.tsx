'use client'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import type {ItemEsquadria} from '@/lib/tipos'
import {diferencasItemWVetro,statusItemWVetro,resolverTipologiaDigitada} from '@/lib/wvetroValidacaoItem'
import {tokenAtual} from '@/lib/auth'

type Props={item:ItemEsquadria;original?:ItemEsquadria;fluxo:unknown;cardId:string;catalogo:Record<string,string>;ocupado:boolean;onConfirmar:(modo:'correto'|'corrigir')=>Promise<boolean>;onTipo:(tipo:string,texto:string|null)=>void;onCampo:(campo:keyof ItemEsquadria,valor:any)=>void;onRestaurar:()=>void}
export default function ConferenciaItemWVetro({item,original,fluxo,cardId,catalogo,ocupado,onConfirmar,onTipo,onCampo,onRestaurar}:Props){
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
  <p className="text-xs text-slate-600">Edite diretamente os campos desta esquadria, inclusive linha, configuração e vidro, no quadro técnico logo abaixo. Depois salve a correção ou confirme que está certo.</p>
  {mudou&&<p className="text-xs text-blue-700">Campos alterados: {Object.keys(diffs).map(c=>({tipo_esquadria:'tipologia',tipo_outro_texto:'descrição da tipologia',largura_mm:'largura',altura_mm:'altura',linha_nome:'linha',configuracao_nome:'configuração',variaveis:'variáveis técnicas',observacao_tempera:'observação de têmpera',observacao_producao:'observação de produção'}[c]||c)).join(', ')}.</p>}
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={ocupado||!original||mudou||estado!=='pendente'} onClick={()=>void onConfirmar('correto')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Está certo</button>
   <button type="button" disabled={ocupado||!original} onClick={()=>{
    if(!mudou){
      setMensagem('Clique em qualquer campo da ficha para corrigir. A linha e todas as variáveis estão editáveis logo abaixo.');
      document.getElementById(`linha-correcao-${item.id}`)?.focus();
      return;
    }
    void onConfirmar('corrigir').then(salvo=>{if(salvo)setMensagem('Correção salva e registrada para aprendizado.')})
   }} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
    {ocupado?'Registrando…':mudou?'Salvar correções e ensinar':'Corrigir e ensinar'}
   </button>
   {mudou&&<button type="button" disabled={ocupado} onClick={()=>{onRestaurar();setMensagem('Alterações descartadas.')}} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">Desfazer alterações</button>}
   <button type="button" disabled={ocupado||buscando||!original} onClick={()=>void buscarAprendizado()} className="rounded-lg border px-3 py-2 text-xs text-blue-800 disabled:opacity-40">{buscando?'Consultando…':'Ver aprendizado'}</button>
  </div>
  {!original&&<p className="text-xs text-amber-800">Salve a nova esquadria antes de conferir a importação.</p>}
  {sugestao&&<div className="text-xs text-slate-700">Correção anterior para este modelo e linha: <b>{sugestao.nome}</b>. <button type="button" disabled={ocupado} onClick={()=>{onTipo(sugestao.tipo,sugestao.texto);setSugestao(null)}} className="underline text-blue-800">Usar para conferir</button></div>}
  {mensagem&&<p role="status" className="text-xs text-slate-600">{mensagem}</p>}
 </div>
}

export function EditorTecnicoWVetro({
  item,original,onCampo,ocupado
}:{
  item:ItemEsquadria
  original?:ItemEsquadria
  onCampo:(campo:keyof ItemEsquadria,valor:any)=>void
  ocupado:boolean
}){
 const [linhas,setLinhas]=useState<string[]>([])
 const [novaVariavel,setNovaVariavel]=useState('')
 const [novoValor,setNovoValor]=useState('')
 useEffect(()=>{
   let ativo=true
   void supabase.from('linhas_tecnicas').select('nome').eq('ativo',true).order('nome').limit(150)
    .then(({data})=>{if(ativo&&data)setLinhas(data.map(linha=>String(linha.nome)).filter(Boolean))})
   return ()=>{ativo=false}
 },[])
 const diferencas=original?diferencasItemWVetro(original,item):{}
 const alteracaoTecnica=['linha_nome','configuracao_nome','variaveis'].some(c=>c in diferencas)
 const variaveis=Object.entries(item.variaveis||{}).filter(([chave])=>!chave.startsWith('wvetro_'))
 function editarVariavel(chave:string,valor:string|number|boolean|null){
   onCampo('variaveis',{...(item.variaveis||{}),[chave]:valor})
 }
 function adicionarVariavel(){
   const chave=novaVariavel.trim().replace(/\s+/g,'_')
   if(!chave||chave.length>100||chave.startsWith('wvetro_')||
      ['__proto__','prototype','constructor'].includes(chave)||
      Object.prototype.hasOwnProperty.call(item.variaveis||{},chave))return
   editarVariavel(chave,novoValor)
   setNovaVariavel('');setNovoValor('')
 }
 return <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3 text-xs">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="font-bold text-blue-900">Configuração técnica · campos editáveis</p>
   <span className={`rounded-full px-2 py-1 font-semibold ${alteracaoTecnica?'bg-amber-100 text-amber-800':item.configuracao_validada?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-800'}`}>
    {alteracaoTecnica?'Alterada · salvar correção':item.configuracao_validada?'Configuração validada':'Conferir configuração'}
   </span>
  </div>
  <p className="text-[11px] text-slate-600">Toque no campo para alterar. Você pode trocar a linha, a configuração, o vidro e cada variável. Para salvar, use “Salvar correções e ensinar” no início desta esquadria.</p>
  <div>
   <label htmlFor={`linha-correcao-${item.id}`} className="block mb-1 text-xs font-medium text-slate-700">Linha de alumínio</label>
   <input id={`linha-correcao-${item.id}`} list={`linhas-correcao-${item.id}`} value={item.linha_nome||''}
    onChange={e=>onCampo('linha_nome',e.target.value||null)} disabled={ocupado}
    placeholder="Ex.: Suprema, Gold, Plus ou outra linha" className="w-full rounded-lg border border-blue-300 bg-white p-2 text-xs"/>
   <datalist id={`linhas-correcao-${item.id}`}>{linhas.map(nome=><option key={nome} value={nome}/>)}</datalist>
  </div>
  <div>
   <label htmlFor={`config-correcao-${item.id}`} className="block mb-1 text-xs font-medium text-slate-700">Configuração / modelo técnico</label>
   <input id={`config-correcao-${item.id}`} value={item.configuracao_nome||''}
    onChange={e=>onCampo('configuracao_nome',e.target.value||null)} disabled={ocupado}
    placeholder="Configuração da esquadria" className="w-full rounded-lg border border-blue-300 bg-white p-2 text-xs"/>
  </div>
  <div className="space-y-2">
   <p className="font-medium text-slate-700">Variáveis técnicas · todas editáveis</p>
   {variaveis.map(([chave,valor])=><div key={chave} className="flex flex-col gap-1">
    <label htmlFor={`var-correcao-${item.id}-${chave}`} className="text-xs font-medium text-slate-600">{chave.replace(/_/g,' ')}</label>
    <div className="flex gap-2">
     {typeof valor==='boolean'
      ? <select id={`var-correcao-${item.id}-${chave}`} value={valor?'true':'false'} disabled={ocupado}
          onChange={e=>editarVariavel(chave,e.target.value==='true')} className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white p-2 text-xs">
         <option value="true">Sim</option><option value="false">Não</option>
        </select>
      : <input id={`var-correcao-${item.id}-${chave}`} type={typeof valor==='number'?'number':'text'} value={valor??''}
         disabled={ocupado} maxLength={4000} step={typeof valor==='number'?'any':undefined}
         onChange={e=>editarVariavel(chave,typeof valor==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)}
         className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white p-2 text-xs"/>}
     <button type="button" disabled={ocupado} onClick={()=>{
      const novas={...(item.variaveis||{})};delete novas[chave];onCampo('variaveis',novas)
     }} className="rounded-md px-2 text-xs text-rose-700 underline">Excluir</button>
    </div>
   </div>)}
   {!variaveis.length&&<p className="text-[11px] text-slate-500">Sem variáveis adicionais. Cadastre uma abaixo.</p>}
   <div className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-2 space-y-2">
    <p className="text-[11px] text-slate-600">Adicionar variável técnica (ex.: roldana, puxador, trilho)</p>
    <div className="grid grid-cols-2 gap-2">
     <input aria-label="Nome da variável" value={novaVariavel} onChange={e=>setNovaVariavel(e.target.value)}
      placeholder="Nome" disabled={ocupado} className="min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-xs"/>
     <input aria-label="Valor da variável" value={novoValor} onChange={e=>setNovoValor(e.target.value)}
      placeholder="Valor" disabled={ocupado} className="min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-xs"/>
    </div>
    <button type="button" disabled={ocupado||!novaVariavel.trim()||novaVariavel.trim().startsWith('wvetro_')}
     onClick={adicionarVariavel} className="rounded-lg bg-blue-100 px-3 py-2 font-semibold text-blue-900 disabled:opacity-40">+ Adicionar variável</button>
   </div>
  </div>
  <p className="text-[11px] text-amber-800">Alterar dados técnicos deixa a receita anterior pendente de nova conferência. Os dados originais de importação W.Vetro permanecem preservados para auditoria.</p>
  {Object.entries(item.variaveis||{}).some(([chave])=>chave.startsWith('wvetro_'))&&
    <details className="text-[11px] text-slate-500"><summary className="cursor-pointer">Dados de origem W.Vetro (somente leitura)</summary>
      {Object.entries(item.variaveis||{}).filter(([chave])=>chave.startsWith('wvetro_')).map(([chave,valor])=>
       <div key={chave} className="mt-1">{chave.replace(/_/g,' ')}: {String(valor??'')}</div>)}
    </details>}
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
