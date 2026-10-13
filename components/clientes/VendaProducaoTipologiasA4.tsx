'use client'

import {useMemo,useState} from 'react'
import {ChevronDown,ChevronRight,FileDown,ImageOff,Printer} from 'lucide-react'
import {refItemProducaoInstalacao} from '@/lib/vendaInstalacaoProducao'
import type {CorteWVetro} from '@/components/clientes/VendaListaCorteWVetro'

type Ordem={id:string;item_ref?:string|null;quantidade?:number|null;status?:string|null;bloqueada?:boolean|null;bloqueio_motivo?:string|null;tipo_producao?:string|null}
type Grupo='perfil'|'acessorio'|'vidro'|'outros'
const grupos:{id:Grupo;label:string}[]=[{id:'perfil',label:'Perfis / corte'},{id:'acessorio',label:'Acessórios'},{id:'vidro',label:'Vidros'},{id:'outros',label:'Outros'}]
const escap=(texto:unknown)=>String(texto??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const numeral=(v:unknown)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const qtd=(m:CorteWVetro)=>Number(m.quantidade_ajustada??m.quantidade_tecnica??0)
const grupoDe=(m:CorteWVetro):Grupo=>['perfil','contramarco'].includes(m.categoria)?'perfil':m.categoria==='acessorio'?'acessorio':m.categoria==='vidro'?'vidro':'outros'
const itemRef=(item:any,i:number)=>refItemProducaoInstalacao(item,i)
const descricao=(item:any)=>String(item?.descricao||item?.tipo_esquadria||item?.tipologia_nome||item?.configuracao_nome||item?.wvetro_item?.Modelo||'Esquadria sob medida')
const ambiente=(item:any,i:number)=>String(item?.ambiente||item?.local||item?.descricao_curta||`Tipologia ${i+1}`)
function imagem(m:CorteWVetro,porProduto:Record<string,string>,porCodigo:Record<string,string>){
 const dados=m.wvetro_dados||{}
 const tecnica=[dados.imagem_atlas_url,dados.imagemAtlasUrl,dados.imagem_url,dados.image_url,dados.foto_url,dados.fotoUrl]
 const encontrada=tecnica.find(x=>typeof x==='string'&&x.trim())
 return (m.produto_id&&porProduto[m.produto_id])||porCodigo[String(m.codigo||'').trim().toUpperCase()]||(typeof encontrada==='string'?encontrada:'')
}
function statusProducao(ordens:Ordem[]){
 const relevantes=ordens.filter(o=>o.tipo_producao==='esquadria'&&o.status!=='cancelada')
 if(!relevantes.length)return 'Aguardando ordem'
 if(relevantes.every(o=>['concluida','concluido','produzido','pronto'].includes(String(o.status||''))))return 'Produzido'
 if(relevantes.some(o=>o.status==='em_producao'||o.status==='conferencia'))return 'Em produção'
 if(relevantes.some(o=>o.bloqueada&&o.bloqueio_motivo))return 'Aguardando / bloqueado'
 if(relevantes.some(o=>o.status==='liberada'))return 'Liberado'
 return 'Aguardando liberação'
}
export default function VendaProducaoTipologiasA4({itens,materiais,ordens,cliente,numeroOrcamento,imagensPorProduto={},imagensPorCodigo={}}:{
 itens:any[];materiais:CorteWVetro[];ordens:Ordem[];cliente:string;numeroOrcamento:string;
 imagensPorProduto?:Record<string,string>;imagensPorCodigo?:Record<string,string>
}){
 const [aberto,setAberto]=useState<string|null>(null)
 const [categoria,setCategoria]=useState<Grupo>('perfil')
 const [selecionados,setSelecionados]=useState<string[]>([])
 const [aviso,setAviso]=useState('')
 const cards=useMemo(()=>itens.map((item,i)=>{
  const ref=itemRef(item,i)
  const daTipologia=materiais.filter(m=>m.item_ref===ref)
  const ops=ordens.filter(o=>o.item_ref===ref)
  return {ref,item,i,material:daTipologia,ordens:ops,status:statusProducao(ops)}
 }),[itens,materiais,ordens])
 const semVinculo=materiais.filter(m=>!cards.some(c=>c.ref===m.item_ref))
 function imprimir(refs:string[]){
  setAviso('')
  const fichas=cards.filter(c=>refs.includes(c.ref))
  if(!fichas.length){setAviso('Selecione pelo menos uma tipologia para imprimir.');return}
  const popup=window.open('','_blank')
  if(!popup){setAviso('Seu navegador bloqueou a impressão. Autorize a abertura de janelas para o Atlas e tente novamente.');return}
  const folhas=fichas.map(c=>{
   const item=c.item
   const medidas=item?.largura_mm&&item?.altura_mm?`${numeral(item.largura_mm)} × ${numeral(item.altura_mm)} mm`:'Medidas não informadas'
   const secoes=grupos.map(g=>{
    const linhas=c.material.filter(m=>grupoDe(m)===g.id)
    if(!linhas.length)return `<div class="secao"><h3>${escap(g.label)}</h3><p class="vazio">Sem itens vinculados nesta categoria.</p></div>`
    const cells=linhas.map(m=>{
     const foto=imagem(m,imagensPorProduto,imagensPorCodigo)
     const obrigatoria=g.id==='perfil'||g.id==='acessorio'
     const desenho=foto?`<img src="${escap(foto)}" alt="${escap(m.codigo||m.descricao)}"/>`:(obrigatoria?'<span class="pendente">Imagem pendente</span>':'—')
     const corte=m.comprimento_corte_mm!=null&&Number(m.comprimento_corte_mm)>0?`${numeral(m.comprimento_corte_mm)} mm`:'—'
     const extra=g.id==='perfil'?corte:(m.unidade||'UN')
     return `<tr><td class="imagem">${desenho}</td><td>${escap(m.codigo||'—')}</td><td>${escap(m.descricao)}</td><td class="num">${escap(numeral(qtd(m)))}</td><td>${escap(extra)}</td><td>${escap(m.cor_ref||'—')}</td></tr>`
    }).join('')
    return `<div class="secao"><h3>${escap(g.label)} (${linhas.length})</h3><table><thead><tr><th>Desenho</th><th>Código</th><th>Descrição</th><th>Qtd.</th><th>${g.id==='perfil'?'Corte':'Unid.'}</th><th>Cor</th></tr></thead><tbody>${cells}</tbody></table></div>`
   }).join('')
   return `<article class="folha"><div class="conteudo"><header><div><strong>ESQUADRIFÁCIO · ATLAS ONE</strong><small>Plano de corte simplificado · Produção</small></div><div class="numero">Orçamento ${escap(numeroOrcamento)}</div></header><div class="cliente">Cliente: <b>${escap(cliente)}</b></div><div class="cabecalho"><b>${escap(String(c.i+1).padStart(2,'0'))} · ${escap(ambiente(item,c.i))}</b><div>${escap(descricao(item))}</div><small>Quantidade: ${escap(numeral(item?.quantidade||1))} peça(s) · ${escap(medidas)}</small></div>${secoes}<footer>Ficha técnica por tipologia · Confirmar medidas e materiais antes do corte · ${escap(new Date().toLocaleDateString('pt-BR'))}</footer></div></article>`
  }).join('')
  const documento=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Plano de corte - ${escap(cliente)} - ${escap(numeroOrcamento)}</title><style>
@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;background:white;font-size:10px}.folha{width:194mm;height:281mm;overflow:hidden;break-after:page;page-break-after:always;position:relative}.folha:last-child{break-after:auto;page-break-after:auto}.conteudo{transform-origin:top left}header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:8px}header strong{display:block;font-size:15px}header small{display:block;color:#526072;padding-top:3px}.numero{font-weight:bold;font-size:11px}.cliente{padding:8px 0}.cabecalho{border:1px solid #ccd5e0;background:#f1f5fa;border-radius:6px;padding:8px}.cabecalho b{font-size:13px}.cabecalho div{margin-top:3px}.cabecalho small{display:block;margin-top:3px;color:#566273}.secao{margin-top:8px;break-inside:avoid}.secao h3{margin:0 0 4px;font-size:10px;background:#e7edf6;border-left:3px solid #2354ae;padding:4px 6px}.secao table{border-collapse:collapse;width:100%;table-layout:fixed}.secao th,.secao td{border-bottom:1px solid #e2e8f0;padding:3px 4px;text-align:left;overflow-wrap:anywhere}.secao th{background:#f8fafc;font-size:9px}.secao th:nth-child(1){width:45px}.secao th:nth-child(2){width:58px}.secao th:nth-child(4){width:34px}.secao th:nth-child(5){width:62px}.secao th:nth-child(6){width:64px}.imagem img{width:32px;height:26px;object-fit:contain}.pendente{font-size:8px;color:#9a6700}.num{text-align:center}.vazio{color:#64748b;margin:4px 6px;font-size:9px}footer{border-top:1px solid #d6dde7;margin-top:10px;padding-top:6px;font-size:8px;color:#667085}.aviso{display:none}
@media screen{body{background:#dce3ed;padding:20px}.folha{background:white;margin:0 auto 20px;padding:0;box-shadow:0 5px 22px #9aa6b6}}@media print{body{background:white!important;padding:0}.folha{margin:0;box-shadow:none}}
</style></head><body>${folhas}<script>(async()=>{await Promise.all(Array.from(document.images).map(im=>im.complete?Promise.resolve():new Promise(done=>{im.onload=done;im.onerror=done;setTimeout(done,2200)})));for(const folha of document.querySelectorAll('.folha')){const interno=folha.querySelector('.conteudo');if(interno.scrollHeight>folha.clientHeight){const escala=Math.max(0.53,Math.min(1,(folha.clientHeight-6)/interno.scrollHeight));interno.style.transform='scale('+escala+')';interno.style.width=(100/escala)+'%';}}window.focus();setTimeout(()=>window.print(),250)})()<\/script></body></html>`
  popup.document.open();popup.document.write(documento);popup.document.close()
 }
 return <section className="mb-5 rounded-xl border border-slate-200 bg-white">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
   <div><h3 className="font-bold text-slate-900">Tipologias do orçamento fechado · Produção</h3><p className="mt-1 text-xs text-slate-500">Abra uma tipologia para conferir perfis, acessórios, vidro e outros. Imprima uma ficha ou selecione várias; cada tipologia sai em uma página A4.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setSelecionados(cards.map(c=>c.ref))} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar todas</button><button type="button" onClick={()=>setSelecionados([])} className="rounded-lg border px-3 py-2 text-xs font-semibold">Limpar</button><button type="button" onClick={()=>imprimir(cards.map(c=>c.ref))} disabled={!cards.length} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700"><FileDown size={14}/>Imprimir todas A4</button><button type="button" onClick={()=>imprimir(selecionados)} disabled={!selecionados.length} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Printer size={14}/>Imprimir selecionadas ({selecionados.length})</button></div>
  </div>
  {aviso&&<p role="alert" className="m-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{aviso}</p>}
  {semVinculo.length>0&&<p className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{semVinculo.length} material(is) sem vínculo confirmado com a tipologia do orçamento. Permanecem na lista original do WVetro, sem distribuição automática entre as peças.</p>}
  <div className="divide-y">{cards.map(c=>{
   const aberta=aberto===c.ref
   const linhas=c.material.filter(m=>grupoDe(m)===categoria)
   const mede=c.item?.largura_mm&&c.item?.altura_mm?`${numeral(c.item.largura_mm)} × ${numeral(c.item.altura_mm)} mm`:'Medidas pendentes'
   return <div key={c.ref}>
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50">
     <input type="checkbox" aria-label={`Selecionar ${ambiente(c.item,c.i)} para imprimir`} checked={selecionados.includes(c.ref)} onChange={e=>setSelecionados(prev=>e.target.checked?[...prev,c.ref]:prev.filter(x=>x!==c.ref))} className="h-4 w-4 shrink-0"/>
     <button type="button" aria-expanded={aberta} onClick={()=>{setAberto(aberta?null:c.ref);setCategoria('perfil')}} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 text-left">
      <span className="flex min-w-0 items-center gap-2">{aberta?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span><b className="block text-sm text-slate-900">{String(c.i+1).padStart(2,'0')} · {ambiente(c.item,c.i)}</b><span className="block text-xs text-slate-500">{descricao(c.item)} · {mede} · Qtd. {numeral(c.item?.quantidade||1)}</span></span></span>
      <span className="flex items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{c.status}</span><span className="text-slate-500">{c.material.length} materiais</span></span>
     </button><button type="button" onClick={()=>imprimir([c.ref])} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold text-blue-700"><Printer size={13}/>A4</button>
    </div>
    {aberta&&<div className="border-t bg-slate-50 px-4 pb-4 pt-3"><div className="flex flex-wrap gap-2">{grupos.map(g=><button key={g.id} type="button" onClick={()=>setCategoria(g.id)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(categoria===g.id?'bg-blue-700 text-white':'border bg-white text-slate-700')}>{g.label} ({c.material.filter(m=>grupoDe(m)===g.id).length})</button>)}</div>
     <div className="mt-3 overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-100"><tr><th className="p-2">Imagem</th><th>Código</th><th>Descrição</th><th>Qtd. de cortes</th><th>Medida de corte</th><th>Cor</th></tr></thead><tbody>{linhas.map(m=>{
      const foto=imagem(m,imagensPorProduto,imagensPorCodigo)
      return <tr key={m.id} className="border-t"><td className="p-2">{foto?<img src={foto} alt={m.descricao} className="h-12 w-14 object-contain"/>:<span className="flex items-center gap-1 text-[10px] text-amber-700"><ImageOff size={13}/>{['perfil','acessorio'].includes(categoria)?'Imagem pendente':'—'}</span>}</td><td className="font-mono font-bold">{m.codigo||'—'}</td><td>{m.descricao}</td><td>{numeral(qtd(m))} {m.unidade||'UN'}</td><td>{m.comprimento_corte_mm?`${numeral(m.comprimento_corte_mm)} mm`:'—'}</td><td>{m.cor_ref||'—'}</td></tr>
     })}{!linhas.length&&<tr><td colSpan={6} className="p-5 text-center text-slate-500">Nenhum material vinculado desta categoria.</td></tr>}</tbody></table></div>
     <p className="mt-2 text-[11px] text-slate-500">Impressão apenas para a tipologia selecionada. Materiais e quantidades são os do pacote técnico atual; nenhuma ordem é liberada pela impressão.</p>
    </div>}
   </div>
  })}{!cards.length&&<p className="p-6 text-center text-sm text-slate-500">O orçamento vendido ainda não possui tipologias estruturadas.</p>}</div>
 </section>
}