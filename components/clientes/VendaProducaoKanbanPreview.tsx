'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, FileDown, ImageOff, Layers3, LockKeyhole, PackageCheck, Printer, ShieldAlert } from 'lucide-react'
import { refItemProducaoInstalacao } from '@/lib/vendaInstalacaoProducao'
import VendaListaCorteWVetro from '@/components/clientes/VendaListaCorteWVetro'
import { supabase } from '@/lib/supabase'
import { tokenAtual } from '@/lib/auth'

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
  {id:'em_producao',nome:'Em produção'},
  {id:'pendente',nome:'Produção pendente'},
  {id:'concluida',nome:'Produção concluída'},
] as const
const FASES=[
  {id:'corte',nome:'Corte'},
  {id:'montagem',nome:'Montagem'},
  {id:'conferencia',nome:'Conferência de qualidade'},
] as const
type Etapa=typeof ETAPAS[number]['id']
type Fase=typeof FASES[number]['id']
const nomeFase=(fase:Fase)=>FASES.find(f=>f.id===fase)?.nome||'Corte'
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
  if(ordens.some(o=>o.status==='conferencia'||o.status==='em_producao'))return 'em_producao'
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
export default function VendaProducaoKanbanPreview({ordens,itens,materiais,produtosMateriais,pacoteId,orcamentoId,vendaId,onAtualizar,onEditarCortes}:{
  ordens:Ordem[];itens:any[];materiais:Material[];produtosMateriais:Record<string,Produto>;
  pacoteId?:string|null;orcamentoId:string;vendaId:string;onAtualizar:()=>Promise<void>|void;onEditarCortes:()=>void
}){

  const [pendencias,setPendencias]=useState<Array<{ordem_id:string;item_ref:string;motivo:string;categoria:string}>>([])
  const [modalMovimento,setModalMovimento]=useState<{ref:string;destino:Etapa}|null>(null)
  const [categoriaPendencia,setCategoriaPendencia]=useState('perfil')
  const [justificativa,setJustificativa]=useState('')
  const [salvandoMovimento,setSalvandoMovimento]=useState(false)
  const [qtdConferencia,setQtdConferencia]=useState(1)
  const [pendenciasCarregadas,setPendenciasCarregadas]=useState(false)
  const [diagnostico,setDiagnostico]=useState<{medicoesTotal:number;medicoesAprovadas:number}|null>(null)
  const [movimentoRecusado,setMovimentoRecusado]=useState<{ref:string;destino:Etapa;motivo:string}|null>(null)
  const [fasesSim,setFasesSim]=useState<Record<string,Fase>>({})
  const [modoInicial,setModoInicial]=useState(false)
  const [podeConfigurar,setPodeConfigurar]=useState(false)
  const [modoInicialDisponivel,setModoInicialDisponivel]=useState(true)
  const [podeMovimentarInicial,setPodeMovimentarInicial]=useState(false)
  const [mostrarPermissoes,setMostrarPermissoes]=useState(false)
  const [usuariosPermissoes,setUsuariosPermissoes]=useState<Array<{id:string;nome:string;role:string}>>([])
  const [permissoesEquipe,setPermissoesEquipe]=useState<Record<string,boolean>>({})
  const [salvandoPermissao,setSalvandoPermissao]=useState<string|null>(null)
  const [configurandoModo,setConfigurandoModo]=useState(false)
  const [versaoEstado,setVersaoEstado]=useState(0)
  const [etapasIniciais,setEtapasIniciais]=useState<Record<string,{etapa:Etapa;motivo_pendencia?:string|null;categoria_pendencia?:string|null;atualizado_em?:string|null}>>({})

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
  useEffect(()=>{
    let ativo=true
    void (async()=>{
      try{
        const token=await tokenAtual()
        if(!token)throw Error('Sessão expirada.')
        const resp=await fetch('/api/producao/kanban/movimentar?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const dados=await resp.json()
        if(!resp.ok)throw Error(dados.error||'Não foi possível carregar as pendências.')
        if(ativo){
          setPendencias(dados.pendencias||[])
          setDiagnostico(dados.diagnostico||null)
          setModoInicial(Boolean(dados.modoInicial))
          setPodeConfigurar(Boolean(dados.podeConfigurar))
          setModoInicialDisponivel(dados.modoInicialDisponivel!==false)
          setPodeMovimentarInicial(Boolean(dados.podeMovimentarInicial))
          setUsuariosPermissoes(dados.usuariosPermissoes||[])
          setPermissoesEquipe(Object.fromEntries((dados.permissoesEquipe||[]).map((p:{usuario_id:string;pode_movimentar:boolean})=>[p.usuario_id,p.pode_movimentar])))
          setEtapasIniciais(Object.fromEntries((dados.etapasIniciais||[]).map((x:{item_ref:string;etapa:Etapa;motivo_pendencia?:string|null;categoria_pendencia?:string|null;atualizado_em?:string|null})=>[x.item_ref,x])))
          setPendenciasCarregadas(true)
        }
      }catch(e){if(ativo){setPendenciasCarregadas(false);setDiagnostico(null);setAviso(e instanceof Error?e.message:'Falha ao carregar pendências.')}}
    })()
    return()=>{ativo=false}
  },[vendaId,ordens,versaoEstado])
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
      const produzidas=Math.min(qtdPrevista,Math.max(0,produzidasReais))
      const etapaReal=pendencias.some(p=>c.ordens.some(o=>o.id===p.ordem_id))?'pendente':etapaDaOrdem(c.ordens)
      const etapa=modoInicial?(etapasIniciais[c.ref]?.etapa||etapaReal):etapaReal
      const provisorio=modoInicial&&Boolean(etapasIniciais[c.ref])
      const fase=c.ordens.some(o=>o.status==='conferencia')?'conferencia':fasesSim[c.ref]||'corte'
      const pronta=c.ordens.length>0&&c.ordens.every(habilitada)
      return {...c,provisorio,
        nome:texto(i.tipo_outro_texto)||texto(i.descricao)||texto(i.tipo_esquadria)||texto(i.tipologia_nome)||texto(i.configuracao_nome)||texto(ordem?.titulo)||'Tipologia '+(c.indice+1),
        ambiente:texto(i.ambiente)||texto(i.local)||'Ambiente não informado',
        largura:valor(i.largura_mm||ordem?.item_snapshot?.largura_mm),
        altura:valor(i.altura_mm||ordem?.item_snapshot?.altura_mm),
        foto:fotoCadastrada[texto(i.tipologia_id)||texto(ordem?.item_snapshot?.tipologia_id)]||imagemTipologia(i)||imagemTipologia(ordem?.item_snapshot||{}),
        qtd:qtdPrevista,produzidas,etapa,fase,pronta,progresso:Math.round((produzidas/qtdPrevista)*100),
        bloqueio:c.ordens.map(o=>texto(o.bloqueio_motivo)).filter(Boolean).join(' · '),
        pendencia:provisorio
          ?(etapa==='pendente'?{categoria:etapasIniciais[c.ref].categoria_pendencia||'outros',motivo:etapasIniciais[c.ref].motivo_pendencia||'Pendência inicial'}:undefined)
          :pendencias.find(p=>c.ordens.some(o=>o.id===p.ordem_id)),
      }
    })
  },[itens,ordens,fasesSim,fotoCadastrada,pendencias,modoInicial,etapasIniciais])
  const materialDoCard=(ref:string)=>materiais.filter(m=>String(m.item_ref||'')===ref)
  const prepararFluxo=()=>{
    setMovimentoRecusado(null)
    document.getElementById('atlas-preparar-fluxo-obra')?.scrollIntoView({behavior:'smooth',block:'center'})
  }
  const conferirLiberacao=()=>{
    setMovimentoRecusado(null)
    document.getElementById('atlas-conferencia-liberacao-venda')?.scrollIntoView({behavior:'smooth',block:'start'})
  }
  function mover(ref:string,destino:Etapa){
    const card=cards.find(c=>c.ref===ref)
    if(!card||destino===card.etapa)return
    setMovimentoRecusado(null)
    const recusar=(motivo:string)=>{
      setModalMovimento(null)
      setMovimentoRecusado({ref,destino,motivo})
      setAviso('Movimentação não realizada: '+motivo)
    }
    if(!pendenciasCarregadas){recusar('Aguarde a verificação da produção e tente novamente.');return}
    if(modoInicial){
      if(!podeMovimentarInicial){recusar('Seu usuário tem somente acesso de consulta. Peça ao Master para liberar a movimentação em Permissões da Produção.');return}
      setJustificativa('');setCategoriaPendencia('perfil')
      setQtdConferencia(Math.max(1,card.qtd-card.produzidas))
      setModalMovimento({ref,destino});setAviso('')
      return
    }
    if(!card.ordens.length){
      const medicao=diagnostico?.medicoesTotal===0
        ? ' Também não há Medição Final de tipologia registrada.'
        :diagnostico&&diagnostico.medicoesAprovadas===0
          ? ' A Medição Final de tipologia ainda não está aprovada.' : ''
      recusar('Esta tipologia tem um card visual, mas não possui ordem de produção vinculada.'+medicao+' Prepare o fluxo da obra, confira a Medição Final e os materiais, depois libere a ordem.');return
    }
    if(destino!=='aguardando'&&!card.pronta&&card.etapa!=='pendente'){
      recusar('A ordem ainda está bloqueada pela liberação técnica. Confira a Medição Final, os materiais e use a seção Conferência para liberar as ordens.');return
    }
    if(destino==='aguardando'){recusar('O retorno a Aguardando liberação exige uma revisão técnica.');return}
    if(destino==='liberada'&&card.etapa==='aguardando'){
      recusar('A liberação inicial não é um arraste comum: é feita pela conferência técnica e pelo botão de liberar ordens, depois de cumprir os requisitos.');return
    }
    if(destino==='concluida'&&!(card.etapa==='em_producao'&&card.fase==='conferencia')){
      recusar('Antes de concluir, realize a conferência de qualidade das unidades.');return
    }
    setJustificativa('');setCategoriaPendencia('perfil')
    setQtdConferencia(Math.max(1,card.qtd-card.produzidas))
    setModalMovimento({ref,destino});setAviso('')
  }
  async function confirmarMovimento(){
    if(!modalMovimento||salvandoMovimento)return
    const card=cards.find(c=>c.ref===modalMovimento.ref)
    if(!card)return
    if(!modoInicial&&modalMovimento.destino==='concluida'&&(!Number.isInteger(qtdConferencia)||qtdConferencia<1||qtdConferencia>card.qtd-card.produzidas)){setAviso('Informe uma quantidade válida de unidades conferidas.');return}
    if((modalMovimento.destino==='pendente'||card.etapa==='pendente')&&justificativa.trim().length<5){
      setAviso('A justificativa precisa ter pelo menos 5 caracteres.');return
    }
    setSalvandoMovimento(true);setAviso('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada.')
      const resp=await fetch('/api/producao/kanban/movimentar',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId,itemRef:card.ref,destino:modalMovimento.destino,
          categoria:categoriaPendencia,motivo:modalMovimento.destino==='pendente'?justificativa.trim():'',
          resolucao:card.etapa==='pendente'?justificativa.trim():'',
          quantidade:modalMovimento.destino==='concluida'?qtdConferencia:undefined})
      })
      const dados=await resp.json().catch(()=>({}))
      if(!resp.ok)throw Error(dados.error||'Falha ao gravar movimentação.')
      setModalMovimento(null)
      setVersaoEstado(v=>v+1)
      if(!modoInicial)await onAtualizar()
      setAviso(dados.aviso||'Movimentação registrada. O Kanban foi atualizado.')
    }catch(e){setAviso(e instanceof Error?e.message:'Não foi possível movimentar o card.')}
    finally{setSalvandoMovimento(false)}
  }
  async function alterarModoInicial(){
    if(configurandoModo||!podeConfigurar)return
    const proximo=!modoInicial
    if(!proximo&&!window.confirm('Desativar acompanhamento inicial? Os avanços continuam no histórico, mas o Kanban voltará a mostrar apenas os status oficiais das ordens.'))return
    setConfigurandoModo(true);setAviso('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada.')
      const resp=await fetch('/api/producao/kanban/movimentar',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({acao:'configurar_modo_inicial',vendaId,habilitado:proximo}),
      })
      const dados=await resp.json().catch(()=>({}))
      if(!resp.ok)throw Error(dados.error||'Não foi possível alterar o modo inicial.')
      setModoInicial(proximo)
      setVersaoEstado(v=>v+1)
      setAviso(proximo?'Acompanhamento inicial ativado nesta venda. O arraste será salvo sem gerar liberação técnica.':'Acompanhamento inicial desativado. As regras técnicas oficiais voltaram a controlar o Kanban.')
    }catch(e){setAviso(e instanceof Error?e.message:'Erro na configuração do modo inicial.')}
    finally{setConfigurandoModo(false)}
  }
  async function alterarPermissaoEquipe(usuarioId:string){
    if(!podeConfigurar||salvandoPermissao)return
    setSalvandoPermissao(usuarioId);setAviso('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada.')
      const permitir=!Boolean(permissoesEquipe[usuarioId])
      const resp=await fetch('/api/producao/kanban/movimentar',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({acao:'autorizar_usuario_modo_inicial',vendaId,usuarioId,permitir}),
      })
      const dados=await resp.json().catch(()=>({}))
      if(!resp.ok)throw Error(dados.error||'Não foi possível atualizar a permissão.')
      setPermissoesEquipe(prev=>({...prev,[usuarioId]:Boolean(dados.podeMovimentar)}))
      setAviso(permitir?'Usuário liberado para movimentar o Kanban inicial.':'Permissão de movimentação revogada. O usuário continua podendo consultar conforme seus acessos existentes.')
    }catch(e){setAviso(e instanceof Error?e.message:'Não foi possível atualizar a permissão.')}
    finally{setSalvandoPermissao(null)}
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
  const cores=['border-slate-200 bg-slate-50','border-sky-200 bg-sky-50','border-violet-200 bg-violet-50','border-orange-200 bg-orange-50','border-emerald-200 bg-emerald-50']

  return <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold text-slate-900"><Layers3 size={19} className="text-blue-700"/>Kanban de tipologias · {modoInicial?'acompanhamento inicial':'movimentação controlada'}</h3>
        <p className="mt-1 text-xs text-slate-600">Uma tipologia por card, com cinco colunas. {modoInicial?'Modo inicial: cards avançam e são salvos sem exigir a Medição Final ou ordem. Isso não libera tecnicamente a fabricação nem altera estoque, contagem de peças ou Instalação.':'Movimentações reais exigem confirmação e liberação técnica.'} Pendências têm justificativa obrigatória.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>setSelecionados(selecionadosValidos.length===cards.length?[]:cards.map(c=>c.ref))}>{selecionadosValidos.length===cards.length?'Desmarcar todas':'Selecionar todas'}</button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white" onClick={()=>prepararImpressao(selecionadosValidos)}><FileDown size={14}/>Imprimir selecionadas ({selecionadosValidos.length})</button>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
      <div><b>Movimentação inicial da obra: {!modoInicialDisponivel?'aguardando atualização do banco':modoInicial?'ativada':'desativada'}.</b><p className="mt-1">Quando ativada, as etapas do Kanban são um acompanhamento administrativo. A Medição Final, as ordens e a liberação técnica permanecem pendentes até serem regularizadas.</p>{!modoInicialDisponivel&&<p className="mt-1 font-semibold text-amber-800">A função inicial ainda precisa da migração no banco. A movimentação técnica anterior continua disponível.</p>}</div>
      <div className="flex flex-wrap gap-2">
        {podeConfigurar&&<button type="button" disabled={configurandoModo||!pendenciasCarregadas||!modoInicialDisponivel} className="rounded-lg border border-blue-400 bg-white px-3 py-2 font-bold disabled:opacity-50" onClick={()=>void alterarModoInicial()}>{configurandoModo?'Salvando...':modoInicial?'Voltar às regras técnicas':'Autorizar movimentação inicial'}</button>}
        {podeConfigurar&&<button type="button" disabled={!modoInicialDisponivel} className="rounded-lg border border-blue-400 bg-white px-3 py-2 font-bold disabled:opacity-50" aria-expanded={mostrarPermissoes} onClick={()=>setMostrarPermissoes(prev=>!prev)}>{mostrarPermissoes?'Fechar permissões':'Permissões da Produção'}</button>}
        {modoInicial&&!podeMovimentarInicial&&<span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-bold text-amber-800">Você pode consultar, mas não movimentar cards.</span>}
      </div>
    </div>
    {mostrarPermissoes&&podeConfigurar&&<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-900">Permissões da Produção — funcionários</h4>
      <p className="mt-1 text-xs text-slate-600">Libere ou revogue a movimentação inicial individualmente. A permissão vale para o Kanban inicial das vendas desta empresa, sem liberar financeiramente a obra, sem autorizar a produção técnica e sem conceder acesso a outros setores. Somente o Master altera essas permissões.</p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {usuariosPermissoes.map(u=><div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2">
          <div className="min-w-0"><b className="block truncate text-xs text-slate-800">{u.nome}</b><span className="text-[11px] text-slate-500">{u.role} · {permissoesEquipe[u.id]?'Pode movimentar':'Somente consulta (se autorizada)'}</span></div>
          <button type="button" disabled={Boolean(salvandoPermissao)} onClick={()=>void alterarPermissaoEquipe(u.id)} className={'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 '+(permissoesEquipe[u.id]?'border-amber-400 bg-amber-50 text-amber-800':'border-blue-500 bg-blue-700 text-white')}>
            {salvandoPermissao===u.id?'Salvando...':permissoesEquipe[u.id]?'Revogar movimentação':'Liberar movimentação'}
          </button>
        </div>)}
        {!usuariosPermissoes.length&&<p className="py-3 text-xs text-slate-500">Nenhum outro usuário cadastrado nesta empresa.</p>}
      </div>
    </div>}
    {aviso&&<p role="status" className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">{aviso}</p>}
    {!modoInicial&&cards.some(c=>!c.ordens.length)&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="status">
      <div><b>{cards.filter(c=>!c.ordens.length).length} tipologia(s) sem ordem de produção.</b>{' '}Esses cards não podem avançar até a geração das ordens e a liberação técnica.
      {diagnostico?.medicoesTotal===0&&<p className="mt-1">Não há Medição Final de tipologia cadastrada nesta venda.</p>}
      {diagnostico&&diagnostico.medicoesTotal>0&&diagnostico.medicoesAprovadas===0&&<p className="mt-1">As Medições Finais desta venda ainda não foram aprovadas.</p>}
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold" onClick={prepararFluxo}>Preparar fluxo da obra</button><button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold" onClick={conferirLiberacao}>Conferir requisitos</button></div>
    </div>}
    <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
      {ETAPAS.map((etapa,idx)=>{
        const lista=cards.filter(c=>c.etapa===etapa.id)
        return <div key={etapa.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const ref=e.dataTransfer.getData('text/plain');mover(ref,etapa.id)}} className={'w-[235px] min-w-[235px] rounded-xl border p-2 '+cores[idx]}>
          <div className="mb-2 flex items-center justify-between px-1"><b className="text-xs text-slate-800">{etapa.nome}</b><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">{lista.length}</span></div>
          <div className="space-y-2 min-h-20">{lista.map(c=>{
            const entrada=entradaSim[c.ref]||(c.provisorio&&etapasIniciais[c.ref]?.atualizado_em?Date.parse(etapasIniciais[c.ref].atualizado_em!):0)
            const dur=entrada?agora-entrada:null
            const atraso=dur!=null&&dur>24*3600000?'text-red-700':dur!=null&&dur>8*3600000?'text-amber-700':'text-slate-500'
            return <div key={c.ref} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',c.ref)} title={modoInicial?'Arraste para avançar no acompanhamento inicial':!c.pronta?'A movimentação depende da liberação técnica':'Arraste para movimentar'} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2"><input type="checkbox" aria-label={'Selecionar '+c.nome} checked={selecionadosValidos.includes(c.ref)} onChange={e=>setSelecionados(prev=>e.target.checked?[...new Set([...prev,c.ref])]:prev.filter(r=>r!==c.ref))}/>
                {c.foto?<img src={c.foto} alt={'Desenho da '+c.nome} className="h-14 w-14 shrink-0 rounded border object-contain"/>:<div role="status" className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded border border-amber-300 bg-amber-50 text-center text-[9px] font-semibold text-amber-800"><ImageOff size={16}/>Desenho pendente</div>}
                <div className="min-w-0 flex-1"><b className="block text-xs text-slate-900">{c.nome}</b><p className="text-[11px] text-slate-500">{c.ambiente}</p><p className="text-[11px] text-slate-500">{c.largura&&c.altura?c.largura+' × '+c.altura+' mm · ':''}{c.qtd} un.</p></div>
              </div>
              <p className={'mt-2 flex items-center gap-1 text-[11px] font-semibold '+(c.pronta?'text-emerald-700':'text-amber-700')}>{c.pronta?<CheckCircle2 size={13}/>:<LockKeyhole size={13}/>} {c.pronta?'Liberada tecnicamente':'Aguardando liberação técnica'}</p>
              {c.provisorio&&<p className="mt-1 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-bold text-blue-800">Etapa salva no acompanhamento inicial</p>}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{width:c.progresso+'%'}}/></div>
              <div className="mt-1 flex justify-between text-[11px]"><span>{c.produzidas}/{c.qtd} produzidas</span><b>{c.progresso}%</b></div>
              <p className={'mt-1 flex items-center gap-1 text-[10px] '+atraso}><Clock3 size={11}/>{dur==null?'Tempo na etapa: a registrar':'Nesta etapa: '+duracao(dur)}</p>
              {c.etapa==='em_producao'&&<p className="mt-2 rounded-md bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800">Etapa interna: {nomeFase(c.fase)}</p>}
              {c.pendencia&&<p className="mt-1 text-[11px] font-semibold text-amber-800">Pendência: {c.pendencia.categoria} — {c.pendencia.motivo}</p>}
              {c.bloqueio&&<p className="mt-1 text-[10px] text-amber-700">{c.bloqueio}</p>}
              {!c.ordens.length&&<p className="mt-1 text-[10px] font-bold text-amber-800">Ordem de produção ainda não gerada</p>}
              <label className="mt-2 block text-[11px] font-semibold text-slate-700">Mover para
                <select aria-label={'Mover '+c.nome} disabled={!pendenciasCarregadas||salvandoMovimento} value={c.etapa} onChange={e=>mover(c.ref,e.target.value as Etapa)} className="mt-1 w-full rounded border bg-white px-1.5 py-1.5 text-xs">
                  {ETAPAS.map(op=><option key={op.id} value={op.id}>{op.nome}</option>)}
                </select>
              </label>
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
      {abertoCard.etapa==='em_producao'&&<div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
        <p className="mb-2 text-xs font-bold text-violet-900">Etapas internas de Em produção</p>
        <div className="flex flex-wrap gap-2">{FASES.map(f=><button key={f.id} type="button" aria-pressed={abertoCard.fase===f.id}
          onClick={()=>{if(modoInicial){setFasesSim(prev=>({...prev,[abertoCard.ref]:f.id}));setAviso('Etapa interna '+f.nome+' no acompanhamento inicial é apenas visual. A conferência operacional continua exigindo liberação técnica.')}else if(f.id==='conferencia'){setJustificativa('');setModalMovimento({ref:abertoCard.ref,destino:'conferencia' as Etapa})}else{setFasesSim(prev=>({...prev,[abertoCard.ref]:f.id}));setAviso('Etapa interna '+f.nome+' é um controle visual; confirme a conferência para gravar o avanço real.')}}}
          className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(abertoCard.fase===f.id?'border-violet-700 bg-violet-700 text-white':'border-violet-200 bg-white text-violet-800')}>
          {f.nome}
        </button>)}</div>
        <p className="mt-2 text-[11px] text-violet-700">{modoInicial?'As fases internas ainda são visuais; mover para Produção concluída neste modo não registra unidades nem libera a Instalação.':'Após conferir, mova para Produção concluída e informe as unidades aprovadas. A conclusão usa o registro operacional existente.'}</p>
      </div>}
      <VendaListaCorteWVetro
        materiais={materialDoCard(abertoCard.ref).map(m=>({...m,unidade:m.unidade||'UN'}))}
        obraId={null} pacoteId={pacoteId} orcamentoId={orcamentoId} onEditar={onEditarCortes}
        imagensPorProduto={Object.fromEntries(Object.entries(produtosMateriais).filter(([,p])=>Boolean(p.foto_url)).map(([id,p])=>[id,String(p.foto_url)]))}
        imagensPorCodigo={Object.fromEntries(Object.values(produtosMateriais).filter(p=>Boolean(p.codigo&&p.foto_url)).map(p=>[String(p.codigo).trim().toUpperCase(),String(p.foto_url)]))}/>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs">
        <span>Unidades produzidas: {abertoCard.produzidas}/{abertoCard.qtd}. Confirme a conclusão para registrar as unidades após a conferência.</span>
        <label>Mover etapa: <select aria-label="Etapa da produção" className="rounded border px-2 py-1" value={abertoCard.etapa} onChange={e=>mover(abertoCard.ref,e.target.value as Etapa)}>{ETAPAS.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <span className="text-slate-500">A confirmação grava a movimentação.</span>
      </div>
    </div>}
    {movimentoRecusado&&<div role="alertdialog" aria-modal="true" aria-label="Movimentação bloqueada" className="fixed left-4 right-4 top-1/2 z-[80] mx-auto max-w-lg -translate-y-1/2 rounded-xl border border-amber-400 bg-white p-5 shadow-2xl">
      <h4 className="text-sm font-bold text-amber-900">O card não foi movimentado</h4>
      <p className="mt-2 text-sm text-slate-700">{movimentoRecusado.motivo}</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={prepararFluxo} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700">Preparar fluxo</button><button type="button" onClick={conferirLiberacao} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Ver liberação técnica</button><button type="button" onClick={()=>setMovimentoRecusado(null)} className="rounded-lg border px-3 py-2 text-xs font-bold">Fechar</button></div>
    </div>}
    {modalMovimento&&<div role="dialog" aria-modal="true" aria-label="Confirmar movimentação da produção" className="fixed left-4 right-4 top-1/2 z-[80] mx-auto max-h-[85vh] max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl border border-amber-300 bg-white p-5 shadow-2xl">
      <h4 className="text-sm font-bold">Confirmar movimentação: {ETAPAS.find(e=>e.id===modalMovimento.destino)?.nome}</h4>
      <p className="mt-1 text-xs text-slate-600">{cards.find(c=>c.ref===modalMovimento.ref)?.nome}. {modoInicial?'A etapa ficará salva no acompanhamento inicial, sem alterar a ordem real ou a quantidade produzida.':'A atualização será gravada na ordem real.'}</p>
      {modalMovimento.destino==='concluida'&&!modoInicial&&<label className="mt-3 block text-xs font-semibold">Unidades conferidas nesta movimentação
        <input type="number" min={1} max={Math.max(1,(cards.find(c=>c.ref===modalMovimento.ref)?.qtd||1)-(cards.find(c=>c.ref===modalMovimento.ref)?.produzidas||0))} step={1} value={qtdConferencia} onChange={e=>setQtdConferencia(Math.floor(Number(e.target.value)||0))} className="mt-1 block w-28 rounded border bg-white p-2"/>
        <span className="mt-1 block font-normal text-slate-600">As unidades serão registradas pela conferência operacional. Somente a última unidade conclui o card e libera o fluxo existente para Instalação.</span>
      </label>}
      {modalMovimento.destino==='pendente'&&<label className="mt-3 block text-xs font-semibold">Motivo da pendência
        <select value={categoriaPendencia} onChange={e=>setCategoriaPendencia(e.target.value)} className="mt-1 block w-full rounded border bg-white p-2">
          <option value="perfil">Falta de perfil</option><option value="acessorio">Falta de acessório</option><option value="vidro">Falta de vidro</option><option value="fabricacao">Problema de fabricação</option><option value="outros">Outros</option>
        </select></label>}
      {(modalMovimento.destino==='pendente'||cards.find(c=>c.ref===modalMovimento.ref)?.etapa==='pendente')&&<label className="mt-3 block text-xs font-semibold">{modalMovimento.destino==='pendente'?'Justificativa obrigatória':'Como foi resolvida a pendência?'}
        <textarea rows={3} maxLength={1000} value={justificativa} onChange={e=>setJustificativa(e.target.value)} className="mt-1 block w-full rounded border bg-white p-2" placeholder="Explique o que está faltando ou como foi resolvido"/>
      </label>}
      <div className="mt-3 flex gap-2"><button disabled={salvandoMovimento} onClick={()=>void confirmarMovimento()} className="rounded bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{salvandoMovimento?'Salvando...':'Confirmar e salvar'}</button><button disabled={salvandoMovimento} onClick={()=>setModalMovimento(null)} className="rounded border bg-white px-4 py-2 text-xs">Cancelar</button></div>
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
