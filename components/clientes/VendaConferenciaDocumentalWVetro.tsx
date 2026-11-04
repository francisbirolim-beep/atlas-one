'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,FileText,Loader2,Paperclip,SearchCheck} from 'lucide-react'
import {tokenAtual,usuarioAtual} from '@/lib/auth'

type Linha={
 id:string;codigo:string|null;descricao:string;categoria:string;unidade:string|null;cor:string|null;
 quantidade_atlas:number;quantidade_pdf:number|null;comprimento_corte_mm:number|null;
 codigo_no_pdf:boolean;confianca:number;observacao:string
}
type Registro={
 id:string;titulo:string;data:string;responsavel:string|null;itemRef:string|null;
 tipo:string;origem:string;temPdf:boolean;vigente:boolean
}
const endpoint='/api/vendas/wvetro/conferencia-documental'
const qtd=(n:unknown)=>Number(n??0).toLocaleString('pt-BR',{maximumFractionDigits:3})

export default function VendaConferenciaDocumentalWVetro({vendaId,pacoteId,tipo,itemRef,compacto=false,iniciarAberto=false,onValidacaoRegistrada}:{
 vendaId:string;pacoteId:string|null;tipo:'tipologia'|'materiais';itemRef?:string;compacto?:boolean;iniciarAberto?:boolean;onValidacaoRegistrada?:()=>void
}){
 const [master,setMaster]=useState(false)
 const [arquivo,setArquivo]=useState<File|null>(null)
 const [preview,setPreview]=useState<{itens:Linha[];paginas:number;hash:string;hashFonte:string;pendencias:string[];aviso:string;trecho:string}|null>(null)
 const [registros,setRegistros]=useState<Registro[]>([])
 const [pdfOriginalUrl,setPdfOriginalUrl]=useState<string|null>(null)
 const [aberto,setAberto]=useState(iniciarAberto)
 const [ocupado,setOcupado]=useState(false)
 const [motivo,setMotivo]=useState('')
 const [identidadeConfirmada,setIdentidadeConfirmada]=useState(false)
 const [mensagem,setMensagem]=useState('')
 const [erro,setErro]=useState('')
 const [blobUrl,setBlobUrl]=useState<string|null>(null)
 useEffect(()=>{void usuarioAtual().then(u=>setMaster(u?.role==='master'))},[])
 useEffect(()=>{if(iniciarAberto)setAberto(true)},[iniciarAberto])
 useEffect(()=>{
  if(!arquivo){setBlobUrl(null);return}
  const link=URL.createObjectURL(arquivo);setBlobUrl(link)
  return()=>URL.revokeObjectURL(link)
 },[arquivo])
 const carregar=useCallback(async()=>{
  const token=await tokenAtual();if(!token)return
  try{
   if(!pacoteId)return
   const params=new URLSearchParams({vendaId,pacoteId,tipo,itemRef:itemRef||''})
   const r=await fetch(endpoint+'?'+params.toString(),
    {headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json()
   if(r.ok){
    setRegistros(j.registros||[])
    setPdfOriginalUrl(typeof j.pdfOriginalUrl==='string'&&/^https:\/\//i.test(j.pdfOriginalUrl)?j.pdfOriginalUrl:null)
   }
  }catch{/* Histórico opcional, sem bloquear materiais. */}
 },[vendaId,pacoteId,tipo,itemRef])
 useEffect(()=>{void carregar()},[carregar])
 const historico=useMemo(()=>registros.filter(r=>r.tipo===tipo&&
  (tipo==='materiais'||r.itemRef===itemRef)),[registros,tipo,itemRef])
 const ultimo=historico[0]
 async function requisicao(acao:'analisar'|'validar_pdf'|'validar_atlas'){
  if(ocupado||!pacoteId||!master)return
  if(acao!=='validar_atlas'&&!arquivo){setErro('Selecione o PDF exportado do W.Vetro.');return}
  if(acao==='validar_pdf'&&motivo.trim().length<8){setErro('Informe a justificativa (mínimo de 8 caracteres).');return}
  if(acao==='validar_pdf'&&!preview){setErro('Analise o PDF antes de validar.');return}
  if(acao==='validar_pdf'&&!identidadeConfirmada){setErro('Confirme que o PDF pertence a esta obra.');return}
  setOcupado(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const form=new FormData()
   form.append('vendaId',vendaId);form.append('pacoteId',pacoteId)
   form.append('tipo',tipo);form.append('itemRef',itemRef||'')
   form.append('acao',acao);form.append('justificativa',motivo.trim())
   if(acao==='validar_pdf'&&preview){
    form.append('hash',preview.hash)
    form.append('hashFonte',preview.hashFonte)
    form.append('conferenciaManual',identidadeConfirmada?'sim':'nao')
   }
   if(acao==='validar_pdf'&&identidadeConfirmada)form.append('identidadeConfirmada','sim')
   if(acao!=='validar_atlas'&&arquivo)form.append('arquivo',arquivo)
   if(acao==='validar_pdf'&&preview)form.append('revisao',JSON.stringify(preview.itens.map(x=>({
    id:x.id,codigo:x.codigo,quantidade_pdf:x.quantidade_pdf,codigo_no_pdf:x.codigo_no_pdf,
    confirmado_manualmente:x.observacao==='Quantidade revisada manualmente',observacao:x.observacao
   }))))
   const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const j=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(j.error||'Não foi possível concluir a conferência.')
   if(acao==='analisar'){
    setPreview(j.analise)
    setMensagem('PDF lido. Confira as quantidades e o documento antes de aprovar.')
   }else{
    setMensagem(j.mensagem||'Conferência registrada.')
    setArquivo(null);setPreview(null);setMotivo('');setIdentidadeConfirmada(false)
    await carregar()
    onValidacaoRegistrada?.()
   }
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao analisar o PDF.')}
  finally{setOcupado(false)}
 }
 async function abrirPdf(id:string){
  setErro('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const r=await fetch(endpoint+'?vendaId='+encodeURIComponent(vendaId)+'&arquivoId='+encodeURIComponent(id),
    {headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json()
   if(!r.ok||!j.url)throw Error(j.error||'Não foi possível abrir o PDF.')
   window.open(j.url,'_blank','noopener,noreferrer')
  }catch(e){setErro(e instanceof Error?e.message:'Documento indisponível.')}
 }
 const label=tipo==='tipologia'?'Composição desta tipologia':'Lista consolidada de materiais'
 return <section className={'rounded-xl border border-blue-200 bg-white '+(compacto?'p-3':'p-4')}>
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h4 className="text-sm font-bold text-slate-900">Conferência W.Vetro · {label}</h4>
    <p className="mt-1 text-xs text-slate-500">Confira os dados importados. Se houver divergência, anexe o PDF correto e aprove como referência para o aprendizado supervisionado.</p>
    {ultimo&&<p className={'mt-1 text-[11px] '+(ultimo.vigente?'text-emerald-700':'text-amber-800')}>{ultimo.vigente?'Última validação vigente':'Revisão necessária: a composição mudou após a validação'} · {ultimo.origem==='pdf_corrigido'?'PDF corrigido':'Dados importados'} · {new Date(ultimo.data).toLocaleString('pt-BR')} · {ultimo.responsavel||'Usuário'}</p>}
   </div>
   <button type="button" onClick={()=>setAberto(v=>!v)}
    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700">
    <SearchCheck size={14}/>{aberto?'Fechar conferência':'Abrir conferência / PDF'}
   </button>
  </div>
  {aberto&&<div className="mt-3 space-y-3 border-t pt-3">
   <div className="flex flex-wrap items-center gap-2 text-xs">
    {pdfOriginalUrl?<a href={pdfOriginalUrl} target="_blank" rel="noopener noreferrer"
      className="rounded-lg border border-blue-200 px-3 py-2 font-bold text-blue-700">Abrir PDF original vinculado pelo W.Vetro</a>
     :<p className="text-amber-800">O W.Vetro não forneceu PDF original nesta obra. Use a ficha Atlas para conferência ou anexe o documento exportado.</p>}
   </div>
   {!master?<p className="text-xs text-amber-700">A conferência é visível, mas a validação e a correção documental são reservadas ao usuário Master.</p>:<>
    <div className="flex flex-wrap gap-2">
     <button type="button" disabled={!pacoteId||ocupado} onClick={()=>void requisicao('validar_atlas')}
      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40">
      {ocupado?<Loader2 size={14} className="animate-spin"/>:<CheckCircle2 size={14}/>} Dados importados estão corretos · Validar
     </button>
    </div>
    <div className="rounded-lg border bg-slate-50 p-3">
     <label className="block text-xs font-bold text-slate-700">Se estiver incorreto, anexe o PDF verdadeiro do W.Vetro
      <input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-xs" onChange={e=>{
       setArquivo(e.target.files?.[0]||null);setPreview(null);setIdentidadeConfirmada(false);setMensagem('');setErro('')
      }}/>
     </label>
     {arquivo&&<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <Paperclip size={13}/><span>{arquivo.name}</span>
      {blobUrl&&<a href={blobUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline">Abrir PDF original</a>}
      <button type="button" onClick={()=>void requisicao('analisar')} disabled={ocupado}
       className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-40">
       {ocupado?'Lendo...':'Ler e comparar PDF com o Atlas'}
      </button>
     </div>}
    </div>
    {preview&&<div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
     <div className="text-xs text-slate-700"><b>{preview.paginas} página(s)</b> · {preview.itens.length} materiais de referência.
      <span className="ml-2">A IA sugere correspondências; quantidade vazia significa não identificada com segurança.</span>
     </div>
     {preview.aviso&&<p className="text-xs text-amber-700">{preview.aviso}</p>}
     <div className="max-h-72 overflow-auto rounded-lg border bg-white">
      <table className="w-full min-w-[560px] text-left text-xs">
       <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Código e descrição</th><th className="p-2">Atlas</th><th className="p-2">PDF (revisar)</th><th className="p-2">Identificação</th></tr></thead>
       <tbody>{preview.itens.map((x,i)=><tr key={x.id} className="border-t">
        <td className="p-2"><b>{x.codigo||'—'}</b> · {x.descricao}<div className="text-slate-500">{x.cor||'Cor não informada'}</div></td>
        <td className="p-2">{qtd(x.quantidade_atlas)} {x.unidade||'UN'}</td>
        <td className="p-2"><input type="number" min={0} step="any" value={x.quantidade_pdf??''}
         aria-label={'Quantidade conferida para '+(x.codigo||x.descricao)} placeholder="Não localizada"
         onChange={e=>setPreview(v=>v?{...v,itens:v.itens.map((a,j)=>j===i?{...a,quantidade_pdf:e.target.value===''?null:Number(e.target.value),observacao:'Quantidade revisada manualmente'}:a)}:v)}
         className="w-24 rounded border p-1"/></td>
        <td className="p-2">{x.codigo_no_pdf?'Código encontrado':'Não localizado'}{x.confianca>0&&<div className="text-slate-500">IA: {Math.round(x.confianca*100)}%</div>}</td>
       </tr>)}</tbody>
      </table>
     </div>
     {preview.pendencias?.length>0&&<p className="text-xs text-amber-700">Pendências: {preview.pendencias.join(' · ')}</p>}
     <label className="block text-xs font-bold">Por que este é o PDF correto? (obrigatório)
      <textarea value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={1000}
       className="mt-1 block min-h-16 w-full rounded-lg border bg-white p-2" placeholder="Ex.: A composição importada não incluiu acessórios da tipologia."/>
     </label>
     <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <input type="checkbox" checked={identidadeConfirmada} onChange={e=>setIdentidadeConfirmada(e.target.checked)}/>
      Confirmo que este documento pertence à obra e foi conferido com o relatório original do W.Vetro.
     </label>
     <button type="button" disabled={ocupado||motivo.trim().length<8||!identidadeConfirmada} onClick={()=>void requisicao('validar_pdf')}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
      {ocupado?<Loader2 size={13} className="animate-spin"/>:<CheckCircle2 size={13}/>} Confirmar PDF correto e registrar aprendizado
     </button>
     <p className="text-[11px] text-slate-600">Aprovar o PDF não substitui automaticamente materiais, não cria pedidos e não libera fabricação. Use as ações de edição da tipologia para aplicar as correções necessárias.</p>
    </div>}
   </>}
   {historico.length>0&&<div className="rounded-lg border bg-white p-3">
    <p className="mb-2 text-xs font-bold text-slate-800">Histórico de validações ({historico.length})</p>
    <div className="space-y-1">{historico.slice(0,10).map(r=><div key={r.id} className="flex flex-wrap justify-between gap-2 border-t py-2 text-xs">
     <span>{r.origem==='pdf_corrigido'?'PDF corrigido':'Dados importados'} · {new Date(r.data).toLocaleString('pt-BR')} · {r.responsavel} {r.vigente?'· Vigente':'· Revisão pendente'}</span>
     {r.temPdf&&<button type="button" onClick={()=>void abrirPdf(r.id)} className="inline-flex items-center gap-1 font-bold text-blue-700"><FileText size={13}/>Abrir PDF arquivado</button>}
    </div>)}</div>
   </div>}
  </div>}
  {mensagem&&<p role="status" className="mt-2 text-xs text-emerald-700">{mensagem}</p>}
  {erro&&<p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
 </section>
}
