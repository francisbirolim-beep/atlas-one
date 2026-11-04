'use client'
import {useEffect,useState} from 'react'
import {tokenAtual} from '@/lib/auth'

export type ProdutoEscolhido={id:string;codigo:string|null;nome:string;categoria:string|null;unidade:string|null;foto_url:string|null}
export type MaterialDaLista={produto_id:string;categoria:string;descricao:string;quantidade_necessaria:string;unidade:string;foto_url:string|null}
type Linha={
 codigo:string;descricao:string;quantidade:string;unidade:string;produto:ProdutoEscolhido|null;
 confianca:string;marcado:boolean;linha_original:string
}
const categoria=(s:string|null)=>['perfil','acessorio','vidro'].includes(s||'')?s!:
 ['produto','pu','porta_janela_padrao','produto_pronto'].includes(s||'')?'produto_pronto':'outros'
export default function ImportadorListaCompras({onAplicar}:{onAplicar:(itens:MaterialDaLista[])=>void}){
 const [arquivo,setArquivo]=useState<File|null>(null),[processando,setProcessando]=useState(false)
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[linhas,setLinhas]=useState<Linha[]>([])
 const [busca,setBusca]=useState(''),[resultados,setResultados]=useState<ProdutoEscolhido[]>([])
 const [trocando,setTrocando]=useState<number|null>(null)
 const [buscando,setBuscando]=useState(false)
 useEffect(()=>{
  let valido=true
  if(busca.trim().length<2){setResultados([]);return}
  const tempo=setTimeout(async()=>{
   try{
    setBuscando(true)
    const token=await tokenAtual()
    const res=await fetch('/api/compras/produtos?busca='+encodeURIComponent(busca.trim()),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    if(!res.ok)throw Error('Não foi possível consultar o catálogo')
    const json=await res.json()
    if(valido)setResultados(json.produtos||[])
   }catch(e){if(valido)setErro(e instanceof Error?e.message:'Erro de catálogo')}
   finally{if(valido)setBuscando(false)}
  },250)
  return()=>{valido=false;clearTimeout(tempo)}
 },[busca])
 async function analisar(){
  if(!arquivo)return setErro('Selecione o PDF da lista.')
  setErro('');setAviso('');setProcessando(true)
  try{
   const form=new FormData();form.append('tipo','lista');form.append('arquivo',arquivo)
   const token=await tokenAtual()
   const r=await fetch('/api/compras/importar-documento',{method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||'Falha na leitura do PDF')
   setLinhas((j.itens||[]).map((x:any)=>({codigo:x.codigo,descricao:x.produto?.nome||x.descricao,
    quantidade:x.quantidade!=null?String(x.quantidade):'1',unidade:x.produto?.unidade||x.unidade||'UN',
    produto:x.produto||null,confianca:x.confianca,marcado:true,linha_original:x.linha_original})))
   setAviso(j.itens.length+' linhas encontradas em '+j.paginas+' página(s). Confirme cada correspondência antes de adicionar.')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível importar')}
  finally{setProcessando(false)}
 }
 function escolher(p:ProdutoEscolhido){
  if(trocando===null){
   setLinhas(at=>[...at,{codigo:p.codigo||'',descricao:p.nome,quantidade:'1',unidade:p.unidade||'UN',produto:p,
    confianca:'selecionado_manualmente',marcado:true,linha_original:'Incluído manualmente do catálogo'}])
  }else{
   setLinhas(at=>at.map((x,i)=>i===trocando?{...x,codigo:p.codigo||'',descricao:p.nome,unidade:p.unidade||x.unidade,
    produto:p,confianca:'selecionado_manualmente'}:x))
  }
  setTrocando(null);setBusca('');setResultados([]);setErro('')
 }
 function aplicar(){
  const ativas=linhas.filter(x=>x.marcado)
  if(!ativas.length)return setErro('Selecione ao menos um material.')
  if(ativas.length>30)return setErro('O pedido suporta até 30 itens. Selecione parte da lista para este pedido.')
  if(ativas.some(x=>!x.produto))return setErro('Existem códigos sem correspondência segura. Substitua esses itens pelo produto correto do catálogo.')
  if(ativas.some(x=>['perfil','acessorio'].includes(categoria(x.produto?.categoria||null))&&!x.produto?.foto_url))
   return setErro('Há perfil ou acessório sem imagem validada. Corrija a imagem do cadastro antes de incluir.')
  if(ativas.some(x=>!Number.isFinite(Number(x.quantidade))||Number(x.quantidade)<=0))
   return setErro('Corrija as quantidades: todas devem ser maiores que zero.')
  onAplicar(ativas.map(x=>({produto_id:x.produto!.id,categoria:categoria(x.produto!.categoria),
   descricao:x.descricao,quantidade_necessaria:x.quantidade,unidade:x.unidade||'UN',foto_url:x.produto!.foto_url})))
  setLinhas([]);setArquivo(null);setAviso('Materiais adicionados ao pedido. Confira o destino e confirme a solicitação.')
  setErro('')
 }
 const pendentes=linhas.filter(x=>x.marcado&&(!x.produto||(['perfil','acessorio'].includes(categoria(x.produto.categoria))&&!x.produto.foto_url))).length
 return <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-sm space-y-3">
  <div><h3 className="font-bold text-slate-900">Importar lista de perfis e acessórios por PDF</h3>
   <p className="text-xs text-slate-600">Leia o PDF, inclua materiais extras, substitua perfis e edite quantidades. As imagens vêm do catálogo validado do Atlas One.</p></div>
  <div className="flex flex-wrap items-end gap-2">
   <label className="min-w-[210px] flex-1 text-xs font-medium">Lista PDF (até 12 MB)
    <input type="file" accept="application/pdf,.pdf" className="mt-1 block w-full text-xs" onChange={e=>setArquivo(e.target.files?.[0]||null)}/></label>
   <button type="button" onClick={()=>void analisar()} disabled={!arquivo||processando} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{processando?'Lendo PDF...':'Ler PDF e montar lista'}</button>
  </div>
  <div className="rounded-lg border bg-white p-3 space-y-2">
   <label className="block text-xs font-semibold">Incluir outro produto ou substituir um perfil pelo catálogo completo
    <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquise código ou descrição (ex.: SU008)" className="mt-1 w-full rounded-lg border p-2"/></label>
   {trocando!==null&&<div className="flex gap-2 text-xs text-blue-800">Substituindo a linha {trocando+1}. <button type="button" className="underline" onClick={()=>setTrocando(null)}>Cancelar substituição</button></div>}
   {buscando&&<p className="text-xs">Buscando no catálogo...</p>}
   {resultados.length>0&&<div className="max-h-48 overflow-auto divide-y">{resultados.map(p=><button type="button" key={p.id} onClick={()=>escolher(p)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-slate-50">
    {p.foto_url?<img src={p.foto_url} alt={'Imagem '+p.nome} className="h-12 w-12 rounded border object-contain"/>:<span className="flex h-12 w-12 items-center justify-center rounded border border-dashed text-[9px] text-amber-700">Sem imagem</span>}
    <span className="flex-1 text-xs"><b>{p.codigo||'Sem código'}</b> — {p.nome}<small className="block text-slate-500">{p.categoria||'Outros'}</small></span>
    <span className="text-xs text-blue-700">{trocando===null?'Incluir':'Substituir'}</span>
   </button>)}</div>}
  </div>
  {aviso&&<p role="status" className="text-xs text-blue-800">{aviso}</p>}
  {erro&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}
  {linhas.length>0&&<><div className="flex flex-wrap items-center justify-between gap-2 text-xs">
   <span className="font-bold">Prévia editável · {linhas.filter(x=>x.marcado).length} selecionados · {pendentes} precisam de correção</span>
   <div className="flex gap-2"><button type="button" className="underline" onClick={()=>setLinhas(a=>a.map(x=>({...x,marcado:true})))}>Selecionar todos</button>
    <button type="button" className="underline" onClick={()=>setLinhas(a=>a.map(x=>({...x,marcado:false})))}>Desmarcar todos</button></div></div>
   <div className="max-h-[440px] overflow-auto rounded-lg border bg-white"><table className="w-full min-w-[740px] text-xs">
    <thead className="bg-slate-100"><tr><th className="p-2">Usar</th><th className="p-2">Imagem</th><th className="p-2 text-left">Código / material</th><th className="p-2">Qtd.</th><th className="p-2">Unid.</th><th className="p-2">Ação</th></tr></thead>
    <tbody>{linhas.map((x,i)=><tr key={i} className="border-t">
     <td className="p-2 text-center"><input type="checkbox" checked={x.marcado} aria-label={'Selecionar material '+(i+1)} onChange={e=>setLinhas(a=>a.map((v,k)=>k===i?{...v,marcado:e.target.checked}:v))}/></td>
     <td className="p-2">{x.produto?.foto_url?<img src={x.produto.foto_url} alt={x.descricao} className="h-12 w-12 rounded border object-contain"/>:<span className="text-[10px] text-amber-700">Imagem pendente</span>}</td>
     <td className="p-2"><b>{x.codigo}</b><input className="mt-1 block w-full min-w-[260px] rounded border p-1.5" value={x.descricao} onChange={e=>setLinhas(a=>a.map((v,k)=>k===i?{...v,descricao:e.target.value}:v))}/>
      <span className={x.produto?'text-emerald-700':'text-amber-700'}>{x.produto?'Catálogo: '+x.produto.nome:'Código não identificado · confirmar produto'}</span></td>
     <td className="p-2"><input aria-label={'Quantidade '+(i+1)} type="number" min="0.001" step="any" value={x.quantidade} onChange={e=>setLinhas(a=>a.map((v,k)=>k===i?{...v,quantidade:e.target.value}:v))} className="w-20 rounded border p-1.5"/></td>
     <td className="p-2"><input aria-label={'Unidade '+(i+1)} value={x.unidade} onChange={e=>setLinhas(a=>a.map((v,k)=>k===i?{...v,unidade:e.target.value}:v))} className="w-16 rounded border p-1.5"/></td>
     <td className="space-y-1 p-2"><button type="button" className="block text-blue-700 underline" onClick={()=>{setTrocando(i);setBusca(x.codigo||'')}}>Substituir</button>
      <button type="button" className="text-red-700 underline" onClick={()=>setLinhas(a=>a.filter((_,k)=>k!==i))}>Excluir</button></td>
    </tr>)}</tbody></table></div>
   <button type="button" onClick={aplicar} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white">Adicionar selecionados ao pedido</button>
  </>}
 </div>
}
