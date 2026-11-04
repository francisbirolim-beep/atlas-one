'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, FileText, History, ImageOff, Layers3, Loader2, Pencil, Plus, Printer, RefreshCw, Replace, Search, SearchCheck, Trash2, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import VendaConferenciaDocumentalWVetro from '@/components/clientes/VendaConferenciaDocumentalWVetro'

type Material={
 id:string;item_ref?:string|null;produto_id?:string|null;categoria:string;codigo?:string|null;
 descricao:string;unidade:string;cor_ref?:string|null;quantidade_ajustada?:number|null;
 comprimento_corte_mm?:number|null;comprimento_barra_mm?:number|null;status_compra?:string|null;
 incluido_manual?:boolean|null;justificativa_ajuste?:string|null;wvetro_dados?:Record<string,any>|null
}
type Produto={id:string;codigo?:string|null;nome:string;categoria?:string|null;unidade?:string|null;foto_url?:string|null;tamanho_barra_mm?:number|null}
type Registro={id:string;acao:string;created_at:string;usuario_nome:string|null;justificativa:string;antes:any;depois:any}
type Acao='incluir'|'substituir'|'excluir'|'ajustar'
type Grupo='perfis'|'acessorios'|'vidros'|'servicos'|'variaveis'|'formulas'
type Formulario={produto_id:string;codigo:string;descricao:string;categoria:string;quantidade_ajustada:string;unidade:string;cor_ref:string;comprimento_corte_mm:string;comprimento_barra_mm:string;justificativa:string}
const grupos:{id:Grupo;nome:string}[]=[
 {id:'perfis',nome:'Perfis'},{id:'acessorios',nome:'Acessórios'},{id:'vidros',nome:'Vidros'},
 {id:'servicos',nome:'Serviços / Outros'},{id:'variaveis',nome:'Variáveis'},
 {id:'formulas',nome:'Fórmulas Padrão'}
]
const padrao:Formulario={produto_id:'',codigo:'',descricao:'',categoria:'perfil',quantidade_ajustada:'1',unidade:'UN',cor_ref:'',comprimento_corte_mm:'',comprimento_barra_mm:'',justificativa:''}
const nomeAcao:Record<Acao,string>={incluir:'Incluir material',substituir:'Substituir material',excluir:'Excluir material',ajustar:'Alterar quantidade / corte'}
const categoriaDoGrupo=(g:Grupo,cat:string)=>g==='perfis'?['perfil','contramarco'].includes(cat):g==='acessorios'?cat==='acessorio':g==='vidros'?cat==='vidro':g==='servicos'?!['perfil','contramarco','acessorio','vidro'].includes(cat):false
const n=(x:unknown)=>Number(x||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
const url=(s:string)=>s.startsWith('http://')||s.startsWith('https://')?s:null
export default function VendaTipologiasMateriais({itens,materiais,pacoteId,vendaId,obraId,imagensProdutos,onAtualizar}:{
 itens:any[];materiais:Material[];pacoteId:string|null;vendaId:string;obraId?:string|null;
 imagensProdutos:Record<string,{foto_url?:string|null}>;onAtualizar:()=>Promise<void>
}){
 const [aberta,setAberta]=useState<string|null>(null)
 const [filtro,setFiltro]=useState('')
 const [abrirDocumento,setAbrirDocumento]=useState<string|null>(null)
 const [situacoes,setSituacoes]=useState<Record<string,{situacao:string;data?:string;responsavel?:string|null}>>({})
 const [carregandoSituacoes,setCarregandoSituacoes]=useState(false)
 const [erroSituacoes,setErroSituacoes]=useState('')
 const [recargaResumo,setRecargaResumo]=useState(0)
 const [selecionadasImpressao,setSelecionadasImpressao]=useState<string[]>([])
 const [grupo,setGrupo]=useState<Grupo>('perfis')
 const [imagens,setImagens]=useState<Record<string,string>>({})
 const [historico,setHistorico]=useState<Registro[]>([])
 const [mostrarHistorico,setMostrarHistorico]=useState(false)
 const [master,setMaster]=useState(false)
 const [carregando,setCarregando]=useState(false)
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [mensagem,setMensagem]=useState('')
 const [acao,setAcao]=useState<Acao|null>(null)
 const [materialEditando,setMaterialEditando]=useState<Material|null>(null)
 const [form,setForm]=useState<Formulario>(padrao)
 const [busca,setBusca]=useState('')
 const [resultados,setResultados]=useState<Produto[]>([])
 const [pesquisando,setPesquisando]=useState(false)
 const itensComRef=useMemo(()=>itens.map((item,i)=>({...item,ref:String(item.id||''),indice:i})),[itens])
 const dadosAtuais=itensComRef.find(i=>i.ref&&i.ref===aberta)
 const itensFiltrados=useMemo(()=>itensComRef.filter(it=>{
  const q=filtro.trim().toLocaleLowerCase('pt-BR')
  return !q||[it.ambiente,it.descricao,it.tipo_esquadria,it.configuracao_nome,it.wvetro_item?.Modelo].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))
 }),[itensComRef,filtro])
 const quantidadeCategoria=(cats:string[])=>materiais.filter(m=>cats.includes(m.categoria)).length
 const totalValidadas=itensComRef.filter(it=>situacoes[it.ref]?.situacao==='validada').length
 const linkFicha=(refs:string[])=>pacoteId?'/'+(obraId?'obras/'+obraId:'vendas/'+vendaId)+'/tipologias/fichas?pacote='+encodeURIComponent(pacoteId)+'&refs='+encodeURIComponent(refs.join('|')):null
 useEffect(()=>{
  if(!pacoteId){setSituacoes({});setCarregandoSituacoes(false);setErroSituacoes('');return}
  let ativo=true
  void(async()=>{
   setCarregandoSituacoes(true);setErroSituacoes('')
   try{
    const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
    const params=new URLSearchParams({vendaId,pacoteId,tipo:'resumo'})
    const r=await fetch('/api/vendas/wvetro/conferencia-documental?'+params.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(j.error||'Falha ao consultar validações.')
    if(ativo)setSituacoes(j.situacoes||{})
   }catch(e){if(ativo)setErroSituacoes(e instanceof Error?e.message:'Validações indisponíveis.')}
   finally{if(ativo)setCarregandoSituacoes(false)}
  })()
  return()=>{ativo=false}
 },[pacoteId,vendaId,recargaResumo,materiais])
 const materiaisAtuais=useMemo(()=>materiais.filter(m=>m.item_ref&&m.item_ref===aberta),[materiais,aberta])
 const visiveis=materiaisAtuais.filter(m=>categoriaDoGrupo(grupo,m.categoria))
 useEffect(()=>{void usuarioAtual().then(u=>setMaster(u?.role==='master'))},[])
 useEffect(()=>{
  if(!aberta||!pacoteId)return
  let vivo=true
  setHistorico([]);setErro('');setMostrarHistorico(false)
  void(async()=>{
   setCarregando(true)
   try{
    const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
    const codigos=[...new Set(materiais.filter(m=>m.item_ref===aberta).map(m=>m.codigo||'').filter(Boolean))].slice(0,130)
    const headers={Authorization:'Bearer '+token}
    const chamadas=[fetch('/api/vendas/tipologias-materiais?vendaId='+encodeURIComponent(vendaId)+'&pacoteId='+encodeURIComponent(pacoteId)+'&itemRef='+encodeURIComponent(aberta),{headers,cache:'no-store'})]
    if(codigos.length)chamadas.push(fetch('/api/vendas/tipologias-materiais?modo=imagens&codigos='+encodeURIComponent(codigos.join('|')),{headers,cache:'no-store'}))
    const respostas=await Promise.all(chamadas)
    const dados=await Promise.all(respostas.map(r=>r.json()))
    if(!respostas[0].ok)throw Error(dados[0].error||'Histórico indisponível.')
    if(vivo){setHistorico(dados[0].historico||[]);setImagens({...imagens,...(dados[1]?.imagens||{})})}
   }catch(e){if(vivo)setErro(e instanceof Error?e.message:'Não foi possível carregar os detalhes.')}
   finally{if(vivo)setCarregando(false)}
  })()
  return()=>{vivo=false}
 },[aberta,pacoteId,vendaId,materiais.length])
 async function pesquisar(){
  if(busca.trim().length<2)return
  setPesquisando(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const r=await fetch('/api/vendas/tipologias-materiais?modo=catalogo&busca='+encodeURIComponent(busca.trim()),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json()
   if(!r.ok)throw Error(json.error||'Falha ao buscar produtos.')
   setResultados(json.produtos||[])
  }catch(e){setErro(e instanceof Error?e.message:'Falha no catálogo.')}
  finally{setPesquisando(false)}
 }
 function abrirEdicao(tipo:Acao,material:Material|null=null){
  setErro('');setBusca('');setResultados([])
  setMaterialEditando(material);setAcao(tipo)
  setForm({...padrao,produto_id:tipo==='substituir'?'':material?.produto_id||'',codigo:tipo==='substituir'?'':material?.codigo||'',descricao:tipo==='substituir'?'':material?.descricao||'',
   categoria:material?.categoria|| (grupo==='perfis'?'perfil':grupo==='acessorios'?'acessorio':grupo==='vidros'?'vidro':'outro'),
   quantidade_ajustada:String(material?.quantidade_ajustada||1),unidade:material?.unidade||'UN',
   cor_ref:material?.cor_ref||'',comprimento_corte_mm:material?.comprimento_corte_mm!=null?String(material.comprimento_corte_mm):'',
   comprimento_barra_mm:material?.comprimento_barra_mm!=null?String(material.comprimento_barra_mm):'',justificativa:''})
 }
 function escolherProduto(p:Produto){
  if(['perfil','contramarco'].includes(form.categoria)&&!p.foto_url){setErro('Perfil sem desenho técnico: cadastre a imagem antes de incluí-lo.');return}
  setForm(prev=>({...prev,produto_id:p.id,codigo:p.codigo||'',descricao:p.nome,unidade:p.unidade||prev.unidade,
    comprimento_barra_mm:p.tamanho_barra_mm?String(p.tamanho_barra_mm):prev.comprimento_barra_mm}))
  setBusca(p.codigo||p.nome);setResultados([]);setErro('')
 }
 async function salvar(){
  if(!acao||!aberta||!pacoteId||salvando)return
  if(form.justificativa.trim().length<5){setErro('Informe uma justificativa de pelo menos cinco caracteres.');return}
  if(acao!=='excluir'&&(!form.descricao.trim()||Number(form.quantidade_ajustada)<=0)){
   setErro('Informe a descrição e uma quantidade positiva.');return
  }
  if((acao==='substituir'||acao==='incluir')&&form.codigo&&!form.produto_id){
   setErro('Escolha o produto pelo catálogo. Não é permitido vincular um código sem seu cadastro.');return
  }
  const aviso='Confirmar '+nomeAcao[acao].toLowerCase()+' nesta tipologia? O orçamento vendido e o CMV original não serão recalculados. Listas de cotação e pedidos existentes deverão ser conferidos novamente.'
  if(!window.confirm(aviso))return
  setSalvando(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const novo={...form,produto_id:form.produto_id||null,
    quantidade_ajustada:Number(form.quantidade_ajustada),
    comprimento_corte_mm:form.comprimento_corte_mm.trim()?Number(form.comprimento_corte_mm):null,
    comprimento_barra_mm:form.comprimento_barra_mm.trim()?Number(form.comprimento_barra_mm):null}
   const r=await fetch('/api/vendas/tipologias-materiais',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,pacoteId,itemRef:aberta,acao,materialId:materialEditando?.id,novo,justificativa:form.justificativa})})
   const json=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(json.error||'Falha ao alterar material.')
   setMensagem('Alteração salva com histórico. Confira Compras, lista de corte e PDFs antes de utilizar materiais.')
   setAcao(null);setMaterialEditando(null)
   await onAtualizar()
   setRecargaResumo(v=>v+1)
   const tokenAtualizado=await tokenAtual()
   if(tokenAtualizado){
    const h=await fetch('/api/vendas/tipologias-materiais?vendaId='+encodeURIComponent(vendaId)+'&pacoteId='+encodeURIComponent(pacoteId)+'&itemRef='+encodeURIComponent(aberta),{
      headers:{Authorization:'Bearer '+tokenAtualizado},cache:'no-store'})
    if(h.ok){const lista=await h.json();setHistorico(lista.historico||[])}
   }
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setSalvando(false)}
 }
 const atualGrupo=grupo==='variaveis'?dadosAtuais?.variaveis||dadosAtuais?.wvetro_item?.Variaveis||{}:
  grupo==='formulas'?dadosAtuais?.wvetro_item?.Formulas||dadosAtuais?.wvetro_item?.Formula||{}:null
 return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <header className="space-y-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-white px-4 py-5 sm:px-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700"><ClipboardCheck size={13}/> Etapa 1 · Conferência técnica</span>
     <h2 className="mt-3 text-xl font-bold text-slate-900">Conferência de tipologias W.Vetro</h2>
     <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">Confira cada esquadria, imprima a ficha de materiais e cortes, compare com o PDF original ou anexe a versão correta. Somente aprovações humanas ficam registradas como referência para a IA.</p>
    </div>
    {linkFicha(selecionadasImpressao)&&<a target="_blank" rel="noopener noreferrer" href={linkFicha(selecionadasImpressao)!}
     className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"><Printer size={15}/> Imprimir {selecionadasImpressao.length?`${selecionadasImpressao.length} selecionada(s)`:'todas as fichas'}</a>}
   </div>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="block text-[11px] font-semibold text-slate-500">Tipologias na obra</span><b className="mt-1 block text-xl text-slate-900">{itensComRef.length}</b></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="block text-[11px] font-semibold text-slate-500">Perfis e contramarcos</span><b className="mt-1 block text-xl text-slate-900">{quantidadeCategoria(['perfil','contramarco'])}</b></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="block text-[11px] font-semibold text-slate-500">Acessórios</span><b className="mt-1 block text-xl text-slate-900">{quantidadeCategoria(['acessorio'])}</b></div>
    <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="block text-[11px] font-semibold text-slate-500">Conferência documental</span><b className="mt-1 block text-lg text-slate-900">{carregandoSituacoes?'Consultando…':erroSituacoes?'Indisponível':`${totalValidadas} de ${itensComRef.length}`}</b></div>
   </div>
   <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600" aria-label="Etapas técnicas da obra">
    <span className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-white">1. Conferir tipologias</span><ChevronRight size={13}/>
    <span className="rounded-lg border bg-white px-2.5 py-1.5">2. Preparar materiais</span><ChevronRight size={13}/>
    <span className="rounded-lg border bg-white px-2.5 py-1.5">3. Cotar e comprar</span><ChevronRight size={13}/>
    <span className="rounded-lg border bg-white px-2.5 py-1.5">4. Medida Final / produção</span>
   </div>
   {erroSituacoes&&<p role="status" className="text-xs text-amber-800">Não foi possível atualizar o estado das aprovações: {erroSituacoes}. As fichas continuam disponíveis.</p>}
   {!pacoteId&&<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Pacote técnico não sincronizado. Importe a composição para habilitar conferências e impressão.</p>}
   {pacoteId&&!obraId&&<p className="text-xs text-slate-600">A venda ainda não possui obra vinculada. As fichas podem ser impressas pela venda; o vínculo da obra permanece necessário para as operações que o exigem.</p>}
  </header>
  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4">
   <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-slate-500"><Search size={15}/>
    <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar ambiente ou tipologia" aria-label="Buscar ambiente ou tipologia"
     className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"/></label>
   <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" aria-label="Selecionar todas as tipologias para impressão"
    checked={itensComRef.length>0&&itensComRef.every(it=>it.ref&&selecionadasImpressao.includes(it.ref))}
    onChange={e=>setSelecionadasImpressao(e.target.checked?itensComRef.map(it=>it.ref).filter(Boolean):[])}/> Selecionar todas</label>
   <span className="text-xs text-slate-500">{itensFiltrados.length} exibida(s)</span>
  </div>
  <div className="space-y-3 bg-slate-50/70 p-3 sm:p-5">
   {itensFiltrados.map((it,i)=>{
    const ref=it.ref
    const estaAberta=aberta===ref&&!!ref
    const linhas=materiais.filter(m=>m.item_ref===ref)
    const status=carregandoSituacoes?'consultando':erroSituacoes?'indisponivel':situacoes[ref]?.situacao||'pendente'
    const rotuloStatus=status==='validada'?'Conferida e validada':status==='revisar'?'Revisão necessária':status==='sem_materiais'?'Sem composição':status==='consultando'?'Consultando aprovação':status==='indisponivel'?'Status indisponível':'Pendente de conferência'
    const corStatus=status==='validada'?'border-emerald-200 bg-emerald-50 text-emerald-700':status==='revisar'||status==='sem_materiais'?'border-amber-200 bg-amber-50 text-amber-800':'border-slate-200 bg-slate-50 text-slate-600'
    return <div key={ref||i} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
     <div className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="flex min-w-[220px] flex-1 items-start gap-3">
       <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" aria-label={`Selecionar ${it.ambiente||it.descricao||'tipologia'} para impressão`}
        checked={selecionadasImpressao.includes(ref)} onChange={()=>setSelecionadasImpressao(prev=>prev.includes(ref)?prev.filter(x=>x!==ref):[...prev,ref])}/>
       <button type="button" className="min-w-0 text-left" aria-expanded={estaAberta} onClick={()=>{setAberta(estaAberta?null:ref||null);setAbrirDocumento(null);setGrupo('perfis');setMensagem('');setAcao(null)}}>
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">{estaAberta?<ChevronDown size={17} className="shrink-0 text-blue-700"/>:<ChevronRight size={17} className="shrink-0 text-slate-500"/>}
         {String(it.indice+1).padStart(2,'0')} · {it.ambiente||it.descricao||it.configuracao_nome||'Tipologia'}</span>
        <span className="mt-1 block pl-6 text-xs text-slate-600">{it.descricao||it.tipo_esquadria||it.wvetro_item?.Modelo||'Esquadria sob medida'}</span>
        <span className="mt-2 flex flex-wrap gap-2 pl-6 text-[11px] text-slate-500"><span>Qtd. <b>{n(it.quantidade||1)}</b></span><span>·</span>
         <span>{it.largura_mm&&it.altura_mm?it.largura_mm+' × '+it.altura_mm+' mm':'Medida não informada'}</span><span>·</span><span>{linhas.length} materiais</span></span>
       </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
       <span className={'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold '+corStatus}>
        {status==='validada'?<CheckCircle2 size={13}/>:<ClipboardCheck size={13}/>} {rotuloStatus}</span>
       <button type="button" onClick={()=>{setAberta(ref);setAbrirDocumento(ref);setAcao(null)}} disabled={!ref||!pacoteId}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"><SearchCheck size={14}/> Conferir / PDF</button>
       <button type="button" onClick={()=>{setAberta(ref);setAbrirDocumento(null);setGrupo('perfis');setAcao(null)}} disabled={!ref}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Layers3 size={14}/> Ver materiais</button>
       {linkFicha([ref])&&<a href={linkFicha([ref])!} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><FileText size={14}/> Imprimir ficha</a>}
      </div>
     </div>
     {estaAberta&&<div className="space-y-3 border-t bg-slate-50 p-3 md:p-4">
      <p className="text-xs text-slate-600">Revise a composição abaixo. A aprovação do PDF fica registrada, mas não altera os materiais automaticamente nem libera a produção.</p>
      <VendaConferenciaDocumentalWVetro vendaId={vendaId} pacoteId={pacoteId} tipo="tipologia" itemRef={ref} compacto iniciarAberto={abrirDocumento===ref} onValidacaoRegistrada={()=>setRecargaResumo(v=>v+1)}/>
      {!pacoteId&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Sincronize o pacote técnico antes de editar os materiais.</p>}
      {!ref&&<p className="text-xs text-amber-800">Esta tipologia não possui identificador técnico; edição bloqueada para não misturar materiais.</p>}
      <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Componentes da tipologia">
       {grupos.map(g=><button key={g.id} type="button" onClick={()=>{setGrupo(g.id);setAcao(null)}} className={'rounded-lg px-3 py-2 text-xs font-bold '+(grupo===g.id?'bg-blue-700 text-white':'bg-white text-slate-600 hover:bg-blue-50')}>{g.nome}</button>)}
      </nav>
      {grupo==='variaveis'||grupo==='formulas'?<div className="rounded-lg border bg-white p-4">
       <b className="text-sm">{grupo==='variaveis'?'Variáveis da peça':'Fórmulas Padrão · referência técnica'}</b>
       {Object.keys(atualGrupo||{}).length?<pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(atualGrupo,null,2)}</pre>:<p className="mt-2 text-xs text-slate-500">Nenhuma informação estruturada desta seção foi importada do WVetro para a tipologia.</p>}
       <p className="mt-2 text-xs text-amber-700">As receitas e fórmulas globais continuam na Engenharia. Editar materiais desta obra não altera fórmulas de outras obras.</p>
      </div>:<>
       <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{visiveis.length} registro(s) · {grupo==='perfis'?'Perfil e contramarco':grupo==='servicos'?'Serviços e outros materiais':grupos.find(g=>g.id===grupo)?.nome}</span>
        {master&&pacoteId&&ref&&<button type="button" onClick={()=>abrirEdicao('incluir')} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"><Plus size={15}/> Incluir material</button>}
       </div>
       <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[750px] text-xs">
         <thead className="bg-slate-100 text-left uppercase text-slate-500"><tr><th className="p-2">Desenho</th><th className="p-2">Código / descrição</th><th className="p-2">Cor</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Corte</th><th className="p-2">Origem</th><th className="p-2 text-right">Ações</th></tr></thead>
         <tbody>{visiveis.map(m=>{
          const foto=(m.produto_id&&imagensProdutos[m.produto_id]?.foto_url)||imagens[(m.codigo||'').toUpperCase()]||null
          return <tr key={m.id} className="border-t align-middle">
           <td className="p-2">{foto&&url(foto)?<img src={foto} alt={'Desenho '+(m.codigo||m.descricao)} className="h-12 w-16 rounded border object-contain"/>:<span className="flex items-center gap-1 text-[10px] text-amber-700"><ImageOff size={13}/>{m.codigo?'Pendente':'—'}</span>}</td>
           <td className="max-w-[350px] p-2"><b className="font-mono">{m.codigo||'—'}</b><p className="mt-1 text-slate-600">{m.descricao}</p></td>
           <td className="p-2">{m.cor_ref||'—'}</td><td className="p-2 text-right">{n(m.quantidade_ajustada)} {m.unidade}</td>
           <td className="p-2 text-right">{m.comprimento_corte_mm!=null?n(m.comprimento_corte_mm)+' mm':'—'}</td>
           <td className="p-2 text-slate-500">{m.incluido_manual?'Ajuste Atlas':'WVetro / técnico'}</td>
           <td className="p-2"><div className="flex justify-end gap-1">{master&&<>
            <button title="Ajustar quantidade ou corte" aria-label="Ajustar material" onClick={()=>abrirEdicao('ajustar',m)} className="rounded border p-2 hover:bg-slate-50"><Pencil size={14}/></button>
            <button title="Substituir material" aria-label="Substituir material" onClick={()=>abrirEdicao('substituir',m)} className="rounded border p-2 hover:bg-slate-50"><Replace size={14}/></button>
            <button title="Excluir material" aria-label="Excluir material" onClick={()=>abrirEdicao('excluir',m)} className="rounded border p-2 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
           </>}</div></td>
          </tr>
         })}{!visiveis.length&&<tr><td colSpan={7} className="p-5 text-center text-slate-500">Esta tipologia não tem materiais cadastrados nesta categoria.</td></tr>}</tbody>
        </table>
       </div>
      </>}
      {master&&<div className="space-y-2">
       <button onClick={()=>setMostrarHistorico(x=>!x)} className="flex items-center gap-2 text-xs font-bold text-blue-700"><History size={15}/> {mostrarHistorico?'Ocultar':'Ver'} histórico de alterações ({historico.length})</button>
       {carregando&&<p className="text-xs text-slate-500">Conferindo histórico...</p>}
       {mostrarHistorico&&<div className="space-y-2 rounded-lg border bg-white p-3">{historico.map(h=><div key={h.id} className="border-b pb-2 text-xs">
        <b>{h.acao.toUpperCase()} · {h.usuario_nome||'Usuário'}</b><span className="ml-2 text-slate-500">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
        <p className="mt-1">{h.antes?.codigo||'—'} → {h.depois?.codigo||'Excluído'} · {h.justificativa}</p></div>)}{!historico.length&&<p className="text-xs text-slate-500">Nenhuma edição manual registrada nesta tipologia.</p>}</div>}
      </div>}
      {mensagem&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{mensagem}</p>}
      {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
     </div>}
    </div>
   })}
   {!itens.length&&<p className="rounded-xl bg-white p-5 text-sm text-slate-500">Este orçamento não possui tipologias estruturadas.</p>}
   {itens.length>0&&!itensFiltrados.length&&<p className="rounded-xl bg-white p-5 text-sm text-slate-500">Nenhuma tipologia corresponde à busca.</p>}
  </div>
  {acao&&aberta&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true">
   <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4"><h3 className="text-base font-bold">{nomeAcao[acao]} · {dadosAtuais?.ambiente||'Tipologia'}</h3><button aria-label="Fechar edição" disabled={salvando} onClick={()=>setAcao(null)}><X size={18}/></button></div>
    <div className="space-y-3 overflow-y-auto p-4 text-xs">
     {materialEditando&&<p className="rounded-lg bg-slate-50 p-3">Material original: <b>{materialEditando.codigo||'—'}</b> · {materialEditando.descricao}</p>}
     {acao!=='excluir'&&<>
      {acao!=='ajustar'&&<div><label className="block font-bold">Buscar no catálogo (código ou descrição)</label><div className="mt-1 flex gap-2">
       <input className="min-w-0 flex-1 rounded-lg border p-2" value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void pesquisar()}}} placeholder="Ex.: SU010, 30-023..."/>
       <button type="button" disabled={pesquisando||busca.length<2} onClick={()=>void pesquisar()} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">{pesquisando?<Loader2 size={14} className="animate-spin"/>:<Search size={14}/>} Buscar</button></div>
       {resultados.length>0&&<div className="mt-2 max-h-44 overflow-auto rounded-lg border">{resultados.map(p=><button type="button" key={p.id} onClick={()=>escolherProduto(p)} className="flex w-full items-center gap-2 border-b p-2 text-left hover:bg-blue-50">
        {p.foto_url?<img src={p.foto_url} alt={'Desenho '+p.codigo} className="h-10 w-10 object-contain"/>:<ImageOff size={20} className="text-amber-600"/>}
        <span><b>{p.codigo||'Sem código'}</b> · {p.nome}{p.codigo&&!p.foto_url?<span className="block text-amber-700">Imagem técnica pendente</span>:null}</span>
       </button>)}</div>}
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
       <label className="font-semibold">Categoria<select disabled={acao==='ajustar'} value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} className="mt-1 w-full rounded-lg border p-2"><option value="perfil">Perfil</option><option value="contramarco">Contramarco</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="outro">Serviço / Outro</option></select></label>
       <label className="font-semibold">Código<input readOnly value={form.codigo} className="mt-1 w-full rounded-lg border bg-slate-50 p-2" placeholder="Escolha no catálogo"/></label>
       <label className="sm:col-span-2 font-semibold">Descrição<input value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} className="mt-1 w-full rounded-lg border p-2" maxLength={500}/></label>
       <label className="font-semibold">Quantidade<input inputMode="decimal" value={form.quantidade_ajustada} onChange={e=>setForm({...form,quantidade_ajustada:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Unidade<input value={form.unidade} onChange={e=>setForm({...form,unidade:e.target.value})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Cor<input value={form.cor_ref} onChange={e=>setForm({...form,cor_ref:e.target.value})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Comprimento de corte (mm)<input inputMode="decimal" value={form.comprimento_corte_mm} onChange={e=>setForm({...form,comprimento_corte_mm:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
       <label className="font-semibold">Comprimento da barra (mm)<input inputMode="decimal" value={form.comprimento_barra_mm} onChange={e=>setForm({...form,comprimento_barra_mm:e.target.value.replace(',','.')})} className="mt-1 w-full rounded-lg border p-2"/></label>
      </div>
     </>}
     <label className="block font-semibold">Justificativa obrigatória<textarea value={form.justificativa} onChange={e=>setForm({...form,justificativa:e.target.value})} className="mt-1 min-h-[75px] w-full rounded-lg border p-2" placeholder="Por que este material será alterado?"/></label>
     <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Ajuste nesta peça somente. O histórico e os custos originais do WVetro são preservados. Confira listas de compra, PDFs e corte antes da produção.</p>
     {erro&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}
    </div>
    <div className="flex justify-end gap-2 border-t p-4"><button disabled={salvando} onClick={()=>setAcao(null)} className="rounded-lg border px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={salvando} onClick={()=>void salvar()} className={'rounded-lg px-4 py-2 text-xs font-bold text-white '+(acao==='excluir'?'bg-red-700':'bg-blue-700')}>{salvando?'Salvando...':'Confirmar '+nomeAcao[acao].toLowerCase()}</button></div>
   </div>
  </div>}
 </section>
}
