'use client'

import {useEffect,useMemo,useState} from 'react'
import {AlertTriangle,CheckCircle2,ImageOff,Loader2,RefreshCw,Pencil,Replace,Trash2,X} from 'lucide-react'
import {tokenAtual,usuarioAtual} from '@/lib/auth'
import VendaMaterialEdicaoRapida,{type AcaoMaterial} from '@/components/clientes/VendaMaterialEdicaoRapida'
import {calcularBarrasConsolidadasObra} from '@/lib/barrasConsolidadasObra'
import {consolidarMateriaisTipologias,type MaterialResumoTipologia} from '@/lib/materiaisTipologiasResumo'

type Material=MaterialResumoTipologia & {wvetro_dados?:Record<string,any>|null}
type Item={id?:string|null;ambiente?:string|null;descricao?:string|null;tipo_esquadria?:string|null;quantidade?:number|null}
type Estado='pendente'|'validada'|'revisar'|'sem_materiais'
type Categoria='todos'|'perfis'|'acessorios'|'vidros'|'outros'
const fmt=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:3})
const categorias:{id:Categoria;nome:string}[]=[
 {id:'todos',nome:'Todos'},{id:'perfis',nome:'Perfis / Contramarcos'},
 {id:'acessorios',nome:'Acessórios'},{id:'vidros',nome:'Vidros'},{id:'outros',nome:'Outros'}
]
const grupo=(cat:string):Categoria=>cat==='perfil'||cat==='contramarco'?'perfis':cat==='acessorio'?'acessorios':cat==='vidro'?'vidros':'outros'
const imagemValida=(v:unknown)=>typeof v==='string'&&/^https?:\/\//i.test(v)?v:null

