'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, FileDown, ImageOff, Layers3, LockKeyhole, PackageCheck, Printer, ShieldAlert } from 'lucide-react'
import { refItemProducaoInstalacao } from '@/lib/vendaInstalacaoProducao'
import VendaListaCorteWVetro from '@/components/clientes/VendaListaCorteWVetro'
import { supabase } from '@/lib/supabase'

type Ordem = {
  id:string; item_ref?:string|null; titulo?:string|null; status?:string|null
  bloqueada?:boolean|null; bloqueio_motivo?:string|null; quantidade?:number|null
  quantidade_produzida?:number|null; item_snapshot?:Record<string,unknown>|null; created_at?:string|null
}
type Material = {
  id:string; item_ref?:string|null; categoria:string; codigo?:string|null
  descricao:string; produto_id?:string|null; unidade?:string|null
  quantidade_ajustada?:number|null; quantidade_tecnica?:number|null
  comprimento_corte_mm?:number|null; comprimento_barra_mm?:number|null; cor_ref?:string|null
  wvetro_dados?:Record<string,unknown>|null
}
type Produto={codigo?:string|null;foto_url?:string|null}
const ETAPAS=[
  {id:'aguardando',nome:'Aguardando liberação'},
  {id:'liberada',nome:'Liberado para produção'},
  {id:'corte',nome:'Corte'},
  {id:'montagem',nome:'Montagem'},
  {id:'conferencia',nome:'Conferência de qualidade'},
  {id:'pendente',nome:'Produção pendente'},
  {id:'concluida',nome:'Produção concluída'},
] as const
type Etapa=typeof ETAPAS[number]['id']
type Categoria='perfil'|'acessorio'|'vidro'|'outros'
const finalizada=(o:Ordem)=>o.status==='concluida'
const habilitada=(o:Ordem)=>!o.bloqueada&&['liberada','em_producao','conferencia','concluida'].includes(String(o.status||''))
const valor=(n:unknown)=>Number.isFinite(Number(n))?Number(n):0
const numero=(n:unknown)=>valor(n).toLocaleString('pt-BR',{maximumFractionDigits:2})
const texto=(v:unknown)=>typeof v==='string'?v.trim():''
function etapaDaOrdem(ordens:Ordem[]):Etapa{
  if(!ordens.length)return 'aguardando'
  if(ordens.every(finalizada))return 'concluida'
  if(ordens.some(o=>o.bloqueada&&o.status!=='aguardando'))return 'pendente'
  if(ordens.some(o=>o.status==='conferencia'))return 'conferencia'
  if(ordens.some(o=>o.status==='em_producao'))return 'corte'
  if(ordens.some(o=>o.status==='liberada'))return 'liberada'
  return 'aguardando'
}
function categoriaMaterial(m:Material):Categoria{
  if(m.categoria==='perfil'||m.categoria==='contramarco')return 'perfil'
  if(m.categoria==='acessorio')return 'acessorio'
  if(m.categoria==='vidro')return 'vidro'
  return 'outros'
}
function imagemMaterial(m:Material,produtos:Record<string,Produto>){
  const porId=m.produto_id?produtos[m.produto_id]?.foto_url:null
  const porCodigo=Object.values(produtos).find(p=>texto(p.codigo).toUpperCase()===texto(m.codigo).toUpperCase())?.foto_url
  const w=m.wvetro_dados||{}
  const wvetro=[w.imagem_atlas_url,w.imagemAtlasUrl,w.imagem_url,w.image_url,w.foto_url,w.fotoUrl].find(x=>typeof x==='string'&&x.trim())
  return texto(porId)||texto(porCodigo)||texto(wvetro)||''
}
function imagemTipologia(i:Record<string,unknown>){
  // O desenho deve vir do item vendido, de seu snapshot ou do cadastro técnico, nunca ser inventado.
  const origem=i.dados_origem&&typeof i.dados_origem==='object'?i.dados_origem as Record<string,unknown>:{}
  const tipologia=i.tipologia&&typeof i.tipologia==='object'?i.tipologia as Record<string,unknown>:{}
  return [i.foto_url,i.imagem_url,i.croqui_url,i.desenho_url,i.thumbnail_url,
    i.imagem_catalogo_url,i.imagem_tipologia_url,i.wvetro_imagem_url,
    tipologia.foto_url,tipologia.imagem_url,tipologia.desenho_url,
    origem.imagem_url,origem.foto_url,origem.desenho_url].map(texto).find(Boolean)||''
}
function duracao(ms:number){
  const minutos=Math.max(0,Math.floor(ms/60000))
  if(minutos<60)return minutos+' min'
  const horas=Math.floor(minutos/60)
  return horas<24?horas+' h '+(minutos%60)+' min':Math.floor(horas/24)+' d '+(horas%24)+' h'
}
export default function VendaProducaoKanbanPreview({ordens,itens,materiais,produtosMateriais,pacoteId,orcamentoId,onEditarCortes}:{
  ordens:Ordem[];itens:any[];materiais:Material[];produtosMateriais:Record<string,Produto>;
  pacoteId?:string|null;orcamentoId:string;onEditarCortes:()=>void
}){
  const [etapasSim,setEtapasSim]=useState<Record<string,Etapa>>({})
  const [qtdSim,setQtdSim]=useState<Record<string,number>>({})
  const [entradaSim,setEntradaSim]=useState<Record<string,number>>({})
  const [aberto,setAberto]=useState<string|null>(null)
  const [selecionados,setSelecionados]=useState<string[]>([])
  const [aviso,setAviso]=useState('')
  const [perguntarImpressao,setPerguntarImpressao]=useState<string|null>(null)
  const [referenciasImpressao,setReferenciasImpressao]=useState<string[]>([])
  const [imprimindo,setImprimindo]=useState(false)
  const [fotoCadastrada,setFotoCadastrada]=useState<Record<string,string>>({})
  const [carregandoDesenhos,setCarregandoDesenhos]=useState(false)
  const [agora,setAgora]=useState(()=>Date.now())
  const idsTipologias=Array.from(new Set([
    ...(Array.isArray(itens)?itens:[]).map(i=>texto(i?.tipologia_id)),
    ...(ordens||[]).map(o=>texto(o.item_snapshot?.tipologia_id)),
  ].filter(id=>/^[0-9a-f-]{36}$/i.test(id)))).sort().join(',')
  useEffect(()=>{
    let ativo=true
    if(!idsTipologias){setFotoCadastrada({});setCarregandoDesenhos(false);return}
    setCarregandoDesenhos(true)
    void supabase.from('tipologias').select('id,foto_url').in('id',idsTipologias.split(',')).then(({data,error})=>{
      if(!ativo)return
      if(error){setAviso('Não foi possível consultar os desenhos das tipologias. Confira o cadastro técnico antes de imprimir.')}
      const fotos:Record<string,string>={}
      for(const t of data||[])if(texto(t.foto_url))fotos[t.id]=texto(t.foto_url)
      setFotoCadastrada(fotos)
      setCarregandoDesenhos(false)
    })
    return()=>{ativo=false}
  },[idsTipologias])
  useEffect(()=>{const timer=window.setInterval(()=>setAgora(Date.now()),60000);return()=>window.clearInterval(timer)},[])
  const cards=useMemo(()=>{
    const mapa=new Map<string,{ref:string;item:Record<string,unknown>;ordens:Ordem[];indice:number}>()
    ;(Array.isArray(itens)?itens:[]).forEach((item,indice)=>{
      const ref=refItemProducaoInstalacao(item,indice)
      mapa.set(ref,{ref,item,ordens:[],indice})
    })
    ;(ordens||[]).filter(o=>o.status!=='cancelada'&&o.item_ref).forEach(o=>{
      const ref=String(o.item_ref)
      if(!mapa.has(ref))mapa.set(ref,{ref,item:o.item_snapshot||{},ordens:[],indice:mapa.size})
      mapa.get(ref)!.ordens.push(o)
    })
    return [...mapa.values()].map(c=>{
      const i=c.item, ordem=c.ordens[0]
      const qtdPrevista=Math.max(1,Math.round(valor(i.quantidade)||c.ordens.reduce((n,o)=>n+valor(o.quantidade),0)||1))
      const produzidasReais=c.ordens.reduce((n,o)=>n+Math.max(0,Math.min(valor(o.quantidade),o.quantidade_produzida==null?(finalizada(o)?valor(o.quantidade):0):valor(o.quantidade_produzida))),0)
      const produzidas=Math.min(qtdPrevista,Math.max(0,qtdSim[c.ref]??produzidasReais))
      const etapa=etapasSim[c.ref]||etapaDaOrdem(c.ordens)
      const pronta=c.ordens.length>0&&c.ordens.every(habilitada)
      return {...c,
        nome:texto(i.tipo_outro_texto)||texto(i.descricao)||texto(i.tipo_esquadria)||texto(i.tipologia_nome)||texto(i.configuracao_nome)||texto(ordem?.titulo)||'Tipologia '+(c.indice+1),
        ambiente:texto(i.ambiente)||texto(i.local)||'Ambiente não informado',
        largura:valor(i.largura_mm||ordem?.item_snapshot?.largura_mm),
        altura:valor(i.altura_mm||ordem?.item_snapshot?.altura_mm),
        foto:fotoCadastrada[texto(i.tipologia_id)||texto(ordem?.item_snapshot?.tipologia_id)]||imagemTipologia(i)||imagemTipologia(ordem?.item_snapshot||{}),
        qtd:qtdPrevista,produzidas,etapa,pronta,progresso:Math.round((produzidas/qtdPrevista)*100),
        bloqueio:c.ordens.map(o=>texto(o.bloqueio_motivo)).filter(Boolean).join(' · '),
      }
    })
  },[itens,ordens,etapasSim,qtdSim,fotoCadastrada])
  const materialDoCard=(ref:string)=>materiais.filter(m=>String(m.item_ref||'')===ref)
  function mover(ref:string,destino:Etapa){
    const card=cards.find(c=>c.ref===ref)
    if(!card)return
    if(destino!=='aguardando'&&!card.pronta){setAviso('A tipologia ainda não possui liberação técnica confirmada. Esta prévia não ignora a Medição Final nem os bloqueios.');return}
    if(destino==='concluida'&&(card.produzidas<card.qtd||card.etapa!=='conferencia')){
      setAviso('Para concluir, todas as unidades devem estar conferidas e o card deve passar pela Conferência de qualidade.');return
    }
    setEtapasSim(prev=>({...prev,[ref]:destino}))
    setEntradaSim(prev=>({...prev,[ref]:Date.now()}))
    setAviso(destino==='concluida'?'Simulação: tipologia concluída. O envio automático para “A instalar” será habilitado somente após validação do fluxo real, sem duplicar cards.':'Movimento demonstrativo: nenhuma ordem real foi modificada.')
    if(destino==='liberada')setPerguntarImpressao(ref)
  }
  async function prepararImpressao(refs:string[]){
    if(!refs.length){setAviso('Selecione ao menos uma tipologia para imprimir.');return}
    if(carregandoDesenhos){setAviso('Aguarde o carregamento dos desenhos das tipologias antes de gerar o plano de corte.');return}
    const selecionadas=cards.filter(c=>refs.includes(c.ref))
    const semDesenho=selecionadas.filter(c=>!c.foto)
    if(semDesenho.length){
      setAviso('Plano de corte não gerado: é obrigatório ter o desenho original da tipologia. Cadastre ou vincule o desenho em: '+semDesenho.map(c=>c.nome).join(', ')+'.')
      return
    }
    setAviso('Carregando os desenhos originais para o PDF...')
    const resultados=await Promise.all(selecionadas.map(c=>new Promise<boolean>(resolve=>{
      const imagem=new window.Image()
      const timer=window.setTimeout(()=>resolve(false),8000)
      imagem.onload=()=>{window.clearTimeout(timer);resolve(true)}
      imagem.onerror=()=>{window.clearTimeout(timer);resolve(false)}
      imagem.src=c.foto
    })))
    if(resultados.some(x=>!x)){setAviso('A impressão foi interrompida: não foi possível carregar todos os desenhos originais. Verifique os arquivos das tipologias.');return}
    setReferenciasImpressao(refs)
    setPerguntarImpressao(null)
    setAviso('')
    setImprimindo(true)
  }
  useEffect(()=>{
    if(!imprimindo)return
    const cb=()=>{document.body.classList.remove('atlas-print-producao');setImprimindo(false)}
    document.body.classList.add('atlas-print-producao')
    window.addEventListener('afterprint',cb)
    const t=window.setTimeout(()=>window.print(),150)
    return()=>{window.clearTimeout(t);window.removeEventListener('afterprint',cb);document.body.classList.remove('atlas-print-producao')}
  },[imprimindo])
  const selecionadosValidos=selecionados.filter(ref=>cards.some(c=>c.ref===ref))
  const cardsImpressao=cards.filter(c=>referenciasImpressao.includes(c.ref))
  const imprimirMaterial=materiais.filter(m=>referenciasImpressao.includes(String(m.item_ref||''))||(referenciasImpressao.length===cards.length&&!m.item_ref))
  const abertoCard=cards.find(c=>c.ref===aberto)
  const cores=['border-slate-200 bg-slate-50','border-sky-200 bg-sky-50','border-blue-200 bg-blue-50','border-violet-200 bg-violet-50','border-amber-200 bg-amber-50','border-orange-200 bg-orange-50','border-emerald-200 bg-emerald-50']

  return <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold text-slate-900"><Layers3 size={19} className="text-blue-700"/>Kanban de tipologias · prévia para aprovação</h3>
        <p className="mt-1 text-xs text-slate-600">Uma tipologia por card. Movimentos e quantidades nesta prévia são simulações locais: não alteram ordens, materiais ou Instalação.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>setSelecionados(selecionadosValidos.length===cards.length?[]:cards.map(c=>c.ref))}>{selecionadosValidos.length===cards.length?'Desmarcar todas':'Selecionar todas'}</button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white" onClick={()=>prepararImpressao(selecionadosValidos)}><FileDown size={14}/>Imprimir selecionadas ({selecionadosValidos.length})</button>
      </div>
    </div>
    {aviso&&<p role="status" className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">{aviso}</p>}
    <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
      {ETAPAS.map((etapa,idx)=>{
        const lista=cards.filter(c=>c.etapa===etapa.id)
        return <div key={etapa.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const ref=e.dataTransfer.getData('text/plain');mover(ref,etapa.id)}} className={'w-[235px] min-w-[235px] rounded-xl border p-2 '+cores[idx]}>
          <div className="mb-2 flex items-center justify-between px-1"><b className="text-xs text-slate-800">{etapa.nome}</b><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">{lista.length}</span></div>
          <div className="space-y-2 min-h-20">{lista.map(c=>{
            const dur=entradaSim[c.ref]?agora-entradaSim[c.ref]:null
            const atraso=dur!=null&&dur>24*3600000?'text-red-700':dur!=null&&dur>8*3600000?'text-amber-700':'text-slate-500'
            return <div key={c.ref} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',c.ref)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2"><input type="checkbox" aria-label={'Selecionar '+c.nome} checked={selecionadosValidos.includes(c.ref)} onChange={e=>setSelecionados(prev=>e.target.checked?[...new Set([...prev,c.ref])]:prev.filter(r=>r!==c.ref))}/>
                {c.foto?<img src={c.foto} alt={'Desenho da '+c.nome} className="h-14 w-14 shrink-0 rounded border object-contain"/>:<div role="status" className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded border border-amber-300 bg-amber-50 text-center text-[9px] font-semibold text-amber-800"><ImageOff size={16}/>Desenho pendente</div>}
                <div className="min-w-0 flex-1"><b className="block text-xs text-slate-900">{c.nome}</b><p className="text-[11px] text-slate-500">{c.ambiente}</p><p className="text-[11px] text-slate-500">{c.largura&&c.altura?c.largura+' × '+c.altura+' mm · ':''}{c.qtd} un.</p></div>
              </div>
              <p className={'mt-2 flex items-center gap-1 text-[11px] font-semibold '+(c.pronta?'text-emerald-700':'text-amber-700')}>{c.pronta?<CheckCircle2 size={13}/>:<LockKeyhole size={13}/>} {c.pronta?'Liberada tecnicamente':'Aguardando liberação técnica'}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{width:c.progresso+'%'}}/></div>
              <div className="mt-1 flex justify-between text-[11px]"><span>{c.produzidas}/{c.qtd} produzidas</span><b>{c.progresso}%</b></div>
              <p className={'mt-1 flex items-center gap-1 text-[10px] '+atraso}><Clock3 size={11}/>{dur==null?'Tempo na etapa: a registrar':'Nesta etapa: '+duracao(dur)}</p>
              {c.bloqueio&&<p className="mt-1 text-[10px] text-amber-700">{c.bloqueio}</p>}
              <button type="button" className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold" onClick={()=>setAberto(aberto===c.ref?null:c.ref)}>{aberto===c.ref?<ChevronUp size={13}/>:<ChevronDown size={13}/>} {aberto===c.ref?'Fechar tipologia':'Abrir tipologia'}</button>
            </div>
          })}</div>
        </div>
      })}
    </div>
    {!cards.length&&<p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Nenhuma tipologia foi localizada na venda. Não serão criados cards fictícios.</p>}
    {abertoCard&&<div className="mt-4 rounded-xl border border-blue-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold">{abertoCard.nome} · {abertoCard.ambiente}</h4><p className="text-xs text-slate-500">Materiais exclusivos desta tipologia, conforme pacote técnico do WVetro.</p></div>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>prepararImpressao([abertoCard.ref])}><Printer size={13}/>Imprimir esta tipologia</button></div>
      <div className="my-3 flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-3">
        {abertoCard.foto?<img src={abertoCard.foto} alt={'Desenho técnico de '+abertoCard.nome} className="h-28 w-36 rounded-lg border bg-white object-contain p-1"/>:<div role="status" className="flex h-28 w-36 flex-col items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 text-center text-xs font-semibold text-amber-800"><ImageOff size={24}/>Desenho da tipologia pendente de cadastro</div>}
        <div className="text-xs text-slate-700"><b className="block text-sm">{abertoCard.nome}</b>
          <p>Ambiente: {abertoCard.ambiente}</p>
          <p>Medidas: {abertoCard.largura&&abertoCard.altura?`${abertoCard.largura} × ${abertoCard.altura} mm`:'Não informadas'}</p>
          <p>Quantidade: {abertoCard.qtd} · Produzidas: {abertoCard.produzidas}</p>
        </div>
      </div>
      <VendaListaCorteWVetro
        materiais={materialDoCard(abertoCard.ref)}
        obraId={null} pacoteId={pacoteId} orcamentoId={orcamentoId} onEditar={onEditarCortes}
        imagensPorProduto={Object.fromEntries(Object.entries(produtosMateriais).filter(([,p])=>Boolean(p.foto_url)).map(([id,p])=>[id,String(p.foto_url)]))}
        imagensPorCodigo={Object.fromEntries(Object.values(produtosMateriais).filter(p=>Boolean(p.codigo&&p.foto_url)).map(p=>[String(p.codigo).trim().toUpperCase(),String(p.foto_url)]))}/>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs">
        <label>Produzidas nesta simulação: <input aria-label="Quantidade produzida na prévia" type="number" min={0} max={abertoCard.qtd} className="ml-1 w-16 rounded border px-2 py-1" value={abertoCard.produzidas} onChange={e=>setQtdSim(prev=>({...prev,[abertoCard.ref]:Math.max(0,Math.min(abertoCard.qtd,Math.floor(valor(e.target.value))))}))}/></label>
        <label>Testar etapa: <select aria-label="Etapa simulada" className="rounded border px-2 py-1" value={abertoCard.etapa} onChange={e=>mover(abertoCard.ref,e.target.value as Etapa)}>{ETAPAS.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <span className="text-slate-500">Esses testes não são gravados.</span>
      </div>
    </div>}
    {perguntarImpressao&&<div role="dialog" aria-label="Imprimir lista de corte" className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-4"><p className="text-sm font-bold">Deseja imprimir agora a lista completa desta tipologia?</p><p className="mt-1 text-xs text-slate-600">Você também poderá imprimir individualmente ou em lote depois.</p><div className="mt-3 flex gap-2"><button type="button" onClick={()=>prepararImpressao([perguntarImpressao])} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Imprimir / Salvar PDF</button><button type="button" onClick={()=>setPerguntarImpressao(null)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Depois</button></div></div>}
    <div className="atlas-producao-print hidden">
      <h1>Atlas One · Plano de corte / ficha completa de produção</h1>
      <p>Tipologias selecionadas: {cardsImpressao.length} · Impressão técnica por peça, não lista de compra de barras.</p>
      {cardsImpressao.map(c=><section key={c.ref} className="print-bloco"><h2>{c.nome} · {c.ambiente}</h2>{c.foto?<img src={c.foto} alt={'Desenho '+c.nome} style={{width:92,height:72,objectFit:'contain'}}/>:<p>Desenho da tipologia pendente de cadastro</p>}<p>{c.largura&&c.altura?c.largura+' × '+c.altura+' mm · ':''}Quantidade: {c.qtd} · {c.ref}</p></section>)}
      <table className="print-tabela"><thead><tr><th>Desenho</th><th>Tipologia</th><th>Grupo</th><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Corte</th><th>Cor</th><th>Barra de origem</th></tr></thead><tbody>{imprimirMaterial.map(m=>{
        const img=imagemMaterial(m,produtosMateriais)
        const tip=cards.find(c=>c.ref===String(m.item_ref||''))
        return <tr key={m.id}><td>{img?<img src={img} alt={'Desenho '+(m.codigo||m.descricao)}/>:<span>Imagem pendente</span>}</td><td>{tip?.nome||'Geral da obra'}</td><td>{categoriaMaterial(m)}</td><td>{m.codigo||'—'}</td><td>{m.descricao}</td><td>{numero(m.quantidade_ajustada??m.quantidade_tecnica)} {m.unidade}</td><td>{m.comprimento_corte_mm?numero(m.comprimento_corte_mm)+' mm':'—'}</td><td>{m.cor_ref||'—'}</td><td>{m.comprimento_barra_mm?numero(m.comprimento_barra_mm)+' mm':'—'}</td></tr>
      })}</tbody></table>
      <p>Documento gerado para conferência. Imagens não cadastradas permanecem indicadas como pendentes.</p>
    </div>
    <style jsx global>{`
      @media print {
        body.atlas-print-producao * {visibility:hidden!important}
        body.atlas-print-producao .atlas-producao-print,body.atlas-print-producao .atlas-producao-print *{visibility:visible!important}
        body.atlas-print-producao .atlas-producao-print{display:block!important;position:absolute;left:0;top:0;width:100%;background:white;padding:8mm;color:#111;font-family:Arial,sans-serif;font-size:10pt}
        body.atlas-print-producao .atlas-producao-print h1{font-size:17pt;margin:0 0 8px}
        body.atlas-print-producao .atlas-producao-print h2{font-size:12pt;margin:8px 0 2px}
        body.atlas-print-producao .atlas-producao-print .print-bloco{border-bottom:1px solid #ddd;padding:3px 0;break-inside:avoid}
        body.atlas-print-producao .atlas-producao-print .print-tabela{margin-top:10px;width:100%;border-collapse:collapse;font-size:8pt}
        body.atlas-print-producao .atlas-producao-print th,body.atlas-print-producao .atlas-producao-print td{padding:4px;border:1px solid #888;text-align:left}
        body.atlas-print-producao .atlas-producao-print th{background:#eee}
        body.atlas-print-producao .atlas-producao-print td img{height:38px;width:38px;object-fit:contain}
        body.atlas-print-producao .atlas-producao-print tr{break-inside:avoid}
        @page{size:A4 landscape;margin:8mm}
      }
    `}</style>
  </section>
}
