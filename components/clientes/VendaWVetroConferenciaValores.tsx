'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Eye, ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import type { DiferencaConferenciaWVetro, WVetroConferencia } from '@/lib/wvetroConferenciaValores'

const brl=(n:number|null|undefined)=>n==null?'Não informado':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const delta=(n:number|null)=>n===null?'Não calculado':(n>0?'+':'')+brl(n)
const d=(x:number|null)=>x!==null&&Math.abs(x)>0.01
export default function VendaWVetroConferenciaValores({vendaId}:{vendaId:string}){
 const [dados,setDados]=useState<WVetroConferencia|null>(null)
 const [diferencas,setDiferencas]=useState<DiferencaConferenciaWVetro|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [consultando,setConsultando]=useState(false)
 const [erro,setErro]=useState('')
 const [aviso,setAviso]=useState('')
 const buscar=useCallback(async(aoVivo:boolean)=>{
  if(aoVivo)setConsultando(true);else setCarregando(true)
  setErro('');setAviso('')
  if(!aoVivo)setDiferencas(null)
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sua sessão expirou. Entre novamente.')
   const url='/api/vendas/wvetro/conferencia-valores?vendaId='+encodeURIComponent(vendaId)+(aoVivo?'&aoVivo=1':'')
   const resp=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await resp.json().catch(()=>({}))
   if(!resp.ok)throw Error(json.error||'Falha ao conferir os valores.')
   setDados(json.conferencia)
   if(aoVivo)setDiferencas(json.diferencas||null)
   setAviso(aoVivo?'Consulta ao W.Vetro concluída agora, somente para conferência. Nada foi gravado no Atlas.':'')
  }catch(e){setErro(e instanceof Error?e.message:'Falha na conferência.')}
  finally{setCarregando(false);setConsultando(false)}
 },[vendaId])
 useEffect(()=>{setDados(null);setDiferencas(null);void buscar(false)},[buscar])
 return <section className="rounded-2xl border border-blue-200 bg-white shadow-sm" aria-label="Conferência de valores originais W.Vetro">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-5 py-4">
   <div>
    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><ArrowRightLeft size={18} className="text-blue-700"/> Conferência W.Vetro × Atlas</h2>
    <p className="mt-1 text-xs text-slate-600">Comparação dos valores originais de cada tipologia e do orçamento, sem alterar a venda, CMV, compras ou financeiro.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    {dados&&<span className="rounded-full border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700">Orçamento W.Vetro #{dados.numero}</span>}
    <button type="button" onClick={()=>void buscar(true)} disabled={consultando||carregando||!dados}
     className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">
     {consultando?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>}
     {consultando?'Consultando W.Vetro...':'Consultar W.Vetro agora'}
    </button>
   </div>
  </div>
  <div className="space-y-4 p-5">
   {carregando&&!dados&&<p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin"/> Conferindo valores importados...</p>}
   {erro&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{erro}{dados?' A última conferência permanece visível.':''}</p>}
   {aviso&&<p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={15}/>{aviso}</p>}
   {dados&&<>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
     <span>Fonte exibida: <b className="text-slate-800">{dados.fonte==='consulta_ao_vivo'?'Consulta ao W.Vetro realizada agora':'Dados importados do W.Vetro'}</b></span>
     {dados.dataCaptura&&<span>Registro da importação: {new Date(dados.dataCaptura).toLocaleString('pt-BR')}</span>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">Venda total W.Vetro (líquida)</p>
      <b className="mt-1 block text-lg text-slate-900">{brl(dados.totais.vendaLiquidaWVetro)}</b>
      <p className="mt-1 text-xs text-slate-500">Bruto {brl(dados.totais.vendaBrutaWVetro)} · desconto {brl(dados.totais.descontoWVetro)}</p>
     </div>
     <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">Custo geral W.Vetro</p>
      <b className="mt-1 block text-lg text-slate-900">{brl(dados.totais.custoGeralWVetro)}</b>
      <p className="mt-1 text-xs text-slate-500">Campo original CustoComSobra; CustoSemSobra: {brl(dados.totais.custoAlternativoWVetro)}</p>
     </div>
     <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">Venda confirmada no Atlas</p>
      <b className={'mt-1 block text-lg '+(d(dados.totais.diferencaVendaAtlas)?'text-amber-800':'text-slate-900')}>{brl(dados.totais.vendaAtlas)}</b>
      <p className="mt-1 text-xs text-slate-500">Diferença frente ao W.Vetro: {delta(dados.totais.diferencaVendaAtlas)}</p>
     </div>
     <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">Custo previsto no Atlas</p>
      <b className={'mt-1 block text-lg '+(d(dados.totais.diferencaCustoAtlas)?'text-amber-800':'text-slate-900')}>{brl(dados.totais.custoAtlas)}</b>
      <p className="mt-1 text-xs text-slate-500">Diferença frente ao custo geral: {delta(dados.totais.diferencaCustoAtlas)}</p>
     </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
     <table className="min-w-[760px] w-full text-left text-xs">
      <thead className="bg-slate-50 text-slate-600"><tr>
       <th className="px-3 py-3 font-bold">Tipologia W.Vetro</th>
       <th className="px-3 py-3 text-right font-bold">Qtd.</th>
       <th className="px-3 py-3 text-right font-bold">Custo W.Vetro</th>
       <th className="px-3 py-3 text-right font-bold">Venda W.Vetro</th>
       <th className="px-3 py-3 text-right font-bold">Venda item Atlas</th>
      </tr></thead>
      <tbody>{dados.itens.map(i=><tr key={i.ordem} className="border-t align-middle">
       <td className="px-3 py-3">
        <div className="flex min-w-[240px] items-center gap-3">
         <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
          {i.imagemUrl?<img src={i.imagemUrl} alt={'Imagem da tipologia '+i.descricao} className="h-full w-full object-contain"/>:<ImageIcon size={17} className="text-slate-300"/>}
         </div>
         <div><b className="text-slate-800">{i.descricao}</b><p className="mt-1 text-[11px] text-slate-500">Item {i.ordem} · {i.codigo||'sem código'}</p></div>
        </div>
       </td>
       <td className="px-3 py-3 text-right">{i.quantidade}</td>
       <td className="px-3 py-3 text-right font-semibold">{brl(i.custoWVetro)}</td>
       <td className="px-3 py-3 text-right font-semibold">{brl(i.vendaWVetro)}</td>
       <td className="px-3 py-3 text-right text-slate-600">{brl(i.vendaAtlas)}</td>
      </tr>)}</tbody>
      <tfoot className="bg-slate-50 font-bold text-slate-800"><tr className="border-t">
       <td className="px-3 py-3">Soma das tipologias</td>
       <td className="px-3 py-3 text-right">{dados.itens.reduce((s,i)=>s+i.quantidade,0)}</td>
       <td className="px-3 py-3 text-right">{brl(dados.totais.custoTipologias)}</td>
       <td className="px-3 py-3 text-right">{brl(dados.totais.vendaTipologias)}</td>
       <td className="px-3 py-3 text-right">{brl(dados.itens.every(i=>i.vendaAtlas!==null)?Math.round(dados.itens.reduce((s,i)=>s+(i.vendaAtlas||0),0)*100)/100:null)}</td>
      </tr></tfoot>
     </table>
    </div>
    {diferencas&&<section aria-label="Prévia das alterações da sincronização" className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
       <h3 className="text-sm font-bold text-slate-900">Prévia da sincronização W.Vetro — o que mudou</h3>
       <p className="mt-1 text-xs text-slate-600">Comparação entre os dados importados e a consulta feita agora. Nenhuma informação foi aplicada à venda.</p>
      </div>
      <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-bold text-indigo-800">Somente conferência</span>
     </div>
     <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
      <span className="rounded-lg bg-white px-2.5 py-1.5 text-blue-800">{diferencas.qtdAlteradas} alterada(s)</span>
      <span className="rounded-lg bg-white px-2.5 py-1.5 text-emerald-800">{diferencas.qtdIncluidas} incluída(s)</span>
      <span className="rounded-lg bg-white px-2.5 py-1.5 text-amber-800">{diferencas.qtdRemovidas} removida(s)</span>
      <span className="rounded-lg bg-white px-2.5 py-1.5 text-slate-700">{diferencas.qtdSemMudanca} sem mudança</span>
      {diferencas.qtdIncertas>0&&<span className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-900">{diferencas.qtdIncertas} exigem conferência de identificação</span>}
     </div>
     <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[700px] w-full text-left text-xs">
       <thead className="bg-slate-50 text-slate-600"><tr>
        <th className="px-3 py-2">Total</th>
        <th className="px-3 py-2 text-right">Importado antes</th>
        <th className="px-3 py-2 text-right">Consultado agora</th>
        <th className="px-3 py-2 text-right">Alteração</th>
       </tr></thead>
       <tbody>{diferencas.totais.map(total=><tr key={total.chave} className={'border-t '+(total.mudou?'bg-amber-50/40':'')}>
        <td className="px-3 py-2 font-semibold">{total.rotulo}</td>
        <td className="px-3 py-2 text-right">{brl(total.anterior)}</td>
        <td className="px-3 py-2 text-right font-semibold">{brl(total.novo)}</td>
        <td className={'px-3 py-2 text-right '+(total.mudou?'font-bold text-amber-800':'text-slate-500')}>
         {total.diferenca===null?'Conferir':total.mudou?delta(total.diferenca):'Sem mudança'}
        </td>
       </tr>)}</tbody>
      </table>
     </div>
     <h4 className="mb-2 mt-4 text-xs font-bold text-slate-800">Alterações por tipologia</h4>
     <div className="space-y-2">{diferencas.itens.map(item=>{
      const antigo=item.anterior,novo=item.novo
      const label=item.status==='alterada'?'Alterada':item.status==='incluida'?'Incluída':item.status==='removida'?'Removida':item.status==='sem_alteracao'?'Sem alteração':'Conferir vínculo'
      return <div key={item.chave} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
       <div className="flex flex-wrap items-start justify-between gap-2">
        <b className="max-w-[75%] text-slate-800">{novo?.descricao||antigo?.descricao||'Tipologia sem identificação'}</b>
        <span className={'rounded-md px-2 py-1 font-bold '+(item.status==='sem_alteracao'?'bg-slate-100 text-slate-600':item.status==='incluida'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800')}>{label}</span>
       </div>
       <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p className="text-slate-600">Custo: <b>{brl(antigo?.custoWVetro)} → {brl(novo?.custoWVetro)}</b></p>
        <p className="text-slate-600">Venda: <b>{brl(antigo?.vendaWVetro)} → {brl(novo?.vendaWVetro)}</b></p>
        <p className="text-slate-600">Quantidade: <b>{antigo?.quantidade??'—'} → {novo?.quantidade??'—'}</b></p>
        <p className="text-slate-500">Identificador W.Vetro: {novo?.chaveWVetro||antigo?.chaveWVetro||'não informado'}</p>
       </div>
       {item.alteracoes.length>0&&<p className="mt-2 text-[11px] text-slate-500">Alterações identificadas: {item.alteracoes.join(' · ')}</p>}
      </div>
     })}</div>
     <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <b>Aplicação automática bloqueada nesta fase.</b>
      <p className="mt-1">A venda já foi confirmada. Precisamos revisar diferenças e impactos no financeiro, documentos, custos e produção antes de autorizar qualquer atualização.</p>
      {diferencas.avisos.filter(a=>!a.startsWith('Comparação somente leitura')).map((a,i)=><p className="mt-1" key={i}>• {a}</p>)}
     </div>
    </section>}
    {dados.alertas.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
     <p className="flex items-center gap-2 text-xs font-bold text-amber-900"><AlertTriangle size={15}/> Divergências identificadas</p>
     <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-900">
      {dados.alertas.map((texto,i)=><li key={i}>{texto}</li>)}
     </ul>
     {dados.totais.diferencaCustoGeralTipologias!==null&&<p className="mt-2 text-xs text-amber-900">Custo geral menos soma das tipologias: <b>{delta(dados.totais.diferencaCustoGeralTipologias)}</b>. Manter as duas referências, sem arredondamento ou rateio automático.</p>}
    </div>}
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
     <Eye size={16} className="mt-0.5 shrink-0"/>
     <p><b>Prévia de conferência, sem gravação.</b> O botão acima faz uma nova consulta ao W.Vetro, mas não substitui os valores de uma venda já confirmada. A sincronização com aplicação de alterações será preparada separadamente, com comparação, autorização, histórico e confirmação.</p>
    </div>
   </>}
  </div>
 </section>
}