export default function VendaMateriaisTipologiasResumo({itens,materiais,imagensProdutos,pacoteId,vendaId,onAtualizar,onAbrirTipologias,onPrepararCotacao,onAbrirBarras}:{
 itens:Item[];materiais:Material[];imagensProdutos:Record<string,{foto_url?:string|null}>;
 pacoteId:string|null;vendaId:string;onAtualizar:()=>Promise<void>;
 onAbrirTipologias:()=>void;onPrepararCotacao:()=>void;onAbrirBarras:()=>void
}){
 const [visao,setVisao]=useState<'tipologia'|'total'>('tipologia')
 const [perdaCorteMm,setPerdaCorteMm]=useState(0)
 const [refSelecionada,setRefSelecionada]=useState('')
 const [categoria,setCategoria]=useState<Categoria>('todos')
 const [situacoes,setSituacoes]=useState<Record<string,{situacao:Estado}>>({})
 const [consultando,setConsultando]=useState(false)
 const [atualizando,setAtualizando]=useState(false)
 const [erro,setErro]=useState('')
 const [fotosPorCodigo,setFotosPorCodigo]=useState<Record<string,string>>({})
 const [master,setMaster]=useState(false)
 const [escolha,setEscolha]=useState<{acao:AcaoMaterial;ids:string[]}|null>(null)
 const [edicao,setEdicao]=useState<{acao:AcaoMaterial;id:string}|null>(null)
 const [aviso,setAviso]=useState('')
 useEffect(()=>{let ativo=true;void usuarioAtual().then(u=>{if(ativo)setMaster(u?.role==='master')}).catch(()=>{});
  return()=>{ativo=false}},[])
 const refs=useMemo(()=>itens.filter(i=>i.id).map(i=>String(i.id)),[itens])
 const refAtiva=refs.includes(refSelecionada)?refSelecionada:refs[0]||''
 const totais=useMemo(()=>consolidarMateriaisTipologias(materiais),[materiais])
 const codigosFotos=useMemo(()=>[...new Set(materiais.filter(m=>['perfil','contramarco','acessorio'].includes(m.categoria))
  .map(m=>String(m.codigo||'').trim()).filter(Boolean))].sort(),[materiais])
 useEffect(()=>{
  let ativo=true
  void(async()=>{
   try{
    const token=await tokenAtual()
    if(!token)return
    const todos:Record<string,string>={}
    for(let i=0;i<codigosFotos.length;i+=120){
     const params=new URLSearchParams({modo:'imagens',codigos:codigosFotos.slice(i,i+120).join('|')})
     const r=await fetch('/api/vendas/tipologias-materiais?'+params.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
     if(!r.ok)continue
     const json=await r.json()
     Object.assign(todos,json.imagens||{})
    }
    if(ativo)setFotosPorCodigo(todos)
   }catch{/* imagens da composição ainda aparecem quando o catálogo está indisponível */}
  })()
  return()=>{ativo=false}
 },[codigosFotos])
 const detalhe=useMemo(()=>materiais.filter(m=>m.item_ref===refAtiva),[materiais,refAtiva])
 const linhas=visao==='total'?totais:consolidarMateriaisTipologias(detalhe)
 const linhasExibidas=linhas.filter(m=>(categoria==='todos'||grupo(m.categoria)===categoria)&&!(visao==='total'&&grupo(m.categoria)==='perfis'))
 const imagemPorId=useMemo(()=>{
  const mapa=new Map<string,string>()
  for(const m of materiais){
   const imagem=imagemValida((m.produto_id&&imagensProdutos[m.produto_id]?.foto_url)||
    fotosPorCodigo[String(m.codigo||'').trim().toUpperCase()]||m.wvetro_dados?.imagem_atlas_url||m.wvetro_dados?.imagem_url)
   if(imagem)mapa.set(m.id,imagem)
  }
  return mapa
 },[materiais,imagensProdutos,fotosPorCodigo])
 const fotoDaLinha=(ids:string[])=>ids.map(id=>imagemPorId.get(id)).find(Boolean)||null
 const simulacaoBarras=useMemo(()=>calcularBarrasConsolidadasObra(materiais,{perdaCorteMm}),[materiais,perdaCorteMm])
 const calculados=new Set(simulacaoBarras.idsCalculados)
 // Se faltam dimensões/produtos, o perfil permanece visível como pendência,
 // sem converter indevidamente a quantidade de cortes em barras comerciais.
 const naoCalculados=visao==='total'?consolidarMateriaisTipologias(
  materiais.filter(m=>['perfil','contramarco'].includes(m.categoria)&&!calculados.has(m.id))
 ):[]
 const imagemBarra=(id:string)=>fotoDaLinha(materiais.filter(m=>m.produto_id===id).map(m=>m.id))
 const semImagem=totais.filter(m=>['perfis','acessorios'].includes(grupo(m.categoria))&&!fotoDaLinha(m.materialIds))
 const completas=refs.filter(ref=>situacoes[ref]?.situacao==='validada').length
 const pendentes=refs.length-completas
 const semVinculo=materiais.filter(m=>!m.item_ref||!refs.includes(m.item_ref))
 const apto=Boolean(pacoteId&&refs.length&&materiais.length&&!consultando&&!erro&&!pendentes&&!semImagem.length&&!semVinculo.length)

 useEffect(()=>{
  if(!pacoteId){setSituacoes({});setErro('');return}
  let ativo=true
  void(async()=>{
   setConsultando(true);setErro('')
   try{
    const token=await tokenAtual()
    if(!token)throw Error('Sessão expirada.')
    const p=new URLSearchParams({vendaId,pacoteId,tipo:'resumo'})
    const r=await fetch('/api/vendas/wvetro/conferencia-documental?'+p.toString(),{
     headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const json=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(json.error||'Não foi possível conferir o status das tipologias.')
    if(ativo)setSituacoes(json.situacoes||{})
   }catch(e){if(ativo){setSituacoes({});setErro(e instanceof Error?e.message:'Falha na conferência.')}}
   finally{if(ativo)setConsultando(false)}
  })()
  return()=>{ativo=false}
 },[vendaId,pacoteId,materiais])

 const materialPorId=useMemo(()=>new Map(materiais.map(m=>[m.id,m])),[materiais])
 const nomeTipologia=(ref?:string|null)=>{
  const i=itens.find(it=>String(it.id||'')===String(ref||''))
  return i?.ambiente||i?.descricao||i?.tipo_esquadria||('Tipologia '+(ref||'não identificada'))
 }
 function iniciarAcao(acao:AcaoMaterial,ids:string[]){
  if(!master||!pacoteId)return
  setAviso('');setErro('')
  const registros=ids.filter(id=>materialPorId.has(id))
  if(registros.length===1)setEdicao({acao,id:registros[0]})
  else if(registros.length>1)setEscolha({acao,ids:registros})
 }
 async function aposEdicao(){
  setEdicao(null)
  setAviso('Alteração registrada. A composição e os totais serão atualizados; confira e aprove novamente a tipologia antes de liberar Compras.')
  await atualizar()
 }
 async function atualizar(){
  setAtualizando(true)
  try{await onAtualizar()}catch(e){setErro(e instanceof Error?e.message:'Não foi possível recarregar a composição.')}
  finally{setAtualizando(false)}
 }
 return <section className="space-y-4" aria-label="Materiais vinculados às tipologias">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h3 className="text-base font-bold text-slate-900">Materiais vinculados às tipologias</h3>
    <p className="mt-1 text-xs text-slate-600">Composição atual da obra. Inclusões, substituições e exclusões feitas na tipologia aparecem nesta lista e no total consolidado.</p>
   </div>
   <button type="button" onClick={()=>void atualizar()} disabled={atualizando} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">
    {atualizando?<Loader2 size={14} className="animate-spin"/>:<RefreshCw size={14}/>}Atualizar composição
   </button>
  </div>
  <div className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Tipologias</p><p className="text-xl font-bold">{refs.length}</p></div>
   <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Conferidas / aprovadas</p><p className="text-xl font-bold">{consultando?'…':completas+' / '+refs.length}</p></div>
   <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Materiais técnicos ativos</p><p className="text-xl font-bold">{materiais.length} <span className="text-xs font-normal text-slate-500">registros</span></p></div>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="inline-flex rounded-lg border bg-slate-50 p-1" aria-label="Visão de materiais">
    <button type="button" aria-pressed={visao==='tipologia'} onClick={()=>setVisao('tipologia')} className={'rounded-md px-3 py-2 text-xs font-bold '+(visao==='tipologia'?'bg-blue-700 text-white':'text-slate-600')}>Por tipologia</button>
    <button type="button" aria-pressed={visao==='total'} onClick={()=>setVisao('total')} className={'rounded-md px-3 py-2 text-xs font-bold '+(visao==='total'?'bg-blue-700 text-white':'text-slate-600')}>Total da obra</button>
   </div>
   {visao==='tipologia'&&<label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-700 sm:max-w-[450px]">Tipologia:
    <select className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2" value={refAtiva} onChange={e=>setRefSelecionada(e.target.value)}>
     {itens.filter(i=>i.id).map((it,i)=><option key={it.id} value={String(it.id)}>{i+1}. {it.ambiente||it.descricao||it.tipo_esquadria||'Tipologia'}</option>)}
    </select>
   </label>}
  </div>
  <div className="flex flex-wrap gap-2">
   {categorias.map(c=><button key={c.id} type="button" onClick={()=>setCategoria(c.id)} aria-pressed={categoria===c.id}
    className={'rounded-full border px-3 py-1.5 text-[11px] font-bold '+(categoria===c.id?'border-blue-600 bg-blue-50 text-blue-800':'text-slate-600')}>{c.nome}</button>)}
  </div>
  {visao==='total'&&(categoria==='todos'||categoria==='perfis')&&<div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <b className="text-sm text-blue-900">Barras brutas otimizadas · obra inteira</b>
     <p className="mt-1 text-xs text-slate-700">{simulacaoBarras.totalPecas} peças de corte de todas as tipologias → <b>{simulacaoBarras.totalBarras} barras inteiras estimadas</b>, antes da conferência de estoque.</p>
    </div>
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">Perda por corte (mm)
     <input type="number" min="0" max="50" step="0.5" value={perdaCorteMm}
      onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=50)setPerdaCorteMm(n)}}
      className="w-20 rounded-lg border bg-white px-2 py-1.5 text-right"/>
    </label>
   </div>
   <p className="mt-2 text-[11px] text-slate-600">A perda inicia em 0 mm para não presumir a espessura da serra. Configure a perda real antes da conferência. O aproveitamento é uma estimativa e não movimenta estoque nem altera cortes.</p>
   {simulacaoBarras.pendencias.length>0&&<div role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"><b>{simulacaoBarras.pendencias.length} pendência(s) impedem calcular todas as barras:</b>{simulacaoBarras.pendencias.slice(0,5).map((x,i)=><p key={i}>{x}</p>)}</div>}
  </div>}
  <div className="overflow-x-auto rounded-xl border">
   <table className="w-full min-w-[800px] text-left text-xs">
    <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Imagem</th><th className="p-3">Código / material e ações</th><th className="p-3">Categoria</th><th className="p-3">Cor</th><th className="p-3">Medida / corte</th><th className="p-3 text-right">Quantidade</th><th className="p-3">Unidade</th>{visao==='total'&&<th className="p-3">Tipologias</th>}</tr></thead>
    <tbody>
    {visao==='total'&&(categoria==='todos'||categoria==='perfis')&&simulacaoBarras.barras.map(b=><tr key={'barra:'+b.chave} className="border-t bg-blue-50/30 align-middle">
     <td className="p-2"><div className="grid h-14 w-14 place-items-center rounded-lg border bg-white">
      {fotoDaLinha(b.materialIds)?<img src={fotoDaLinha(b.materialIds)!} alt={'Perfil '+b.codigo} className="h-12 w-12 object-contain"/>:<span className="text-center text-[9px] text-amber-800"><ImageOff className="mx-auto" size={18}/>Imagem pendente</span>}
     </div></td>
     <td className="p-3"><b className="font-mono text-slate-900">{b.codigo}</b><p className="mt-1 text-slate-600">{b.descricao}</p>
      <div className="mt-1 text-[11px] font-bold text-blue-800">Total otimizado da obra · {b.quantidadePecas} peça(s) de corte</div>
      <details className="mt-2 text-[11px] text-slate-600"><summary className="cursor-pointer font-semibold text-blue-700">Ver cortes e tipologias ({b.cortes.length} medida(s))</summary>
       <div className="mt-1 space-y-1">{b.cortes.map(c=><p key={c.comprimentoMm}>{fmt(c.quantidade)} peça(s) × {fmt(c.comprimentoMm)} mm · {c.tipologias.length} tipologia(s)</p>)}</div>
      </details>
      {master&&<div className="mt-2 flex flex-wrap gap-1.5">
       <button type="button" onClick={()=>iniciarAcao('ajustar',b.materialIds)} className="rounded-lg border border-blue-200 bg-white px-2 py-1.5 font-bold text-blue-800"><Pencil size={13} className="mr-1 inline"/>Editar corte de origem</button>
      </div>}
     </td>
     <td className="p-3">Perfil · barra bruta</td><td className="p-3">{b.cor||'—'}</td>
     <td className="p-3">{fmt(b.comprimentoBarraMm)} mm (barra)</td>
     <td className="p-3 text-right text-sm font-bold text-blue-900">{fmt(b.quantidadeBarras)}</td>
     <td className="p-3 font-bold">BR</td><td className="p-3">{b.tipologias.length||'—'}</td>
    </tr>)}
    {visao==='total'&&(categoria==='todos'||categoria==='perfis')&&naoCalculados.map(m=><tr key={'pendente:'+m.chave} className="border-t bg-amber-50 align-middle">
     <td className="p-2">{fotoDaLinha(m.materialIds)?<img src={fotoDaLinha(m.materialIds)!} alt={'Perfil '+(m.codigo||m.descricao)} className="h-12 w-12 object-contain"/>:<ImageOff size={19} className="text-amber-700"/>}</td>
     <td className="p-3"><b className="font-mono">{m.codigo||'Sem código'}</b><p>{m.descricao}</p><b className="text-amber-800">Não calculado · conferir medidas/cadastro</b>
      {master&&<button type="button" onClick={()=>iniciarAcao('ajustar',m.materialIds)} className="ml-2 rounded border px-2 py-1 text-blue-700">Editar registro de origem</button>}
     </td><td className="p-3">Perfil pendente</td><td className="p-3">{m.cor||'—'}</td>
     <td className="p-3">{m.corteMm?fmt(m.corteMm)+' mm (corte)':'Corte pendente'}</td>
     <td className="p-3 text-right font-bold">{fmt(m.quantidade)}</td><td className="p-3">{m.unidade} (peças)</td>
     <td className="p-3">{m.tipologias.length||'—'}</td>
    </tr>)}
    {linhasExibidas.map(m=>{
     const imagem=fotoDaLinha(m.materialIds)
     const imagemObrigatoria=['perfis','acessorios'].includes(grupo(m.categoria))
     return <tr key={m.chave} className="border-t align-middle">
      <td className="p-2"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border bg-white">
       {imagem?<img src={imagem} alt={'Imagem do produto '+(m.codigo||m.descricao)} className="h-full w-full object-contain p-1"/>:
        <span className={'flex flex-col items-center gap-0.5 text-center text-[9px] '+(imagemObrigatoria?'text-amber-800':'text-slate-400')}><ImageOff size={17}/>{imagemObrigatoria?'Imagem pendente':'Sem imagem'}</span>}
      </div></td>
      <td className="p-3"><b className="font-mono text-slate-900">{m.codigo||'Sem código'}</b><p className="mt-1 text-slate-600">{m.descricao}</p>
       {master&&<div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={()=>iniciarAcao('ajustar',m.materialIds)} title="Editar quantidade, acabamento ou medidas deste material"
         aria-label={'Editar '+(m.codigo||m.descricao)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 font-bold text-blue-800 hover:bg-blue-100">
         <Pencil size={13}/>Editar</button>
        <button type="button" onClick={()=>iniciarAcao('substituir',m.materialIds)} title="Substituir por produto do catálogo"
         aria-label={'Substituir '+(m.codigo||m.descricao)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
         <Replace size={13}/>Substituir</button>
        <button type="button" onClick={()=>iniciarAcao('excluir',m.materialIds)} title="Excluir da tipologia com justificativa"
         aria-label={'Excluir '+(m.codigo||m.descricao)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50">
         <Trash2 size={13}/>Excluir</button>
       </div>}
      </td>
      <td className="p-3">{m.categoria==='contramarco'?'Contramarco':m.categoria==='perfil'?'Perfil':m.categoria==='acessorio'?'Acessório':m.categoria==='vidro'?'Vidro':'Outro'}</td>
      <td className="p-3">{m.cor||'—'}</td>
      <td className="p-3">{m.corteMm?fmt(m.corteMm)+' mm (corte)':m.barraMm?fmt(m.barraMm)+' mm (referência)':'—'}</td>
      <td className="p-3 text-right font-bold">{fmt(m.quantidade)}</td><td className="p-3">{visao==='tipologia'&&grupo(m.categoria)==='perfis'&&m.corteMm?'peças de corte':m.unidade}</td>
      {visao==='total'&&<td className="p-3">{m.tipologias.length||'—'}</td>}

     </tr>
    })}
    {!linhasExibidas.length&&!(visao==='total'&&(categoria==='todos'||categoria==='perfis')&&(simulacaoBarras.barras.length||naoCalculados.length))&&<tr><td colSpan={visao==='total'?8:7} className="p-6 text-center text-slate-500">Nenhum material desta categoria na seleção atual.</td></tr>}</tbody>
   </table>
  </div>
  <details className="rounded-xl border bg-white p-4">
   <summary className="cursor-pointer text-sm font-bold text-slate-900">Detalhamento técnico das barras otimizadas (consulta)</summary>
   <p className="mt-2 text-xs text-slate-600">Aproveitamento calculado com os cortes de todas as tipologias, separado por perfil, acabamento e comprimento comercial. Não considera estoque até a conferência e não substitui o relatório WVetro.</p>
   <div className="mt-3 overflow-x-auto rounded-lg border">
    <table className="w-full min-w-[570px] text-left text-xs">
     <thead className="bg-slate-50"><tr><th className="p-2">Imagem</th><th className="p-2">Perfil / código</th><th className="p-2">Cor</th><th className="p-2">Barra comercial</th><th className="p-2 text-right">Peças</th><th className="p-2 text-right">Barras estimadas</th></tr></thead>
     <tbody>{simulacaoBarras.barras.map(b=><tr className="border-t" key={b.chave}>
      <td className="p-2">{fotoDaLinha(b.materialIds)?<img className="h-12 w-12 object-contain" src={fotoDaLinha(b.materialIds)!} alt={'Perfil '+b.codigo}/>:<span className="inline-flex items-center gap-1 text-amber-700"><ImageOff size={15}/>Imagem pendente</span>}</td>
      <td className="p-2 font-bold">{b.codigo}</td><td className="p-2">{b.cor||'—'}</td>
      <td className="p-2">{fmt(b.comprimentoBarraMm)} mm</td>
      <td className="p-2 text-right">{fmt(b.quantidadePecas)}</td><td className="p-2 text-right font-bold">{fmt(b.quantidadeBarras)} BR</td>
     </tr>)}
     {!simulacaoBarras.barras.length&&<tr><td colSpan={6} className="p-3 text-center text-slate-500">Nenhuma barra calculada. Confira cortes e dimensões.</td></tr>}</tbody>
    </table>
   </div>
   {!!simulacaoBarras.pendencias.length&&<div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><b>Pendências de cálculo:</b>{simulacaoBarras.pendencias.slice(0,10).map((p,i)=><p key={i}>{p}</p>)}</div>}
  </details>
  <p className="text-[11px] text-slate-500">Por tipologia: quantidades de peças e medidas de corte. Total da obra: barras comerciais brutas estimadas por otimização global; acessórios e vidros continuam consolidados por suas unidades. <b>A conferência da compra é independente do plano de corte.</b></p>
  {aviso&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{aviso}</p>}
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
  {!consultando&&!!pendentes&&<p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={16} className="shrink-0"/>{pendentes} tipologia(s) sem aprovação técnica válida. Qualquer edição após a aprovação exige nova conferência.</p>}
  {!!semVinculo.length&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{semVinculo.length} material(is) sem vínculo reconhecido com uma tipologia. Confira antes de liberar a composição.</p>}
  {!!semImagem.length&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{semImagem.length} referência(s) de perfis ou acessórios sem imagem disponível. Cadastre o desenho/foto técnica do produto antes da nova validação.</p>}
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3">
   <div className="max-w-xl text-xs text-slate-600">
    <b className="text-slate-900">Conferência para cotação</b>
    <p className="mt-1">{apto?'Composição vinculada, tipologias aprovadas e imagens disponíveis. Faça a conferência de estoque e selecione os itens a cotar.':'Valide a composição de todas as tipologias e resolva pendências para preparar a cotação nesta visão.'}</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={onAbrirTipologias} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-blue-700">Conferir tipologias</button>
    <button type="button" onClick={onAbrirBarras} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-blue-700">Pedido de barras WVetro</button>
    <button type="button" onClick={onPrepararCotacao} disabled={!apto} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
     <CheckCircle2 size={15}/>Preparar cotação
    </button>
   </div>
  </div>
  {escolha&&<div role="dialog" aria-modal="true" aria-label="Escolher tipologia para editar material"
   className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/65 p-3">
   <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4">
     <div><h3 className="text-base font-bold">Escolha o registro da tipologia</h3>
      <p className="mt-1 text-xs text-slate-500">Esta linha reúne mais de um registro. Selecione apenas o material que deseja alterar.</p></div>
     <button type="button" onClick={()=>setEscolha(null)} aria-label="Fechar seleção" className="rounded-lg border p-2"><X size={17}/></button>
    </div>
    <div className="max-h-[55dvh] space-y-2 overflow-y-auto p-4">
     {escolha.ids.map(id=>{
      const material=materialPorId.get(id)
      if(!material)return null
      return <button type="button" key={id} onClick={()=>{setEdicao({acao:escolha.acao,id});setEscolha(null)}}
       className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-blue-300 hover:bg-blue-50">
       {fotoDaLinha([id])?<img src={fotoDaLinha([id])!} alt={'Imagem '+(material.codigo||material.descricao)} className="h-12 w-12 object-contain"/>:
        <ImageOff size={22} className="text-amber-600"/>}
       <span><b className="text-xs">{nomeTipologia(material.item_ref)}</b>
        <span className="block text-xs text-slate-600">{material.codigo||'Sem código'} · {material.descricao}</span>
        <span className="block text-xs text-slate-600">Qtd. {material.quantidade_ajustada??material.quantidade_tecnica??0} {material.unidade}
         {material.comprimento_corte_mm?' · Corte '+fmt(material.comprimento_corte_mm)+' mm':''}</span></span>
      </button>
     })}
    </div>
   </div>
  </div>}
  {edicao&&pacoteId&&materialPorId.has(edicao.id)&&<VendaMaterialEdicaoRapida
   key={edicao.id+'-'+edicao.acao} acao={edicao.acao} material={materialPorId.get(edicao.id)!}
   pacoteId={pacoteId} vendaId={vendaId} nomeTipologia={nomeTipologia(materialPorId.get(edicao.id)?.item_ref)}
   imagemAtual={fotoDaLinha([edicao.id])} onCancelar={()=>setEdicao(null)} onSalvo={aposEdicao}/>}
 </section>
}
