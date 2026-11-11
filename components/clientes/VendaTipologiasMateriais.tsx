'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, ClipboardCheck, Clock3, FileText, ImageOff, Loader2, Pencil, Plus, Printer, Replace, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import VendaConferenciaDocumentalWVetro from '@/components/clientes/VendaConferenciaDocumentalWVetro'
import TipologiaEsquadriaIlustracao from '@/components/clientes/TipologiaEsquadriaIlustracao'

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
type AbaTecnica='composicao'|'corte'|'barras'|'materiais'|'pdf'|'ia'|'historico'
const abasConferencia:{id:AbaTecnica;nome:string}[]=[{id:'composicao',nome:'Composição Técnica'},{id:'corte',nome:'Plano de Corte'},{id:'barras',nome:'Lista de Barras (Perfis)'},{id:'materiais',nome:'Materiais'},{id:'pdf',nome:'PDF / W.Vetro'},{id:'ia',nome:'IA Atlas'},{id:'historico',nome:'Histórico'}]
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
export default function VendaTipologiasMateriais({itens,materiais,pacoteId,vendaId,obraId,imagensProdutos,onAtualizar,onAbrirMateriais}:{
 itens:any[];materiais:Material[];pacoteId:string|null;vendaId:string;obraId?:string|null;
 imagensProdutos:Record<string,{foto_url?:string|null}>;onAtualizar:()=>Promise<void>;onAbrirMateriais?:()=>void
}){
 const [aberta,setAberta]=useState<string|null>(null)
 const [filtro,setFiltro]=useState('')
 const [filtroStatus,setFiltroStatus]=useState('todas')
 const [abaTecnica,setAbaTecnica]=useState<AbaTecnica>('composicao')
 const [ampliarDesenho,setAmpliarDesenho]=useState(false)
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
 const [selecionandoPerfil,setSelecionandoPerfil]=useState(false)
 const [produtoEscolhido,setProdutoEscolhido]=useState<Produto|null>(null)
 const [materialEditando,setMaterialEditando]=useState<Material|null>(null)
 const [form,setForm]=useState<Formulario>(padrao)
 const [busca,setBusca]=useState('')
 const [resultados,setResultados]=useState<Produto[]>([])
 const [pesquisando,setPesquisando]=useState(false)
 const itensComRef=useMemo(()=>itens.map((item,i)=>({...item,ref:String(item.id||''),indice:i})),[itens])
 useEffect(()=>{
  if(!itensComRef.length){if(aberta)setAberta(null);return}
  if(!aberta||!itensComRef.some(it=>it.ref===aberta))setAberta(itensComRef[0].ref||null)
 },[itensComRef,aberta])
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
  setErro('');setBusca('');setResultados([]);setSelecionandoPerfil(false);setProdutoEscolhido(null)
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
  setBusca(p.codigo||p.nome);setResultados([]);setProdutoEscolhido(p);setErro('')
 }
 async function salvar(){
  if(!acao||!aberta||!pacoteId||salvando)return
  if(form.justificativa.trim().length<5){setErro('Informe uma justificativa de pelo menos cinco caracteres.');return}
  if(acao!=='excluir'&&(!form.descricao.trim()||Number(form.quantidade_ajustada)<=0)){
   setErro('Informe a descrição e uma quantidade positiva.');return
  }
  if((acao==='substituir'||acao==='incluir')&&['perfil','contramarco'].includes(form.categoria)&&!form.produto_id){
   setErro('Selecione um perfil pelo catálogo, com desenho técnico cadastrado.');return
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
 const porcentagemConferida=itensComRef.length?Math.round(100*totalValidadas/itensComRef.length):0
 const statusAtual=carregandoSituacoes||erroSituacoes?'pendente':situacoes[aberta||'']?.situacao||'pendente'
 const fotoMaterial=(m:Material)=>{
  const foto=(m.produto_id&&imagensProdutos[m.produto_id]?.foto_url)||imagens[(m.codigo||'').toUpperCase()]||
   m.wvetro_dados?.imagem_atlas_url||m.wvetro_dados?.imagem_url||null
  return typeof foto==='string'?url(foto):null
 }
 const fotoDaTipologia=(it:any):string|null=>{
  const candidatos=[it?.foto_url,it?.imagem_url,it?.wvetro_item?.imagem_url,it?.wvetro_item?.ImagemUrl,it?.wvetro_item?.FotoUrl]
  return candidatos.find(v=>typeof v==='string'&&/^https:\/\//i.test(v))||null
 }
 const corAtual=materiaisAtuais.find(m=>m.cor_ref)?.cor_ref||''
 const linhaAtual=String(dadosAtuais?.linha||dadosAtuais?.linha_nome||dadosAtuais?.wvetro_item?.Linha||'')
 const perfisAtuais=materiaisAtuais.filter(m=>['perfil','contramarco'].includes(m.categoria))
 function iniciarSubstituicao(){
  setErro('');setMensagem('');setAcao(null);setAbaTecnica('materiais');setGrupo('perfis')
  if(!aberta||!pacoteId){setErro('Selecione uma tipologia com pacote técnico para substituir um perfil.');return}
  if(!master){setErro('A substituição de materiais está disponível para o usuário Master.');return}
  if(!perfisAtuais.length){setErro('Esta tipologia não possui perfis ativos para substituir. Confira a importação dos materiais.');return}
  if(perfisAtuais.length===1){abrirEdicao('substituir',perfisAtuais[0]);return}
  setSelecionandoPerfil(true)
 }
 function motivoBloqueioAprovacao():string|null{
  if(!aberta)return 'Selecione uma tipologia para confirmar a composição.'
  if(!pacoteId)return 'Esta tipologia ainda não possui pacote técnico vinculado.'
  if(!master)return 'A aprovação da composição técnica é reservada ao usuário Master.'
  if(carregandoSituacoes)return 'As conferências ainda estão sendo carregadas. Tente novamente.'
  if(erroSituacoes)return 'Não foi possível consultar as aprovações: '+erroSituacoes
  if(!materiaisAtuais.length)return 'Esta tipologia não tem materiais vinculados. Confira a importação antes de aprovar.'
  if(statusAtual==='validada'){
   const registro=situacoes[aberta]
   return 'Esta tipologia já foi aprovada'+(registro?.responsavel?' por '+registro.responsavel:'')+
    (registro?.data?' em '+new Date(registro.data).toLocaleString('pt-BR'):'')+'.'
  }
  return null
 }
 function solicitarAprovacao(){
  setErro('');setMensagem('')
  const motivo=motivoBloqueioAprovacao()
  if(motivo){if(statusAtual==='validada')setMensagem(motivo);else setErro(motivo);return}
  void confirmarComposicao()
 }
 async function confirmarComposicao(){
  if(!master||!pacoteId||!aberta||!materiaisAtuais.length||statusAtual==='validada'||salvando||carregandoSituacoes||erroSituacoes)return
  if(!window.confirm('Confirmo que conferi esta tipologia e toda a composição técnica com o W.Vetro. Registrar aprovação humana? Isto não libera Compras nem Produção.'))return
  setSalvando(true);setErro('');setMensagem('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const form=new FormData()
   form.append('vendaId',vendaId);form.append('pacoteId',pacoteId);form.append('itemRef',aberta);form.append('tipo','tipologia');form.append('acao','validar_atlas')
   const r=await fetch('/api/vendas/wvetro/conferencia-documental',{method:'POST',headers:{Authorization:'Bearer '+token},body:form})
   const dados=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(dados.error||'Falha ao registrar aprovação.')
   setMensagem('Conferência aprovada e registrada com responsável e histórico. Medida Final e Produção exigem suas próprias liberações.')
   setRecargaResumo(x=>x+1)
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível registrar a aprovação.')}
  finally{setSalvando(false)}
 }
 return <section className="space-y-4">
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
   <div className="flex min-w-[920px] items-center justify-between gap-2">
    <b className="shrink-0 text-sm text-slate-900">Fluxo da Obra</b>
    {([
     ['1. Venda','Concluída',true],['2. Conferência das Tipologias','Composição e Materiais',false],['3. Preparação de Materiais','Estoque e Necessidade',false],
     ['4. Compras','Cotação e Pedido',false],['5. Medida Final','Dimensões Definitivas',false],['6. Produção','Fabricação',false],['7. Instalação','Montagem',false]
    ] as const).map(([titulo,desc,concluido],i)=><div key={titulo} className="flex min-w-0 items-center gap-2">
     <span className={`flex min-h-[51px] items-center rounded-full border px-3 text-left ${concluido?'border-emerald-200 bg-emerald-50 text-emerald-800':i===1?'border-blue-500 bg-blue-50 text-blue-900 shadow-[0_0_0_2px_#dbeafe]':'border-slate-200 bg-slate-50 text-slate-600'}`}>
      <span className={`mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-full ${concluido?'bg-emerald-600 text-white':i===1?'bg-blue-700 text-white':'bg-slate-200 text-slate-600'}`}>
       {concluido?<CheckCircle2 size={16}/>:i===1?<ClipboardCheck size={15}/>:<span className="text-xs font-bold">{i+1}</span>}</span>
      <span><b className="block whitespace-nowrap text-[11px]">{titulo}</b><span className="block whitespace-nowrap text-[10px]">{desc}</span></span>
     </span>{i<6&&<ChevronRight size={15} className="shrink-0 text-slate-400"/>}
    </div>)}
   </div>
  </div>
  <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(285px,340px)_minmax(0,1fr)]">
   <aside className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex items-center justify-between gap-2 border-b pb-4">
     <h2 className="text-base font-bold text-slate-900">Tipologias da Obra ({itensComRef.length})</h2>
     <select aria-label="Filtrar situação da conferência" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
      className="max-w-[135px] rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800">
      <option value="todas">Todas</option><option value="pendente">Pendentes</option><option value="validada">Conferidas</option><option value="revisar">Revisar</option>
     </select>
    </div>
    <label className="my-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-500">
     <Search size={15}/><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar ambiente ou tipologia" aria-label="Buscar tipologia" className="w-full bg-transparent text-xs outline-none"/>
    </label>
    <div className="space-y-2">
     {itensFiltrados.filter(it=>filtroStatus==='todas'||(situacoes[it.ref]?.situacao||'pendente')===filtroStatus).map(it=>{
      const ativo=aberta===it.ref
      const aprovado=situacoes[it.ref]?.situacao==='validada'
      const revisar=situacoes[it.ref]?.situacao==='revisar'
      return <button key={it.ref||it.indice} type="button" onClick={()=>{setAberta(it.ref||null);setGrupo('perfis');setAbaTecnica('composicao');setAbrirDocumento(null);setAcao(null);setSelecionandoPerfil(false);setErro('');setMensagem('')}}
       className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${ativo?'border-blue-400 bg-blue-50 shadow-sm':'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}>
       <span className="grid h-16 w-[74px] shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {fotoDaTipologia(it)?<img src={fotoDaTipologia(it)!} alt={'Imagem da '+(it.descricao||'tipologia')} className="h-full w-full object-contain"/>:<TipologiaEsquadriaIlustracao descricao={it.descricao||it.tipo_esquadria} compacta/>}
       </span>
       <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-slate-900">{String(it.indice+1).padStart(2,'0')} – {it.ambiente||it.descricao||'Tipologia'}</span>
        <span className="mt-1 block truncate text-[11px] text-slate-600">{it.descricao||it.tipo_esquadria||'Esquadria sob medida'}</span>
        <span className="mt-1.5 block text-[10px] text-slate-600">Qtd: {n(it.quantidade||1)} <span className="px-1 text-slate-300">|</span> {it.largura_mm&&it.altura_mm?`${it.largura_mm} × ${it.altura_mm} mm`:'Dimensões a conferir'}</span>
        <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${aprovado?'bg-emerald-100 text-emerald-800':revisar?'bg-orange-100 text-orange-800':'bg-amber-50 text-amber-700'}`}>
         {aprovado?<CheckCircle2 size={12}/>:<Clock3 size={12}/>} {aprovado?'Conferida':revisar?'Revisar':'Pendente'}
        </span>
       </span><ChevronRight size={17} className={ativo?'text-blue-700':'text-slate-500'}/>
      </button>
     })}
     {!itensFiltrados.filter(it=>filtroStatus==='todas'||(situacoes[it.ref]?.situacao||'pendente')===filtroStatus).length&&<p className="rounded-lg border border-dashed p-4 text-xs text-slate-500">Nenhuma tipologia encontrada neste filtro.</p>}
    </div>
    <div className="mt-auto pt-5">
     <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-900">Resumo da Conferência</h3>
      <div className="flex items-center gap-5">
       <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{background:`conic-gradient(#10b981 ${porcentagemConferida}%, #e2e8f0 ${porcentagemConferida}% 100%)`}}>
        <span className="grid h-[75px] w-[75px] place-items-center rounded-full bg-white text-xl font-extrabold text-slate-900">{porcentagemConferida}%</span>
       </div>
       <div className="min-w-0 flex-1 text-xs">
        <div className="flex justify-between border-b py-2"><span>Total de tipologias</span><b>{itensComRef.length}</b></div>
        <div className="flex justify-between gap-1 border-b py-2"><span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14}/> Conferidas</span><b>{totalValidadas}</b></div>
        <div className="flex justify-between gap-1 py-2"><span className="inline-flex items-center gap-1 text-amber-700"><Clock3 size={14}/> Pendentes</span><b>{Math.max(0,itensComRef.length-totalValidadas)}</b></div>
       </div>
      </div>
      {erroSituacoes&&<p role="status" className="mt-2 text-[11px] text-amber-700">Status indisponível: {erroSituacoes}</p>}
     </div>
    </div>
   </aside>
   <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    {dadosAtuais?<>
     <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-5 sm:px-5">
      <div><h2 className="text-lg font-bold text-slate-900 sm:text-xl">{String(dadosAtuais.indice+1).padStart(2,'0')} – {dadosAtuais.ambiente||'Tipologia'} <span className="mx-1 font-normal text-slate-300">|</span> <span className="text-sm font-semibold">{dadosAtuais.descricao||dadosAtuais.tipo_esquadria||'Esquadria sob medida'}</span></h2></div>
      <div className="text-right"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${statusAtual==='validada'?'bg-emerald-100 text-emerald-800':statusAtual==='revisar'?'bg-orange-100 text-orange-800':'bg-amber-100 text-amber-800'}`}>
       {statusAtual==='validada'?<CheckCircle2 size={16}/>:<Clock3 size={16}/>} {statusAtual==='validada'?'Conferida e Aprovada':statusAtual==='revisar'?'Revisão Necessária':'Pendente de Conferência'}</span>
       {situacoes[aberta||'']?.data&&<div className="mt-1 text-[10px] text-slate-500">Aprovado por: {situacoes[aberta||'']?.responsavel||'Usuário'} <span className="px-1">|</span> {new Date(situacoes[aberta||'']?.data||'').toLocaleString('pt-BR')}</div>}
      </div>
     </div>
     <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 pb-4 sm:px-5">
      <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><b>Qtd:</b> {n(dadosAtuais.quantidade||1)}</span>
      <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><b>Medidas:</b> {dadosAtuais.largura_mm&&dadosAtuais.altura_mm?`${dadosAtuais.largura_mm} × ${dadosAtuais.altura_mm} mm`:'A conferir'}</span>
      <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><b>Cor:</b> {corAtual||'Não informada'}</span>
      <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><b>Linha:</b> {linhaAtual||'Não informada'}</span>
     </div>
     <nav className="flex flex-nowrap gap-0 overflow-x-auto border-b border-slate-200 px-3" aria-label="Etapas da tipologia">
      {abasConferencia.map(t=><button key={t.id} type="button" onClick={()=>{setAbaTecnica(t.id);setAcao(null)}}
       className={`shrink-0 border-b-[3px] px-3 py-3.5 text-[11px] font-semibold sm:text-xs ${abaTecnica===t.id?'border-blue-700 text-blue-700':'border-transparent text-slate-700 hover:border-blue-200 hover:text-blue-700'}`}>{t.nome}</button>)}
     </nav>
     <div className="min-h-[390px] flex-1 p-3 sm:p-4">
      {abaTecnica==='composicao'&&<div className="grid gap-3 xl:grid-cols-[minmax(170px,235px)_minmax(280px,1fr)_minmax(200px,260px)]">
       <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
        <div className="flex w-full flex-1 items-center justify-center overflow-hidden rounded-lg">
         {fotoDaTipologia(dadosAtuais)?<img src={fotoDaTipologia(dadosAtuais)!} alt={'Imagem '+(dadosAtuais.descricao||'da tipologia')} className="max-h-[310px] w-full object-contain"/>:<TipologiaEsquadriaIlustracao descricao={dadosAtuais.descricao||dadosAtuais.tipo_esquadria}/>}
        </div>
        {!fotoDaTipologia(dadosAtuais)&&<p className="mb-2 text-center text-[10px] text-slate-500">Representação ilustrativa, não é projeto de fabricação</p>}
        <button type="button" onClick={()=>setAmpliarDesenho(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><Search size={14}/> Ampliar</button>
       </div>
       <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
        <h3 className="border-b bg-slate-50 px-3 py-3 text-xs font-bold text-slate-900">Composição da Tipologia <span className="font-normal">(Conforme W.Vetro)</span></h3>
        <div className="max-h-[425px] overflow-auto">
         <table className="w-full min-w-[430px] border-collapse text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-left text-slate-700"><tr><th className="px-2 py-2">Item</th><th className="px-2 py-2">Descrição</th><th className="px-2 py-2">Código</th><th className="px-2 py-2 text-right">Qtd.</th><th className="px-2 py-2">Un.</th></tr></thead>
          <tbody>{materiaisAtuais.map(m=><tr key={m.id} className="border-t border-slate-100"><td className="px-2 py-1.5"><span className="grid h-10 w-12 place-items-center overflow-hidden rounded bg-slate-50">
           {fotoMaterial(m)?<img src={fotoMaterial(m)!} alt={'Imagem do produto '+(m.codigo||m.descricao)} className="h-full w-full object-contain"/>:<span title="Imagem do produto pendente"><ImageOff size={16} className="text-amber-600"/></span>}</span></td>
           <td className="px-2 py-2 font-semibold text-slate-800">{m.descricao}</td><td className="px-2 py-2 font-mono text-slate-700">{m.codigo||'—'}</td><td className="px-2 py-2 text-right">{n(m.quantidade_ajustada)}</td><td className="px-2 py-2">{m.unidade||'UN'}</td></tr>)}
           {!materiaisAtuais.length&&<tr><td colSpan={5} className="p-5 text-amber-800">Sem composição importada. Não é possível aprovar sem conferir os materiais.</td></tr>}
          </tbody>
         </table>
        </div>
       </div>
       <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
        <h3 className="flex items-center gap-2 text-xs font-bold text-blue-900"><Sparkles size={16}/> IA Atlas – Conferência do W.Vetro</h3>
        {statusAtual==='validada'?<div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900"><p className="flex items-center gap-2 font-bold"><CheckCircle2 size={17}/> Composição conferida</p><p className="mt-2 leading-relaxed">Esta composição foi aprovada por um responsável autorizado. Uma alteração futura exigirá nova revisão.</p></div>
         :<div className="rounded-lg border border-amber-100 bg-white p-3 text-xs text-amber-900"><p className="flex items-center gap-2 font-bold"><Clock3 size={17}/> {statusAtual==='revisar'?'Revisão necessária':'Aguardando conferência'}</p><p className="mt-2 leading-relaxed">Confira o relatório original e todos os materiais. A IA não pode afirmar compatibilidade sem validação humana.</p></div>}
        <div className="rounded-lg bg-white/80 p-3 text-[11px] text-slate-700"><b>Ações de conferência</b><p className="mt-2 flex items-center gap-2"><CheckCircle2 size={13} className="text-blue-700"/> Lista importada vinculada à peça</p>
         <p className="mt-2 flex items-center gap-2"><CheckCircle2 size={13} className="text-blue-700"/> Código, quantidades e medidas acessíveis</p><p className="mt-2 flex items-center gap-2"><ClipboardCheck size={13} className="text-blue-700"/> Aprovação exclusiva do Master</p></div>
        <button type="button" onClick={()=>setAbaTecnica('ia')} className="text-xs font-bold text-blue-700 underline">Ver conferência assistida</button>
       </div>
      </div>}
      {abaTecnica==='corte'&&<div className="space-y-3"><h3 className="text-sm font-bold">Plano de Corte – {dadosAtuais.ambiente||'Tipologia'}</h3><p className="text-xs text-slate-500">Peças cortadas da composição técnica. Não representam barras comerciais para compra.</p>
       <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[600px] text-xs"><thead className="bg-slate-100 text-left"><tr><th className="p-3">Imagem</th><th>Código e perfil</th><th>Qtd.</th><th>Comprimento de corte</th><th>Barra original</th><th>Cor</th></tr></thead><tbody>{materiaisAtuais.filter(m=>m.comprimento_corte_mm&&Number(m.comprimento_corte_mm)>0).map(m=><tr key={m.id} className="border-t"><td className="p-2">{fotoMaterial(m)?<img src={fotoMaterial(m)!} alt={m.descricao} className="h-12 w-16 object-contain"/>:<ImageOff size={18} className="text-amber-600"/>}</td><td><b>{m.codigo||'—'}</b><p>{m.descricao}</p></td><td>{n(m.quantidade_ajustada)}</td><td className="font-bold">{n(m.comprimento_corte_mm)} mm</td><td>{m.comprimento_barra_mm?n(m.comprimento_barra_mm)+' mm':'—'}</td><td>{m.cor_ref||'—'}</td></tr>)}
       {!materiaisAtuais.some(m=>m.comprimento_corte_mm&&Number(m.comprimento_corte_mm)>0)&&<tr><td colSpan={6} className="p-6 text-slate-500">Não há peças de corte individualizadas nesta composição.</td></tr>}</tbody></table></div>
      </div>}
      {abaTecnica==='barras'&&<div className="space-y-3"><h3 className="text-sm font-bold">Lista de Barras (Perfis)</h3><p className="text-xs text-slate-600">Esta seção mostra os perfis vinculados à tipologia. A compra de barras inteiras deve usar o relatório de barras utilizadas do W.Vetro, e não a soma dos cortes abaixo.</p>
       <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[530px] text-xs"><thead className="bg-slate-100 text-left"><tr><th className="p-3">Imagem</th><th>Código / perfil</th><th>Qtd. de peças</th><th>Comprimento da barra informado</th></tr></thead><tbody>{materiaisAtuais.filter(m=>['perfil','contramarco'].includes(m.categoria)).map(m=><tr key={m.id} className="border-t"><td className="p-2">{fotoMaterial(m)?<img src={fotoMaterial(m)!} alt={m.descricao} className="h-12 w-16 object-contain"/>:<ImageOff size={18} className="text-amber-600"/>}</td><td className="py-2"><b>{m.codigo||'—'}</b><p>{m.descricao}</p></td><td>{n(m.quantidade_ajustada)}</td><td>{m.comprimento_barra_mm?n(m.comprimento_barra_mm)+' mm':'Não informado'}</td></tr>)}</tbody></table></div>
       {onAbrirMateriais&&<button type="button" onClick={onAbrirMateriais} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">Abrir Materiais e relatório de barras utilizadas</button>}
      </div>}
      {abaTecnica==='materiais'&&<div className="space-y-3">
       <div className="flex flex-wrap gap-1 border-b pb-3">{grupos.map(g=><button key={g.id} type="button" onClick={()=>{setGrupo(g.id);setAcao(null)}} className={'rounded-lg px-3 py-2 text-xs font-bold '+(grupo===g.id?'bg-blue-700 text-white':'bg-slate-50 text-slate-600 hover:bg-blue-50')}>{g.nome}</button>)}</div>
       {grupo==='variaveis'||grupo==='formulas'?<div className="rounded-lg border bg-white p-4"><b className="text-sm">{grupo==='variaveis'?'Variáveis desta peça':'Fórmulas Padrão – Referência Técnica'}</b>
        {Object.keys(atualGrupo||{}).length?<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(atualGrupo,null,2)}</pre>:<p className="mt-3 text-xs text-slate-500">Não há dados estruturados importados para esta seção.</p>}
        <p className="mt-2 text-xs text-amber-700">Alterar materiais desta obra não modifica fórmulas de outras obras.</p></div>:<>
        <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{visiveis.length} itens · {grupos.find(g=>g.id===grupo)?.nome}</p>
         {master&&pacoteId&&aberta&&<button type="button" onClick={()=>abrirEdicao('incluir')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"><Plus size={15}/> Incluir material</button>}</div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-100 text-left uppercase text-slate-600"><tr><th className="p-2">Imagem</th><th>Código / descrição</th><th>Cor</th><th>Quantidade</th><th>Corte</th><th>Origem</th><th className="text-right">Ações</th></tr></thead><tbody>{visiveis.map(m=><tr key={m.id} className="border-t"><td className="p-2">{fotoMaterial(m)?<img src={fotoMaterial(m)!} alt={m.descricao} className="h-12 w-16 object-contain"/>:<span className="flex items-center gap-1 text-[10px] text-amber-700"><ImageOff size={16}/> Pendente</span>}</td><td className="py-2"><b className="font-mono">{m.codigo||'—'}</b><p>{m.descricao}</p></td><td>{m.cor_ref||'—'}</td><td>{n(m.quantidade_ajustada)} {m.unidade}</td><td>{m.comprimento_corte_mm?n(m.comprimento_corte_mm)+' mm':'—'}</td><td>{m.incluido_manual?'Ajuste Atlas':'W.Vetro / técnico'}</td><td className="pr-2"><div className="flex justify-end gap-1">{master&&<><button type="button" title="Ajustar quantidade ou corte" onClick={()=>abrirEdicao('ajustar',m)} className="rounded-lg border p-2"><Pencil size={14}/></button><button type="button" title="Substituir material" onClick={()=>abrirEdicao('substituir',m)} className="rounded-lg border p-2"><Replace size={14}/></button><button type="button" title="Excluir material" onClick={()=>abrirEdicao('excluir',m)} className="rounded-lg border p-2 text-red-600"><Trash2 size={14}/></button></>}</div></td></tr>)}{!visiveis.length&&<tr><td colSpan={7} className="p-6 text-slate-500">Nenhum material nesta categoria.</td></tr>}</tbody></table></div>
       </>}
      </div>}
      {(abaTecnica==='pdf'||abaTecnica==='ia')&&<div className="space-y-4">
       {abaTecnica==='ia'&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-blue-900"><Sparkles size={16}/> IA Atlas – Conferência do W.Vetro</h3><p className="mt-2 text-xs text-blue-900">A IA compara as informações do PDF com a composição técnica e apresenta sugestões. O Master precisa revisar e confirmar. Nenhuma quantidade, orçamento, compra ou fabricação é alterada automaticamente.</p></div>}
       <VendaConferenciaDocumentalWVetro vendaId={vendaId} pacoteId={pacoteId} tipo="tipologia" itemRef={aberta||''} iniciarAberto onValidacaoRegistrada={()=>setRecargaResumo(v=>v+1)}/>
      </div>}
      {abaTecnica==='historico'&&<div className="space-y-3"><h3 className="text-sm font-bold">Histórico de alterações desta tipologia</h3>{carregando&&<p className="text-xs text-slate-500">Carregando histórico...</p>}{historico.map(h=><div key={h.id} className="rounded-lg border bg-slate-50 p-3 text-xs"><b>{h.acao.toUpperCase()} · {h.usuario_nome||'Usuário'}</b><span className="ml-2 text-slate-500">{new Date(h.created_at).toLocaleString('pt-BR')}</span><p className="mt-1">{h.antes?.codigo||'—'} → {h.depois?.codigo||'Excluído'} · {h.justificativa}</p></div>)}{!historico.length&&!carregando&&<p className="text-xs text-slate-500">Nenhuma edição manual nesta tipologia. Confira as validações documentais na aba PDF / W.Vetro.</p>}</div>}
      {mensagem&&<p role="status" className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{mensagem}</p>}
      {erro&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
     </div>
     <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
      {linkFicha([aberta||''])&&<a href={linkFicha([aberta||''])!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><Printer size={15}/> Imprimir Ficha</a>}
      {linkFicha(selecionadasImpressao)&&<a href={linkFicha(selecionadasImpressao)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><FileText size={15}/> Imprimir Selecionadas</a>}
      <label className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" aria-label="Selecionar tipologia para impressão" checked={!!aberta&&selecionadasImpressao.includes(aberta)} onChange={e=>setSelecionadasImpressao(v=>e.target.checked&&aberta?[...new Set([...v,aberta])]:v.filter(x=>x!==aberta))}/> Selecionar</label>
      <button type="button" onClick={iniciarSubstituicao} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Pencil size={15}/> Substituir / Corrigir</button>
      <button type="button" onClick={()=>{setAbaTecnica('pdf');setAbrirDocumento(aberta)}} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><Upload size={15}/> Importar PDF Correto</button>
      <button type="button" disabled={salvando} onClick={solicitarAprovacao} title={motivoBloqueioAprovacao()||'Registrar aprovação desta tipologia'}
       className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={16}/> {salvando?'Validando...':statusAtual==='validada'?'Já aprovada':'Confirmar / Aprovar'}</button>
      {(erro||mensagem)&&<p role={erro?'alert':'status'} className={'w-full rounded-lg p-3 text-xs '+(erro?'border border-red-200 bg-red-50 text-red-800':'border border-blue-200 bg-blue-50 text-blue-800')}>{erro||mensagem}</p>}
     </footer>
    </>:<div className="grid min-h-[420px] place-items-center p-8 text-center text-sm text-slate-500">{itensComRef.length?'Selecione uma tipologia à esquerda para começar.':'Nenhuma tipologia técnica está vinculada a esta venda.'}</div>}
   </div>
  </div>
  {ampliarDesenho&&dadosAtuais&&<div role="dialog" aria-modal="true" aria-label="Ampliar ilustração da tipologia" className="fixed inset-0 z-[160] grid place-items-center bg-slate-950/70 p-5" onClick={()=>setAmpliarDesenho(false)}>
   <div className="w-full max-w-2xl rounded-2xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><b>{dadosAtuais.descricao||dadosAtuais.ambiente}</b><button type="button" aria-label="Fechar imagem" onClick={()=>setAmpliarDesenho(false)}><X size={18}/></button></div>
    <div className="grid min-h-[440px] place-items-center rounded-xl bg-slate-50">{fotoDaTipologia(dadosAtuais)?<img src={fotoDaTipologia(dadosAtuais)!} alt="Imagem ampliada da esquadria" className="max-h-[70vh] max-w-full object-contain"/>:<TipologiaEsquadriaIlustracao descricao={dadosAtuais.descricao||dadosAtuais.tipo_esquadria}/>}</div></div>
  </div>}
  {selecionandoPerfil&&aberta&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="Selecionar perfil para substituir">
   <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4"><h3 className="text-base font-bold">Escolha o perfil original</h3><button type="button" onClick={()=>setSelecionandoPerfil(false)} aria-label="Fechar seleção de perfil"><X size={18}/></button></div>
    <p className="px-4 pt-3 text-xs text-slate-600">Selecione o perfil desta tipologia que será corrigido ou substituído. O próximo passo permite buscar o substituto no catálogo.</p>
    <div className="space-y-2 overflow-y-auto p-4">{perfisAtuais.map(m=><button type="button" key={m.id} onClick={()=>abrirEdicao('substituir',m)} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:border-blue-400 hover:bg-blue-50">
     <span className="grid h-16 w-20 shrink-0 place-items-center rounded border bg-white">{fotoMaterial(m)?<img src={fotoMaterial(m)!} alt={'Desenho do perfil '+(m.codigo||m.descricao)} className="h-14 w-16 max-w-full object-contain"/>:<span className="flex flex-col items-center gap-1 text-[10px] text-amber-700"><ImageOff size={18}/>Imagem pendente</span>}</span>
     <span className="min-w-0 text-xs"><b className="block text-slate-900">{m.codigo||'Sem código'} · {m.descricao}</b><span className="mt-1 block text-slate-600">Quantidade: {n(m.quantidade_ajustada)} {m.unidade} · Corte: {m.comprimento_corte_mm?n(m.comprimento_corte_mm)+' mm':'—'}</span></span>
     <ChevronRight size={16} className="ml-auto shrink-0 text-blue-700"/>
    </button>)}</div>
    <div className="flex justify-end border-t p-3"><button type="button" onClick={()=>setSelecionandoPerfil(false)} className="rounded-lg border px-4 py-2 text-xs font-bold">Cancelar</button></div>
   </div>
  </div>}
  {acao&&aberta&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true">
   <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b p-4"><h3 className="text-base font-bold">{nomeAcao[acao]} · {dadosAtuais?.ambiente||'Tipologia'}</h3><button aria-label="Fechar edição" disabled={salvando} onClick={()=>setAcao(null)}><X size={18}/></button></div>
    <div className="space-y-3 overflow-y-auto p-4 text-xs">
     {materialEditando&&<div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
      <span className="grid h-16 w-20 shrink-0 place-items-center rounded border bg-white">{fotoMaterial(materialEditando)?<img src={fotoMaterial(materialEditando)!} alt={'Desenho do material original '+(materialEditando.codigo||'')} className="max-h-14 max-w-full object-contain"/>:<span className="text-center text-[10px] text-amber-700"><ImageOff size={20} className="mx-auto"/>Imagem pendente</span>}</span>
      <p>Material original: <b>{materialEditando.codigo||'—'}</b> · {materialEditando.descricao}</p>
     </div>}
     {acao!=='excluir'&&<>
      {acao!=='ajustar'&&<div><label className="block font-bold">Buscar no catálogo (código ou descrição)</label><div className="mt-1 flex gap-2">
       <input className="min-w-0 flex-1 rounded-lg border p-2" value={busca} onChange={e=>{setBusca(e.target.value);setProdutoEscolhido(null);setForm(prev=>({...prev,produto_id:'',codigo:''}))}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void pesquisar()}}} placeholder="Ex.: SU010, 30-023..."/>
       <button type="button" disabled={pesquisando||busca.length<2} onClick={()=>void pesquisar()} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">{pesquisando?<Loader2 size={14} className="animate-spin"/>:<Search size={14}/>} Buscar</button></div>
       {resultados.length>0&&<div className="mt-2 max-h-44 overflow-auto rounded-lg border">{resultados.map(p=><button type="button" key={p.id} onClick={()=>escolherProduto(p)} className="flex w-full items-center gap-2 border-b p-2 text-left hover:bg-blue-50">
        {p.foto_url?<img src={p.foto_url} alt={'Desenho '+p.codigo} className="h-10 w-10 object-contain"/>:<ImageOff size={20} className="text-amber-600"/>}
        <span><b>{p.codigo||'Sem código'}</b> · {p.nome}{p.codigo&&!p.foto_url?<span className="block text-amber-700">Imagem técnica pendente</span>:null}</span>
       </button>)}</div>}
       {produtoEscolhido&&<div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        {produtoEscolhido.foto_url?<img src={produtoEscolhido.foto_url} alt={'Desenho do substituto '+(produtoEscolhido.codigo||'')} className="h-16 w-20 object-contain"/>:<span className="text-amber-700"><ImageOff size={20}/></span>}
        <span className="text-xs text-emerald-900"><b className="block">Produto substituto selecionado</b>{produtoEscolhido.codigo||'Sem código'} · {produtoEscolhido.nome}</span>
       </div>}
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
