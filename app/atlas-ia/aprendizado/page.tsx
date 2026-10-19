'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ValidacaoLoteCatalogo from './ValidacaoLoteCatalogo'
import CompararPerfilCatalogo from './CompararPerfilCatalogo'
import Link from 'next/link'
import {
  ArrowLeft, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, FileText,
  Loader2, PackageSearch, RefreshCcw, ShieldCheck, Upload, XCircle, Sparkles,
  Building2, Boxes, GraduationCap, History, Save, ExternalLink, Search, Eye,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { localizarCodigoCatalogo } from '@/lib/ai/catalogoImagemCodigo'
import { limitesRecorteCartao } from '@/lib/ai/catalogoRecorteCartao'
import { codigoColadoDeOutrasColunas } from '@/lib/ai/catalogoCartoesGeometria'
import { mesmaReferenciaCatalogo } from '@/lib/ai/catalogoImagemReferencia'
import { conferirDadosCatalogo } from '@/lib/ai/catalogoConferencia'
import { lerImagemCatalogoPreview, salvarImagemCatalogoPreview } from '@/lib/ai/catalogoImagemPreview'
import { conferidoSomenteNaPrevia } from '@/lib/ai/catalogoFilaValidacao'

type Entrada = {
  id: string
  tipo: string
  titulo: string
  descricao?: string | null
  status: string
  fonte_nome?: string | null
  fonte_url?: string | null
  resumo_ia?: string | null
  setores_sugeridos?: string[]
  fornecedor_id_sugerido?: string | null
  fornecedor_nome_sugerido?: string | null
  criado_por_nome?: string | null
  created_at: string
  erro?: string | null
  mime_type?: string | null
  metadados?: {arquivado_em?:string|null}
}
type Candidato = {
  id: string
  entrada_id: string
  tipo: 'fornecedor'|'produto'|'conhecimento'
  modulo?: string | null
  titulo: string
  dados: Record<string, any>
  deduplicacao: Record<string, any>
  acao_sugerida?: string | null
  confianca?: number | null
  status: string
  destino_id?: string | null
  pode_validar: boolean
  foto_cadastro?: string | null
  codigo_verificavel?: boolean
  codigo_ambiguo?: boolean
  produto_cadastro?: {id:string;codigo:string;nome:string;categoria:string}|null
  validado_por_nome?: string | null
  validado_em?: string | null
}
type DadosAPI = {
  entradas: Entrada[]
  candidatos: Candidato[]
  totais: { pendentes:number; aplicados:number; rejeitados:number }
  somenteLeitura?: boolean
}

const TIPOS = [
  ['outro','Automático — deixar a IA identificar'],
  ['catalogo','Catálogo de fornecedor'],
  ['tabela_preco','Tabela de preço'],
  ['curso','Curso'],
  ['apostila','Apostila / manual'],
  ['regra','Regra / procedimento'],
  ['foto','Foto técnica'],
  ['conversa','Conversa / explicação'],
]
const MODULOS = [
  'gestao','comercial','orcamento','medicao_final','engenharia','compras','estoque',
  'producao','instalacao','financeiro','marketing','rh','qualidade','pd',
]
const LABELS: Record<string,string> = {
  gestao:'Gestão', comercial:'Comercial', orcamento:'Orçamento', medicao_final:'Medição Final',
  engenharia:'Engenharia', compras:'Compras', estoque:'Estoque', producao:'Produção',
  instalacao:'Instalação', financeiro:'Financeiro', marketing:'Marketing', rh:'RH',
  qualidade:'Qualidade', pd:'P&D / Sistemas',
}
const MAX = 50*1024*1024

function dataBr(v?:string|null){ return v ? new Date(v).toLocaleString('pt-BR') : '—' }
function pct(v?:number|null){ return v==null ? '—' : Math.round(v*100)+'%' }
function statusClasse(s:string){
  if(s==='aplicado'||s==='concluido')return 'bg-emerald-100 text-emerald-800'
  if(s==='rejeitado'||s==='erro')return 'bg-red-100 text-red-700'
  if(s==='corrigido')return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-800'
}
function labelAcao(v?:string|null){
  if(v==='usar_existente')return 'Fornecedor já existe'
  if(v==='vincular_existente')return 'Vincular ao item existente'
  if(v==='cadastrar_novo')return 'Cadastrar novo'
  if(v==='revisar_ambiguidade')return 'Revisar possível duplicidade'
  if(v==='validar_conhecimento_setorial')return 'Validar conhecimento do setor'
  if(v==='definir_setor')return 'Definir setor'
  if(v==='revisar_conflito')return 'Divergência encontrada'
  if(v==='revisar_pendencia')return 'Pendência real'
  if(v==='aguardar_fornecedor')return 'Aguardando fornecedor'
  return v||'Revisar'
}
function limparNomeArquivo(nome:string){ return nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,120) }

export default function CentralAprendizadoPage(){
  const [dados,setDados]=useState<DadosAPI>({entradas:[],candidatos:[],totais:{pendentes:0,aplicados:0,rejeitados:0}})
  const [aba,setAba]=useState<'entrada'|'validacoes'>('entrada')
  const [tipo,setTipo]=useState('outro')
  const [titulo,setTitulo]=useState('')
  const [descricao,setDescricao]=useState('')
  const [arquivo,setArquivo]=useState<File|null>(null)
  const [enviando,setEnviando]=useState(false)
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [aberto,setAberto]=useState<string|null>(null)
  const [catalogoAberto,setCatalogoAberto]=useState<string|null>(null)
  const [itemCatalogoAberto,setItemCatalogoAberto]=useState<string|null>(null)
  const [buscaCatalogo,setBuscaCatalogo]=useState('')
  const [mostrarHistorico,setMostrarHistorico]=useState(false)
  const [arquivando,setArquivando]=useState<string|null>(null)
  const [reprocessando,setReprocessando]=useState<string|null>(null)
  const [conferindoTabela,setConferindoTabela]=useState<string|null>(null)
  const [consultaPdfDiagnostico,setConsultaPdfDiagnostico]=useState<Record<string,Array<Record<string,any>>>>({})
  const [salvando,setSalvando]=useState<string|null>(null)
  const [entradaValidacaoFiltro,setEntradaValidacaoFiltro]=useState<string|null>(null)
  const [mostrarConferidosPreview,setMostrarConferidosPreview]=useState(false)
  const [edicoes,setEdicoes]=useState<Record<string,{titulo:string;modulo:string;dados:Record<string,any>;observacao:string}>>({})
  const fileRef=useRef<HTMLInputElement>(null)
  // Somente leitura: memoriza a tabela já conferida nesta sessão para que a imagem
  // e os dados continuem juntos ao abrir outro candidato, sem gravar no banco.
  const tabelasConsultandoRef=useRef<Set<string>>(new Set())
  const tabelasOriginaisRef=useRef<Map<string,Map<string,Record<string,any>>>>(new Map())

  function preencherPelaTabela(c:Candidato,tabela?:Map<string,Record<string,any>>):Candidato{
    if(c.tipo!=='produto'||!tabela)return c
    const codigo=String(c.dados?.codigo||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
    const extracao=tabela.get(codigo)
    if(!extracao)return c
    const revisao=conferirDadosCatalogo(c,extracao)
    if(!revisao)return c
    return {...c,dados:{...revisao.dados,divergencias_tabela:revisao.divergencias},
      titulo:String(c.dados?.codigo||'')+' — '+String(revisao.dados.descricao||'Produto')}
  }

  async function api(url:string,init?:RequestInit){
    if(dados.somenteLeitura&&init?.method&&init.method.toUpperCase()!=='GET')throw new Error('Esta prévia é somente leitura. As alterações de cadastro estão bloqueadas para proteger a produção.')
    const token=await tokenAtual()
    if(!token)throw new Error('Sessão expirada.')
    const r=await fetch(url,{...init,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(init?.headers||{})},cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(j.error||'Não foi possível concluir a operação.')
    return j
  }
  async function carregar(){
    setCarregando(true);setErro('')
    try{
      const resposta:DadosAPI=await api('/api/ia/central-aprendizado')
      if(resposta.somenteLeitura){
        // Não modifica o Supabase. Apenas restaura o teste local do mesmo usuário e código.
        try{
          const {data:{session}}=await supabase.auth.getSession()
          const uid=session?.user?.id||''
          resposta.candidatos=resposta.candidatos.map(c=>{
            if(c.tipo!=='produto'||c.foto_cadastro||c.dados?.imagem_item_url)return c
            const registro=lerImagemCatalogoPreview(window.localStorage,uid,c.id,String(c.dados?.codigo||''))
            if(!registro)return c
            return {...c,dados:{...c.dados,imagem_item_url:registro.imagem,imagem_preview_local:true}}
          })
        }catch{/* Navegador sem armazenamento: a consulta permanece somente leitura. */}
      }
      // Dados consultados no PDF são complementados apenas em memória até o usuário
      // confirmar e validar. Vale tanto para prévia quanto para produção.
      resposta.candidatos=resposta.candidatos.map(c=>preencherPelaTabela(c,tabelasOriginaisRef.current.get(c.entrada_id)))
      setDados(resposta)
    }catch(e:any){setErro(e?.message||'Erro ao carregar a Central de Aprendizado.')}
    finally{setCarregando(false)}
  }
  useEffect(()=>{void carregar()},[])
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    if(params.get('aba')==='validacoes')setAba('validacoes')
  },[])

  async function uploadDireto(file:File){
    if(dados.somenteLeitura||carregando)throw new Error('Aguarde o carregamento da Central. O envio é bloqueado na prévia de homologação.')
    const {data:{session}}=await supabase.auth.getSession()
    const uid=session?.user?.id
    if(!uid)throw new Error('Sessão expirada.')
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin'
    const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())
    const path='ingest/'+uid+'/'+id+'.'+ext
    const {error}=await supabase.storage.from('atlas-aprendizado').upload(path,file,{contentType:file.type||undefined,cacheControl:'3600',upsert:false})
    if(error)throw new Error('Falha ao enviar arquivo: '+error.message)
    return {path,nome:file.name,mediaType:file.type||'application/octet-stream',tamanho:file.size}
  }
  async function enviar(){
    if(dados.somenteLeitura){setErro('Prévia em modo somente leitura: o envio de arquivos fica bloqueado.');return}
    if(enviando)return
    if(!descricao.trim()&&!arquivo){setErro('Escreva uma explicação ou escolha um arquivo.');return}
    if(arquivo&&arquivo.size>MAX){setErro('Arquivo maior que 50 MB.');return}
    setEnviando(true);setErro('');setMensagem('')
    try{
      const arq=arquivo?await uploadDireto(arquivo):null
      const j=await api('/api/ia/central-aprendizado',{method:'POST',body:JSON.stringify({
        tipo,titulo:titulo.trim()||null,descricao:descricao.trim(),arquivo:arq,
      })})
      setMensagem(j.mensagem||'Material enviado para análise.')
      setTitulo('');setDescricao('');setArquivo(null);setTipo('outro')
      await carregar()
      if((j.pendencias||0)>0)setAba('validacoes')
    }catch(e:any){setErro(e?.message||'Erro ao enviar material.')}
    finally{setEnviando(false)}
  }

  function entradaDo(id:string){ return dados.entradas.find(e=>e.id===id) }
  const pendentesBase=useMemo(()=>dados.candidatos
    .filter(c=>['pendente','corrigido','aprovado'].includes(c.status)&&c.acao_sugerida!=='aguardar_fornecedor'&&!dados.entradas.find(e=>e.id===c.entrada_id)?.metadados?.arquivado_em)
    .sort((a,b)=>{
      const pa=a.tipo==='fornecedor'?0:a.tipo==='produto'?1:2
      const pb=b.tipo==='fornecedor'?0:b.tipo==='produto'?1:2
      return pa-pb
    }),[dados.candidatos,dados.entradas])
  // Conferência local na prévia não é aprovação oficial no banco.
  const conferidosPreview=useMemo(()=>dados.somenteLeitura
    ?pendentesBase.filter(conferidoSomenteNaPrevia):[],[pendentesBase,dados.somenteLeitura])
  const pendentes=useMemo(()=>dados.somenteLeitura
    ?pendentesBase.filter(c=>!conferidoSomenteNaPrevia(c)):pendentesBase,[pendentesBase,dados.somenteLeitura])
  const historico=useMemo(()=>[...dados.entradas].filter(e=>mostrarHistorico||(!e.metadados?.arquivado_em&&(e.status==='erro'||e.status==='analisando'||pendentes.some(c=>c.entrada_id===e.id)))).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[dados.entradas,mostrarHistorico,pendentes])

  function editarInicial(c:Candidato){
    setEdicoes(prev=>prev[c.id]?prev:{...prev,[c.id]:{titulo:c.titulo,modulo:c.modulo||'',dados:{...(c.dados||{})},observacao:''}})
    setAberto(v=>v===c.id?null:c.id)
  }
  function abrirValidacaoEntrada(entradaId:string){
    const candidatos=pendentes.filter(c=>c.entrada_id===entradaId)
    setEntradaValidacaoFiltro(entradaId)
    setMostrarConferidosPreview(false)
    setAba('validacoes')
    if(candidatos[0]){
      setEdicoes(prev=>prev[candidatos[0].id]?prev:{...prev,[candidatos[0].id]:{
        titulo:candidatos[0].titulo,
        modulo:candidatos[0].modulo||'',
        dados:{...(candidatos[0].dados||{})},
        observacao:''
      }})
      setAberto(candidatos[0].id)
    }
    window.setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50)
  }
  function campo(id:string,chave:string,valor:any){
    setEdicoes(prev=>({...prev,[id]:{...(prev[id]||{titulo:'',modulo:'',dados:{},observacao:''}),dados:{...(prev[id]?.dados||{}),[chave]:valor}}}))
  }
  function meta(id:string,chave:'titulo'|'modulo'|'observacao',valor:string){
    setEdicoes(prev=>({...prev,[id]:{...(prev[id]||{titulo:'',modulo:'',dados:{},observacao:''}),[chave]:valor}}))
  }
  async function arquivarEntrada(e:Entrada){
    if(arquivando)return
    if(dados.somenteLeitura){
      setMensagem('Prévia de testes: nenhum catálogo será arquivado. No Atlas oficial, arquivar retira as pendências sem excluir cadastros e históricos já aplicados.')
      return
    }
    if(!e.metadados?.arquivado_em&&!window.confirm('Cancelar a revisão do catálogo "'+e.titulo+'"? O material sairá da fila, mas os produtos já aplicados e o histórico continuarão preservados. Você poderá restaurá-lo depois.'))return
    setArquivando(e.id);setErro('')
    try{
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({acao:e.metadados?.arquivado_em?'restaurar_entrada':'arquivar_entrada',entrada_id:e.id})})
      setMensagem(j.mensagem);await carregar()
    }catch(err:any){setErro(err?.message||'Não foi possível arquivar o material.')}
    finally{setArquivando(null)}
  }
  async function reprocessarEntrada(e:Entrada){
    if(reprocessando)return
    setReprocessando(e.id);setErro('');setMensagem('')
    try{
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({acao:'reprocessar_entrada',entrada_id:e.id})})
      setMensagem(j.mensagem||'Catálogo reprocessado.')
      await carregar()
    }catch(err:any){setErro(err?.message||'Erro ao reprocessar catálogo.')}
    finally{setReprocessando(null)}
  }

  async function conferirTabela(e:Entrada,automatica=false){
    if(tabelasConsultandoRef.current.has(e.id))return
    if(automatica&&tabelasOriginaisRef.current.has(e.id))return
    tabelasConsultandoRef.current.add(e.id)
    setConferindoTabela(e.id)
    if(!automatica){setErro('');setMensagem('')}
    try{
      const resultado=await api('/api/ia/central-aprendizado?conferirTabela='+encodeURIComponent(e.id))
      const itensLidos:Array<Record<string,any>>=Array.isArray(resultado.itens)?resultado.itens:[]
      setConsultaPdfDiagnostico(prev=>({...prev,[e.id]:itensLidos}))
      const porCodigo=new Map<string,Record<string,any>>()
      for(const item of itensLidos){
        const codigo=String(item.codigo||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
        if(codigo&&!porCodigo.has(codigo))porCodigo.set(codigo,item)
      }
      // O PDF oficial é fonte da descrição, cotas e peso; a foto já confirmada prevalece.
      tabelasOriginaisRef.current.set(e.id,porCodigo)
      const originais=new Map(dados.candidatos.map(c=>[c.id,c]))
      const revisados=new Map<string,Candidato>()
      let corrigidos=0,conflitos=0
      for(const c of dados.candidatos){
        if(c.entrada_id!==e.id||c.tipo!=='produto')continue
        const novo=preencherPelaTabela(c,porCodigo)
        if(novo===c)continue
        revisados.set(c.id,novo)
        if((novo.dados.divergencias_tabela||[]).length)conflitos++
        corrigidos++
      }
      setDados(prev=>({...prev,candidatos:prev.candidatos.map(c=>
        c.entrada_id===e.id?preencherPelaTabela(c,porCodigo):c
      )}))
      // Se a edição estiver aberta mas ainda intacta, atualiza os campos visíveis.
      // Uma alteração manual iniciada enquanto o PDF era consultado nunca é substituída.
      setEdicoes(prev=>{
        const proximo={...prev}
        for(const [id,item] of revisados){
          const edicao=prev[id],original=originais.get(id)
          if(edicao&&original&&JSON.stringify(edicao.dados)===JSON.stringify(original.dados))
            proximo[id]={...edicao,titulo:item.titulo,dados:{...item.dados}}
        }
        return proximo
      })
      if(!automatica)setMensagem('Tabela do PDF conferida: '+corrigidos+' item(ns) exibidos com dados de origem'+
        (conflitos?', '+conflitos+' divergência(s) preservada(s) para revisão':'')+
        '. Consulta visual, sem gravar cadastros; desenhos ainda exigem homologação individual.')
    }catch(err:any){setErro('Não foi possível carregar os dados da tabela original: '+(err?.message||'tente novamente pelo botão Conferir tabela original.'))}
    finally{
      tabelasConsultandoRef.current.delete(e.id)
      setConferindoTabela(v=>v===e.id?null:v)
    }
  }

  useEffect(()=>{
    // Leitura somente GET nos dois ambientes; nunca altera catálogo ao abrir.
    const id=aba==='validacoes' ? dados.candidatos.find(c=>c.id===aberto)?.entrada_id : catalogoAberto
    const entrada=dados.entradas.find(e=>e.id===id)
    if(entrada?.mime_type==='application/pdf'&&['catalogo','tabela_preco'].includes(entrada.tipo)
      &&!tabelasOriginaisRef.current.has(entrada.id)){
      void conferirTabela(entrada,true)
    }
  },[aba,aberto,catalogoAberto,dados.entradas.length,dados.somenteLeitura])

  async function mapearCatalogo(e:Entrada){
    if(reprocessando)return
    setReprocessando(e.id);setErro('')
    try{
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({acao:'mapear_catalogo',entrada_id:e.id})})
      setMensagem(j.mensagem||'Páginas do catálogo preparadas para gerar as imagens.')
      await carregar()
      return j
    }catch(err:any){setErro(err?.message||'Erro ao preparar imagens do catálogo.');throw err}
    finally{setReprocessando(null)}
  }

  async function salvarImagemCatalogo(candidato:Candidato,imagem:string){
    if(dados.somenteLeitura){
      const {data:{session}}=await supabase.auth.getSession()
      const uid=session?.user?.id
      if(!uid)throw new Error('Sessão expirada; entre novamente para testar a confirmação.')
      try{
        salvarImagemCatalogoPreview(window.localStorage,uid,candidato.id,String(candidato.dados?.codigo||''),imagem)
      }catch(e:any){throw new Error('Não foi possível manter o desenho neste navegador: '+(e?.message||'armazenamento indisponível'))}
      const simulado={...candidato,dados:{...candidato.dados,imagem_item_url:imagem,imagem_preview_local:true}}
      const edicaoAtual=edicoes[candidato.id]?.dados
      const haAlteracaoNaoSalva=Boolean(edicaoAtual && JSON.stringify(edicaoAtual)!==JSON.stringify(candidato.dados))
      const conferenciaConcluida=conferidoSomenteNaPrevia(simulado)&&!haAlteracaoNaoSalva
      setDados(prev=>({...prev,candidatos:prev.candidatos.map(c=>c.id===candidato.id
        ?{...c,dados:{...c.dados,imagem_item_url:imagem,imagem_preview_local:true}}:c)}))
      if(conferenciaConcluida){
        setAberto(v=>v===candidato.id?null:v)
        setMostrarConferidosPreview(false)
      }
      setMensagem(conferenciaConcluida
        ?'Produto '+String(candidato.dados?.codigo||'')+' retirado da fila DE TESTE: desenho, peso e medidas conferidos. Veja em "Conferidos nesta prévia". Não foi homologado no Atlas oficial.'
        :'Desenho preservado neste navegador de teste. O item continua pendente até ter todas as informações técnicas confirmadas. Nenhum cadastro oficial foi alterado.')
      return {demo:true,imagem_url:imagem}
    }
    const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({
      id:candidato.id,acao:'salvar_imagem_catalogo',imagem,
    })})
    if(!j?.candidato?.dados?.imagem_confirmada || !j?.candidato?.dados?.imagem_item_url){
      throw new Error('A confirmação não foi retornada pelo servidor. Atualize antes de tentar novamente.')
    }
    // Confirmar desenho só aprova automaticamente um produto pendente com a
    // tabela completa e sem conflito. Do contrário, mantém a etapa Validar.
    const dadosComImagem={...candidato.dados,...j.candidato.dados}
    const atualizado={...candidato,...j.candidato,dados:dadosComImagem}
    setDados(prev=>({...prev,candidatos:prev.candidatos.map(c=>c.id===candidato.id?atualizado:c)}))
    const camposEditados=edicoes[candidato.id]?.dados
    const edicaoNaoSalva=Boolean(camposEditados&&JSON.stringify(camposEditados)!==JSON.stringify(candidato.dados))
    const temPendencia=Boolean(candidato.acao_sugerida==='revisar_ambiguidade'
      || candidato.acao_sugerida==='revisar_conflito'
      || !candidato.codigo_verificavel||candidato.codigo_ambiguo)
    const pronto=conferidoSomenteNaPrevia({...atualizado,dados:{...dadosComImagem,imagem_preview_local:true}})
      &&candidato.pode_validar&&!edicaoNaoSalva&&!temPendencia
    if(pronto){
      try{
        const aprovado=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({
          id:candidato.id,acao:'aprovar',titulo:atualizado.titulo,
          modulo:atualizado.modulo,dados:dadosComImagem,
          observacao:'Desenho e dados técnicos conferidos individualmente no catálogo oficial.',
        })})
        if(aprovado?.candidato?.status!=='aplicado')throw new Error('Aprovação ainda não foi concluída.')
        setAberto(v=>v===candidato.id?null:v)
        setMensagem('Produto '+String(dadosComImagem.codigo||'')+' validado e retirado da fila. Imagem, peso e medidas gravados no Atlas; disponível no catálogo e histórico.')
        await carregar()
        return {...j,aprovado:true}
      }catch(e:any){
        // A foto JÁ foi confirmada e permanece salva; nunca apagá-la por falha de aprovação.
        setMensagem('Imagem confirmada e salva. A validação completa não foi concluída: '+String(e?.message||'revise os dados')+'. O item continuará na fila para conferência.')
        return {...j,aprovado:false}
      }
    }
    setMensagem('Desenho confirmado e salvo para o código '+String(candidato.dados?.codigo||'')+'. O cadastro continua pendente até concluir a validação dos dados.')
    return j
  }

  async function acao(c:Candidato,acao:'corrigir'|'aprovar'|'rejeitar'){
    if(salvando)return
    setSalvando(c.id);setErro('');setMensagem('')
    try{
      const e=edicoes[c.id]||{titulo:c.titulo,modulo:c.modulo||'',dados:c.dados||{},observacao:''}
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({
        id:c.id,acao,titulo:e.titulo,modulo:e.modulo,dados:e.dados,observacao:e.observacao,
      })})
      setMensagem(j.mensagem||(acao==='rejeitar'?'Item rejeitado.':acao==='corrigir'?'Correção salva.':'Item aprovado.'))
      await carregar()
      if(acao!=='corrigir')setAberto(null)
    }catch(e:any){setErro(e?.message||'Erro ao validar item.')}
    finally{setSalvando(null)}
  }

  async function salvarItemCatalogo(candidato:Candidato,dados:Record<string,any>){
    if(salvando)return
    setSalvando(candidato.id);setErro('');setMensagem('')
    try{
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({
        id:candidato.id,acao:'editar_item_catalogo',dados,
      })})
      setMensagem(j.mensagem||'Item atualizado.')
      await carregar()
    }catch(e:any){setErro(e?.message||'Erro ao atualizar item.');throw e}
    finally{setSalvando(null)}
  }

  const filaSelecionada=dados.somenteLeitura&&mostrarConferidosPreview ?conferidosPreview:pendentes
  const pendentesVisiveis=entradaValidacaoFiltro
    ? filaSelecionada.filter(c=>c.entrada_id===entradaValidacaoFiltro)
    : filaSelecionada
  const entradaFiltrada=entradaValidacaoFiltro?entradaDo(entradaValidacaoFiltro):null

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#182444] text-white"><Sparkles size={20}/></div>
          <div>
            <h1 className="font-semibold">Central de Aprendizado</h1>
            <p className="text-xs text-slate-500">Catálogos e tabelas entram automaticamente; somente exceções, regras e conhecimento operacional precisam de validação.</p>
          </div>
        </div>
        <button onClick={()=>void carregar()} disabled={carregando} className="rounded-xl border bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <RefreshCcw size={17} className={carregando?'animate-spin':''}/>
        </button>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-4 py-6">
      {dados.somenteLeitura&&<p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Prévia de homologação: nenhum cadastro real será alterado.</b> Você pode conferir o desenho e simular sua confirmação: a imagem fica guardada somente neste navegador de testes, mesmo após recarregar a página. Quando desenho, peso e medidas estiverem conferidos, o item sai apenas da fila de teste e fica em “Conferidos nesta prévia”. A validação oficial de produtos, a reanálise e outras gravações permanecem bloqueadas.</p>}
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <button onClick={()=>{setEntradaValidacaoFiltro(null);setMostrarConferidosPreview(false);setAba('validacoes')}} className="rounded-2xl border bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/40"><div className="flex items-center gap-2 text-amber-700"><ShieldCheck size={18}/><b>{pendentes.length}</b></div><p className="mt-1 text-xs text-slate-500">Itens aguardando validação · clique para revisar</p></button>
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18}/><b>{dados.totais.aplicados}</b></div><p className="mt-1 text-xs text-slate-500">Itens já aprovados e aplicados</p></div>
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-slate-700"><History size={18}/><b>{dados.entradas.length}</b></div><p className="mt-1 text-xs text-slate-500">Materiais/conversas no histórico</p></div>
      </div>

      <div className="mb-5 flex gap-2 rounded-2xl border bg-white p-2">
        <button onClick={()=>setAba('entrada')} className={'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold '+(aba==='entrada'?'bg-[#182444] text-white':'text-slate-600 hover:bg-slate-50')}>Entrada geral</button>
        <button onClick={()=>{setEntradaValidacaoFiltro(null);setMostrarConferidosPreview(false);setAba('validacoes')}} className={'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold '+(aba==='validacoes'?'bg-[#182444] text-white':'text-slate-600 hover:bg-slate-50')}>Validações {pendentes.length>0?'('+pendentes.length+')':''}</button>
      </div>

      {erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}

      {aba==='entrada' ? <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Upload size={19}/><h2 className="font-semibold">Mandar para o Atlas aprender</h2></div>
          <p className="mb-4 text-sm leading-6 text-slate-500">Pode mandar catálogo, tabela, curso, apostila, foto ou simplesmente escrever uma regra. A IA organiza; ninguém precisa escolher o setor antes.</p>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo</label>
          <select value={tipo} onChange={e=>setTipo(e.target.value)} className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm">
            {TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título opcional" className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm"/>
          <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={7} placeholder="Explique o que é esse material ou escreva a regra aqui..." className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"/>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf,text/plain,text/csv,application/json,.xls,.xlsx" onChange={e=>{const f=e.target.files?.[0]||null;e.target.value='';if(f&&f.size>MAX){setErro('Arquivo maior que 50 MB.');return}setArquivo(f)}}/>
          <button onClick={()=>fileRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <FileText size={17}/>{arquivo?arquivo.name:'Escolher arquivo (até 50 MB)'}
          </button>
          {arquivo&&<button onClick={()=>setArquivo(null)} className="mt-2 w-full text-xs font-semibold text-slate-400">Remover arquivo</button>}
          <button onClick={()=>void enviar()} disabled={enviando||(!descricao.trim()&&!arquivo)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#182444] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            {enviando?<Loader2 size={17} className="animate-spin"/>:<Sparkles size={17}/>}
            {enviando?'Lendo, classificando e comparando...':'Analisar e processar'}
          </button>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <b className="text-slate-700">Regra:</b> catálogo e tabela oficial de fornecedor entram por validação de exceção: o Atlas cadastra/vincula o que estiver claro e manda para validação somente divergências. Fórmulas, processos, fotos técnicas e regras internas continuam exigindo validação humana.
          </div>
        </aside>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2"><History size={18}/><h2 className="font-semibold">{mostrarHistorico?'Histórico completo':'Materiais pendentes'}</h2>
            <button onClick={()=>setMostrarHistorico(v=>!v)} className="rounded-lg border bg-white px-3 py-2 text-xs">{mostrarHistorico?'Mostrar só pendentes':'Ver concluídos e arquivados'}</button>
          </div>
          {carregando?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando...</div>
          :historico.length===0?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Nenhum material nesta lista. Consulte o histórico completo para ver concluídos e arquivados.</div>
          :<div className="space-y-3">{historico.map(e=><article key={e.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold '+statusClasse(e.status)}>{e.status.replaceAll('_',' ')}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{e.tipo.replaceAll('_',' ')}</span>
                  {(e.setores_sugeridos||[]).map(s=><span key={s} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{LABELS[s]||s}</span>)}
                </div>
                <h3 className="font-semibold">{e.titulo}</h3>
                {e.resumo_ia&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{e.resumo_ia}</p>}
                {e.fornecedor_nome_sugerido&&<div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-600"><Building2 size={13}/>{e.fornecedor_nome_sugerido}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={Boolean(arquivando)||e.status==='analisando'||Boolean(reprocessando)} onClick={()=>void arquivarEntrada(e)} className="rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">{arquivando===e.id?'Salvando...':e.metadados?.arquivado_em?'Restaurar material':'Cancelar revisão / Arquivar material'}</button>
                  {e.metadados?.arquivado_em&&<span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">Arquivado — preservado no histórico</span>}
                  {e.fonte_url&&<a href={e.fonte_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700"><ExternalLink size={12}/>Abrir fonte</a>}
                  {pendentes.some(c=>c.entrada_id===e.id)&&!e.metadados?.arquivado_em&&<button onClick={()=>abrirValidacaoEntrada(e.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"><ShieldCheck size={13}/>Revisar agora ({pendentes.filter(c=>c.entrada_id===e.id).length})</button>}
                  {['catalogo','tabela_preco'].includes(e.tipo)&&<button onClick={()=>{setCatalogoAberto(v=>v===e.id?null:e.id);setItemCatalogoAberto(null);setBuscaCatalogo('')}} className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"><PackageSearch size={13}/>Ver itens ({dados.candidatos.filter(c=>c.entrada_id===e.id&&c.tipo==='produto').length})</button>}
                  {!e.metadados?.arquivado_em&&e.mime_type==='application/pdf'&&['catalogo','tabela_preco'].includes(e.tipo)&&<button disabled={Boolean(conferindoTabela)} onClick={()=>void conferirTabela(e)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-50"><RefreshCcw size={13} className={conferindoTabela===e.id?'animate-spin':''}/>{conferindoTabela===e.id?'Conferindo tabela...':'Conferir códigos, pesos e medidas no PDF'}</button>}
                  {!e.metadados?.arquivado_em&&['catalogo','tabela_preco'].includes(e.tipo)&&<button disabled={Boolean(reprocessando)} onClick={()=>void reprocessarEntrada(e)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"><RefreshCcw size={13} className={reprocessando===e.id?'animate-spin':''}/>{reprocessando===e.id?'Reprocessando...':'Reanalisar com regras atuais'}</button>}
                </div>
                {e.erro&&<div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">{String(e.erro).includes('uq_produtos_codigo_upper')?'Uma tentativa anterior encontrou um código já existente. O catálogo foi lido; agora o Atlas reconcilia o código existente em vez de criar duplicado.':e.erro}</div>}
              </div>
              <div className="shrink-0 text-right text-[11px] text-slate-400"><div>{e.criado_por_nome||'Usuário'}</div><div>{dataBr(e.created_at)}</div></div>
            </div>
            {catalogoAberto===e.id&&conferindoTabela===e.id&&<p className="mt-3 text-xs font-semibold text-blue-700"><Loader2 className="mr-1 inline animate-spin" size={13}/>Carregando automaticamente os dados das tabelas do PDF original, sem alterar cadastros...</p>}
            {catalogoAberto===e.id&&consultaPdfDiagnostico[e.id]&&<div className="my-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <b className="text-xs text-blue-900">Leitura corrigida do PDF original: {consultaPdfDiagnostico[e.id].length} códigos identificados</b>
              <p className="mt-1 text-xs text-blue-700">Verificação somente leitura, sem alterar os cadastros aprovados. Pesquise o código abaixo para comparar com o que foi importado anteriormente.</p>
              <p className="mt-2 text-xs font-semibold text-blue-900">Digite o código completo na busca do catálogo para abrir o desenho individual encontrado no PDF.</p>
              {buscaCatalogo.trim()&&consultaPdfDiagnostico[e.id]
                .filter(i=>String(i.codigo||'').toUpperCase()===buscaCatalogo.trim().toUpperCase())
                .slice(0,1).map(i=><div key={i.codigo} className="mt-2 rounded-xl border bg-white p-3">
                  <div className="mb-2 text-xs"><b>{i.codigo}</b> — {i.descricao}
                    <p>Peso: {i.peso_kg_m??'não informado'} kg/m · Página: {i.pagina_catalogo||'a conferir'}</p>
                  </div>
                  {e.fonte_url&&i.pagina_catalogo
                    ?<ImagemPerfilCatalogo fonteUrl={e.fonte_url} pagina={Number(i.pagina_catalogo)}
                      codigo={String(i.codigo)} descricao={String(i.descricao||'')}
                      somenteLeitura={true} apenasVisualizacao={true} onSalvar={async()=>null}/>
                    :<p className="text-xs text-amber-700">Desenho não localizado com segurança. Consulte o PDF original.</p>}
                </div>)}

            </div>}
            {catalogoAberto===e.id&&<CatalogoDetalhes
              entrada={e}
              candidatos={dados.candidatos.filter(c=>c.entrada_id===e.id)}
              busca={buscaCatalogo}
              onBusca={setBuscaCatalogo}
              itemAberto={itemCatalogoAberto}
              onItemAberto={setItemCatalogoAberto}
              onAbrirValidacao={c=>{setEntradaValidacaoFiltro(c.entrada_id);setAba('validacoes');editarInicial(c)}}
              onSalvarItem={salvarItemCatalogo}
              onMapearCatalogo={mapearCatalogo}
              onSalvarImagem={salvarImagemCatalogo}
              onConsultarEquivalencia={api}
              onVinculado={async msg=>{setMensagem(msg);await carregar()}}
              somenteLeitura={Boolean(dados.somenteLeitura)}
              salvandoId={salvando}
              mapeando={reprocessando===e.id}
            />}
          </article>)}</div>}
        </div>
      </div> : <div>
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Fila de exceções.</b> Aqui aparecem somente conflitos, ambiguidades ou informações insuficientes. Após a aprovação oficial, o item sai desta fila sem ser excluído do catálogo nem do histórico.
        </div>
        {dados.somenteLeitura&&<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3 text-sm">
          <div><b>{pendentes.length}</b> pendência(s) para conferir{conferidosPreview.length>0&&<> · <b>{conferidosPreview.length}</b> conferido(s) neste navegador</>}</div>
          <button type="button" onClick={()=>{setMostrarConferidosPreview(v=>!v);setAberto(null)}} className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700">
            {mostrarConferidosPreview?'Voltar às pendências':'Ver conferidos nesta prévia ('+conferidosPreview.length+')'}
          </button>
          <p className="w-full text-xs text-slate-500">A conferência local não é homologação oficial. Os itens só são aprovados no Atlas após validação e gravação no sistema principal.</p>
        </div>}
        <ValidacaoLoteCatalogo
          entradas={dados.entradas}
          candidatos={dados.candidatos}
          entradaAtivaId={entradaValidacaoFiltro}
          somenteLeitura={Boolean(dados.somenteLeitura)}
          api={api}
          onFinalizar={async resumo=>{setMensagem(resumo);setAberto(null);await carregar()}}
        />
        {entradaFiltrada&&<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Revisando este material</p><p className="mt-1 font-semibold text-slate-800">{entradaFiltrada.titulo}</p><p className="mt-1 text-xs text-slate-500">{pendentesVisiveis.length} item(ns) {mostrarConferidosPreview?'conferido(s) somente nesta prévia':'aguardando sua decisão'}.</p></div>
          <button onClick={()=>{setEntradaValidacaoFiltro(null);setAberto(null)}} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Ver todas as validações</button>
        </div>}
        {carregando?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando...</div>
        :pendentesVisiveis.length===0?<div className="rounded-2xl border bg-white p-12 text-center"><BookOpenCheck className="mx-auto mb-3 text-slate-300" size={36}/><b>{mostrarConferidosPreview?'Nenhum produto conferido nesta prévia.':'Nada aguardando validação.'}</b><p className="mt-1 text-sm text-slate-500">{mostrarConferidosPreview?'Confirme um desenho com dados técnicos completos para tirá-lo da fila local.':'Somente exceções que realmente precisam de decisão humana aparecerão aqui.'}</p></div>
        :<div className="space-y-3">{pendentesVisiveis.map(c=>{
          const e=edicoes[c.id]||{titulo:c.titulo,modulo:c.modulo||'',dados:{...(c.dados||{})},observacao:''}
          const origem=entradaDo(c.entrada_id)
          const abertoAgora=aberto===c.id
          const imagemProduto=imagemProdutoCandidato(c)
          const precisaImagem=c.tipo==='produto'&&!imagemProduto
          const precisaCodigo=c.tipo==='produto'&&(!c.codigo_verificavel||c.codigo_ambiguo)
          const precisaPeso=c.tipo==='produto'&&c.dados?.categoria==='perfil'&&!(Number(String(c.dados?.peso_kg_m??'').replace(',','.'))>0)
          const podeAprovar=c.tipo!=='produto'||(!precisaImagem&&!precisaCodigo&&!precisaPeso)
          return <article key={c.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <button onClick={()=>editarInicial(c)} className="w-full p-4 text-left hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold '+statusClasse(c.status)}>{c.status}</span>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{c.tipo}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{labelAcao(c.acao_sugerida)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">confiança {pct(c.confianca)}</span>
                  </div>
                  <h3 className="font-semibold">{c.titulo}</h3>
                  {mostrarConferidosPreview&&<p className="mt-1 text-xs font-semibold text-blue-700">Conferido nesta prévia · ainda pendente de aprovação oficial</p>}
                  {c.tipo==='produto'&&<div className="mt-1 text-xs font-semibold text-slate-700">Código: {String(c.dados?.codigo||'não informado')}</div>}
                  {c.tipo==='produto'&&c.dados?.medidas_mm&&Object.keys(c.dados.medidas_mm).length>0&&<p className="mt-1 text-xs text-slate-600">Medidas: {Object.entries(c.dados.medidas_mm).map(([k,v])=>k+': '+v+' mm').join(' · ')}</p>}
                  {c.tipo==='produto'&&c.dados?.evidencia_tabela&&<p className="mt-1 text-xs text-slate-500">Fonte: {c.dados.evidencia_tabela}</p>}
                  {c.tipo==='produto'&&conferindoTabela===origem?.id&&<p className="mt-1 text-xs font-semibold text-blue-700">Buscando automaticamente nome, peso e medidas da tabela original...</p>}
                  {c.tipo==='produto'&&c.dados?.conferencia_tabela_visualizada&&<p className="mt-1 text-xs font-semibold text-blue-700">Dados conferidos no PDF nesta visualização (não gravados).</p>}
                  {c.tipo==='produto'&&Array.isArray(c.dados?.divergencias_tabela)&&c.dados.divergencias_tabela.length>0&&<p className="mt-1 text-xs text-amber-800">Divergência na tabela: {c.dados.divergencias_tabela.join(', ')}. Valor antigo mantido para revisão.</p>}
                  {c.tipo==='produto'&&precisaCodigo&&<p className="mt-1 text-xs text-amber-700">Código não identificado com segurança; corrija antes de validar.</p>}
                  {c.tipo==='produto'&&precisaImagem&&<p className="mt-1 text-xs text-amber-700">Sem imagem vinculada: confira a foto ou anexe um desenho.</p>}
              {c.tipo==='produto'&&c.dados?.imagem_preview_local&&<p className="mt-1 text-xs font-semibold text-blue-700">Desenho confirmado somente neste navegador de teste. Não homologado no banco.</p>}
                  {c.tipo==='produto'&&c.foto_cadastro&&<p className="mt-1 text-[11px] text-emerald-700">Foto existente encontrada por código exato no Atlas/WVetro</p>}
                  <p className="mt-1 text-xs text-slate-400">Origem: {origem?.titulo||'Material'} · enviado por {origem?.criado_por_nome||'usuário'}</p>
                  {c.deduplicacao?.produto_existente&&<p className="mt-2 text-sm text-emerald-700"><b>Já existe no Atlas:</b> {c.deduplicacao.produto_existente.codigo||''} {c.deduplicacao.produto_existente.nome}</p>}
                  {(c.deduplicacao?.ambiguos||[]).length>0&&<p className="mt-2 text-sm text-amber-700"><b>Atenção:</b> encontrei mais de um possível item parecido. Revise antes de aprovar.</p>}
                  {(c.deduplicacao?.conflitos||[]).length>0&&<div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><b>Divergências encontradas:</b>{(c.deduplicacao.conflitos||[]).map((x:any,i:number)=><div key={i}>{x.campo}: Atlas <b>{String(x.atlas??'—')}</b> × catálogo <b>{String(x.catalogo??'—')}</b></div>)}</div>}
                </div>
                {c.tipo==='produto'&&<div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
                  {imagemProduto?<img src={imagemProduto} alt={String(c.dados?.codigo||'Produto')} className="h-full w-full object-contain"/>
                  :<span className="text-center text-[11px] text-slate-400">Sem imagem</span>}
                </div>}
                {abertoAgora?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
              </div>
            </button>

            {c.pode_validar?<div className="flex flex-wrap items-center gap-2 border-t bg-white px-4 py-3">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Decisão</span>
              {!podeAprovar&&!mostrarConferidosPreview&&<p className="w-full text-xs text-amber-800">Para liberar a validação: {precisaCodigo?'confira e salve o código. ':''}{precisaImagem?'abra Revisar / corrigir e confirme o desenho correto. ':''}{precisaPeso?'informe e salve o peso kg/m.':''}</p>}
              <button disabled={salvando===c.id||!podeAprovar||Boolean(dados.somenteLeitura)} title={dados.somenteLeitura?'Prévia: produto só pode ser homologado na versão oficial':!podeAprovar?'Confirme código, peso e imagem antes de validar':'Validar item'} onClick={()=>void acao(c,'aprovar')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40">{salvando===c.id?<Loader2 size={15} className="animate-spin"/>:<CheckCircle2 size={15}/>}Validar</button>
              <button disabled={salvando===c.id} onClick={()=>editarInicial(c)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"><Eye size={15}/>Revisar / corrigir</button>
              {c.tipo==='produto'&&origem?.mime_type==='application/pdf'&&<button disabled={Boolean(conferindoTabela)} onClick={()=>void conferirTabela(origem)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><RefreshCcw size={15} className={conferindoTabela===origem.id?'animate-spin':''}/>Conferir tabela original</button>}
              <button disabled={salvando===c.id} onClick={()=>void acao(c,'rejeitar')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"><XCircle size={15}/>Não validar</button>
            </div>:<div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-600"><ShieldCheck size={15} className="mr-1 inline"/>Somente Master ou responsável com edição no setor pode validar este aprendizado.</div>}

            {abertoAgora&&<div className="border-t bg-slate-50/60 p-4">
              {c.tipo==='fornecedor'&&<div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Fornecedor" value={e.dados.nome||''} onChange={v=>campo(c.id,'nome',v)}/>
                <Campo label="CNPJ/CPF" value={e.dados.cnpj_cpf||''} onChange={v=>campo(c.id,'cnpj_cpf',v)}/>
                <Campo label="Contato" value={e.dados.contato||''} onChange={v=>campo(c.id,'contato',v)}/>
                <Campo label="Telefone" value={e.dados.telefone||''} onChange={v=>campo(c.id,'telefone',v)}/>
                <Campo label="E-mail" value={e.dados.email||''} onChange={v=>campo(c.id,'email',v)}/>
                <Campo label="Cidade" value={e.dados.cidade||''} onChange={v=>campo(c.id,'cidade',v)}/>
              </div>}
              {c.tipo==='produto'&&<div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <ProdutoImagemValidacao candidato={c} entrada={origem} somenteLeitura={Boolean(dados.somenteLeitura)} onSalvar={imagem=>salvarImagemCatalogo(c,imagem)}/>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Código" value={e.dados.codigo||''} onChange={v=>campo(c.id,'codigo',v)}/>
                  <Campo label="Descrição" value={e.dados.descricao||''} onChange={v=>campo(c.id,'descricao',v)}/>
                  <Campo label="Categoria" value={e.dados.categoria||''} onChange={v=>campo(c.id,'categoria',v)}/>
                  <Campo label="Unidade" value={e.dados.unidade||''} onChange={v=>campo(c.id,'unidade',v)}/>
                  <Campo label="Preço do fornecedor (opcional)" value={e.dados.preco_fornecedor??''} onChange={v=>campo(c.id,'preco_fornecedor',v)}/>
                  <Campo label="Peso kg/m" value={e.dados.peso_kg_m??''} onChange={v=>campo(c.id,'peso_kg_m',v)}/>
                  <Campo label="Barra (mm)" value={e.dados.tamanho_barra_mm??''} onChange={v=>campo(c.id,'tamanho_barra_mm',v)}/>
                  <Campo label="Linha" value={e.dados.linha||''} onChange={v=>campo(c.id,'linha',v)}/>
                  {Object.entries(e.dados.medidas_mm||{}).map(([k,v])=><Campo key={'mm'+k} label={k+' (mm)'} value={String(v??'')} onChange={v=>campo(c.id,'medidas_mm',{...e.dados.medidas_mm,[k]:v})}/>)}
                  {Object.entries(e.dados.medidas_polegadas||{}).map(([k,v])=><Campo key={'pol'+k} label={k+' (polegadas)'} value={String(v??'')} onChange={v=>campo(c.id,'medidas_polegadas',{...e.dados.medidas_polegadas,[k]:v})}/>)}

                  <div className="sm:col-span-2"><Campo label="Aplicação / onde é usado" value={e.dados.aplicacao||''} onChange={v=>campo(c.id,'aplicacao',v)}/></div>
                </div>
              </div>}
              {c.tipo==='conhecimento'&&<div className="space-y-3">
                <Campo label="Título" value={e.titulo} onChange={v=>meta(c.id,'titulo',v)}/>
                <label className="block text-xs font-semibold text-slate-600">Setor
                  <select value={e.modulo} onChange={x=>meta(c.id,'modulo',x.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="">Definir setor...</option>{MODULOS.map(m=><option key={m} value={m}>{LABELS[m]||m}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">Conteúdo que virará conhecimento oficial
                  <textarea value={e.dados.conteudo||''} onChange={x=>campo(c.id,'conteudo',x.target.value)} rows={9} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
                </label>
              </div>}

              <label className="mt-3 block text-xs font-semibold text-slate-600">Observação da validação
                <textarea value={e.observacao} onChange={x=>meta(c.id,'observacao',x.target.value)} rows={2} placeholder="Ex.: corrigi a aplicação; esse perfil é travessa da porta de correr." className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
              </label>

              {c.pode_validar&&<div className="mt-4 flex flex-wrap items-center gap-2">
                <button disabled={salvando===c.id} onClick={()=>void acao(c,'corrigir')} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"><Save size={15}/>Salvar correção</button>
                <span className="text-xs text-slate-500">Depois de revisar, use Validar ou Não validar na barra de decisão do item.</span>
              </div>}
            </div>}
          </article>
        })}</div>}
      </div>}
    </section>
  </main>
}


function CatalogoDetalhes({entrada,candidatos,busca,onBusca,itemAberto,onItemAberto,onAbrirValidacao,onSalvarItem,onMapearCatalogo,onSalvarImagem,onConsultarEquivalencia,onVinculado,somenteLeitura,salvandoId,mapeando}:{
  entrada:Entrada
  candidatos:Candidato[]
  busca:string
  onBusca:(v:string)=>void
  itemAberto:string|null
  onItemAberto:(v:string|null)=>void
  onAbrirValidacao:(c:Candidato)=>void
  onSalvarItem:(c:Candidato,dados:Record<string,any>)=>Promise<void>
  onMapearCatalogo:(e:Entrada)=>Promise<any>
  onSalvarImagem:(c:Candidato,imagem:string)=>Promise<any>
  onConsultarEquivalencia:(url:string,init?:RequestInit)=>Promise<any>
  onVinculado:(msg:string)=>Promise<void>
  somenteLeitura:boolean
  salvandoId:string|null
  mapeando:boolean
}){
  const [filtro,setFiltro]=useState<'todos'|'aplicados'|'validacao'|'sem_preco'|'sem_imagem'>('todos')
  const [edicoesItem,setEdicoesItem]=useState<Record<string,Record<string,any>>>({})
  const produtos=candidatos.filter(c=>c.tipo==='produto')
  const semPagina=produtos.filter(c=>!Number(c.dados?.pagina_catalogo||0)).length
  const aplicados=produtos.filter(c=>c.status==='aplicado')
  const pendentes=produtos.filter(c=>['pendente','corrigido','aprovado'].includes(c.status)&&c.acao_sugerida!=='aguardar_fornecedor')
  const semPreco=produtos.filter(c=>c.dados?.preco_fornecedor==null||Number(c.dados?.preco_fornecedor)===0)
  // Imagem do produto só conta quando está associada à referência individual.
  const semImagem=produtos.filter(c=>!imagemProdutoCandidato(c))
  const idsSemImagem=new Set(semImagem.map(c=>c.id))
  const idsAplicados=new Set(aplicados.map(c=>c.id))
  const idsPendentes=new Set(pendentes.map(c=>c.id))
  const idsSemPreco=new Set(semPreco.map(c=>c.id))
  const q=busca.trim().toLocaleLowerCase('pt-BR')
  const filtrados=produtos.filter(c=>{
    const bateBusca=!q||[c.dados?.codigo,c.dados?.descricao,c.titulo,c.dados?.linha].join(' ').toLocaleLowerCase('pt-BR').includes(q)
    if(!bateBusca)return false
    if(filtro==='aplicados')return idsAplicados.has(c.id)
    if(filtro==='validacao')return idsPendentes.has(c.id)
    if(filtro==='sem_preco')return idsSemPreco.has(c.id)
    if(filtro==='sem_imagem')return idsSemImagem.has(c.id)
    return true
  })

  function alterarItem(candidato:Candidato,chave:string,valor:any){
    setEdicoesItem(prev=>({
      ...prev,
      [candidato.id]:{...(prev[candidato.id]||candidato.dados||{}),[chave]:valor},
    }))
  }
  async function salvarEdicao(candidato:Candidato){
    const dados=edicoesItem[candidato.id]||candidato.dados||{}
    await onSalvarItem(candidato,dados)
    setEdicoesItem(prev=>{const n={...prev};delete n[candidato.id];return n})
  }

  function baixarSemPreco(){
    const esc=(v:any)=>'"'+String(v??'').replaceAll('"','""')+'"'
    const linhas=[['codigo','descricao','categoria','unidade','linha','preco_fornecedor'],...semPreco.map(c=>[c.dados?.codigo||'',c.dados?.descricao||c.titulo,c.dados?.categoria||'',c.dados?.unidade||'',c.dados?.linha||'',''])]
    const csv='\ufeff'+linhas.map(l=>l.map(esc).join(';')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const a=document.createElement('a');a.href=url;a.download='itens-sem-preco-'+entrada.titulo.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.csv';a.click();URL.revokeObjectURL(url)
  }

  const card=(ativo:boolean)=>'rounded-xl p-3 text-left transition hover:shadow-sm '+(ativo?'ring-2 ring-offset-1':'')
  return <div className="mt-4 border-t pt-4">
    <div className="grid gap-2 sm:grid-cols-5">
      <button type="button" onClick={()=>setFiltro('todos')} className={card(filtro==='todos')+' bg-slate-50 ring-slate-400'}><div className="text-lg font-bold">{produtos.length}</div><div className="text-[11px] text-slate-500">Itens lidos</div></button>
      <button type="button" onClick={()=>setFiltro('aplicados')} className={card(filtro==='aplicados')+' bg-emerald-50 ring-emerald-400'}><div className="text-lg font-bold text-emerald-700">{aplicados.length}</div><div className="text-[11px] text-emerald-700">Aplicados/vinculados</div></button>
      <button type="button" onClick={()=>setFiltro('validacao')} className={card(filtro==='validacao')+' bg-amber-50 ring-amber-400'}><div className="text-lg font-bold text-amber-700">{pendentes.length}</div><div className="text-[11px] text-amber-700">Em validação</div></button>
      <button type="button" onClick={()=>setFiltro('sem_preco')} className={card(filtro==='sem_preco')+' bg-blue-50 ring-blue-400'}><div className="text-lg font-bold text-blue-700">{semPreco.length}</div><div className="text-[11px] text-blue-700">Sem preço</div></button>
      <button type="button" onClick={()=>setFiltro('sem_imagem')} className={card(filtro==='sem_imagem')+' bg-amber-50 ring-amber-400'}><div className="text-lg font-bold text-amber-800">{semImagem.length}</div><div className="text-[11px] text-amber-800">Sem imagem individual</div></button>
    </div>

    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label className="relative flex-1">
        <Search size={15} className="absolute left-3 top-3 text-slate-400"/>
        <input value={busca} onChange={e=>onBusca(e.target.value)} placeholder="Buscar por código, descrição ou linha..." className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm"/>
      </label>
      {semPreco.length>0&&<button onClick={baixarSemPreco} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-800">Baixar lista sem preço ({semPreco.length})</button>}
    </div>
    {semImagem.length>0&&<p className="mt-2 text-[11px] text-amber-700">Existem {semImagem.length} produto(s) sem imagem individual confirmada ou já vinculada ao código. Selecione “Sem imagem individual” para localizar os desenhos faltantes antes de homologar.</p>}
    {semPreco.length>0&&<p className="mt-2 text-[11px] text-slate-500">A lista pode ser enviada ao fornecedor. Depois, a tabela preenchida pode voltar pela Central como “Tabela de preço”; o Atlas reconcilia pelos códigos.</p>}
    {semPagina>0&&<div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><span>{mapeando?'Preparando as páginas do PDF para gerar os desenhos dos perfis...':semPagina+' item(ns) ainda precisam ter a página identificada para gerar a imagem.'}</span><button disabled={mapeando} onClick={()=>void onMapearCatalogo(entrada)} className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{mapeando?'Preparando...':'Preparar imagens'}</button></div>}

    <div className="mt-4 space-y-2">
      {filtrados.length===0?<div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">Nenhum item neste filtro.</div>:filtrados.map(c=>{
        const aberto=itemAberto===c.id
        const pagina=Number(c.dados?.pagina_catalogo||0)
        const fontePagina=entrada.fonte_url?(entrada.fonte_url+(pagina?'#page='+pagina+'&zoom=page-width':'')):null
        const imagemItem=imagemProdutoCandidato(c)
        const precisaValidar=['pendente','corrigido','aprovado'].includes(c.status)&&c.acao_sugerida!=='aguardar_fornecedor'
        const edit=edicoesItem[c.id]||c.dados||{}
        const podeEditar=Boolean(c.pode_validar)
        return <div key={c.id} className="overflow-hidden rounded-xl border bg-white">
          <button onClick={()=>onItemAberto(aberto?null:c.id)} className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-slate-50">
            <div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
              {imagemItem?<img src={imagemItem} alt={String(c.dados?.codigo||'Produto')} className="h-full w-full object-contain"/>:<span className="text-center text-[10px] text-slate-400">Sem imagem</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold "+statusClasse(c.status)}>{c.status}</span>
                {c.dados?.categoria&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{c.dados.categoria}</span>}
                {pagina>0&&<span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">pág. {pagina}</span>}
                <span className="text-[10px] text-slate-400">confiança {pct(c.confianca)}</span>
              </div>
              <div className="mt-1 font-semibold">{c.dados?.codigo||'Sem código'} <span className="font-normal text-slate-500">— {c.dados?.descricao||c.titulo}</span></div>
              {codigoColadoDeOutrasColunas(c.dados?.codigo)&&<p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">
                Atenção: códigos de produtos diferentes ficaram unidos nesta importação. Não valide este item. Consulte o PDF original e reanalise o catálogo com o leitor de colunas corrigido; os produtos já aplicados serão preservados.
              </p>}
              <div className="mt-1 text-xs text-slate-400">{c.deduplicacao?.produto_existente?'Vinculado ao produto já existente no Atlas':labelAcao(c.acao_sugerida)}{c.dados?.preco_fornecedor!=null?' · preço '+String(c.dados.preco_fornecedor):' · sem preço'}</div>
              {c.dados?.conferencia_tabela_visualizada&&<div className="mt-1 text-xs text-blue-700">Tabela consultada no PDF (sem salvar). Peso: {c.dados.peso_kg_m??'—'} kg/m · {Object.entries(c.dados.medidas_mm||{}).map(([k,v])=>k+' '+v+' mm').join(' · ')||'sem cotas'}</div>}
              {c.dados?.imagem_preview_local&&<div className="mt-1 text-xs font-semibold text-blue-700">Imagem preservada neste navegador de teste, sem gravar o cadastro.</div>}
            </div>
            {aberto?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
          </button>
          {aberto&&<div className="grid gap-4 border-t bg-slate-50 p-4 lg:grid-cols-[minmax(360px,1fr)_minmax(320px,0.8fr)]">
            <div>
              {podeEditar?<div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Código" value={edit.codigo||''} onChange={v=>alterarItem(c,'codigo',v)}/>
                <Campo label="Descrição" value={edit.descricao||''} onChange={v=>alterarItem(c,'descricao',v)}/>
                <Campo label="Categoria" value={edit.categoria||''} onChange={v=>alterarItem(c,'categoria',v)}/>
                <Campo label="Unidade" value={edit.unidade||''} onChange={v=>alterarItem(c,'unidade',v)}/>
                <Campo label="Linha" value={edit.linha||''} onChange={v=>alterarItem(c,'linha',v)}/>
                <Campo label="Peso kg/m" value={edit.peso_kg_m??''} onChange={v=>alterarItem(c,'peso_kg_m',v)}/>
                <Campo label="Barra (mm)" value={edit.tamanho_barra_mm??''} onChange={v=>alterarItem(c,'tamanho_barra_mm',v)}/>
                <Campo label="Preço fornecedor" value={edit.preco_fornecedor??''} onChange={v=>alterarItem(c,'preco_fornecedor',v)}/>
                {Array.from(new Set(['A','B',...Object.keys(edit.medidas_mm||{}),...Object.keys(edit.medidas_polegadas||{})])).map(chave=><div key={'medida-'+chave} className="rounded-lg border bg-white p-2 space-y-2">
                  <p className="text-xs font-bold text-slate-600">Medida {chave}</p>
                  <Campo label="Milímetros (mm)" value={edit.medidas_mm?.[chave]??''} onChange={v=>alterarItem(c,'medidas_mm',{...(edit.medidas_mm||{}),[chave]:v})}/>
                  <Campo label="Polegadas (pol)" value={edit.medidas_polegadas?.[chave]??''} onChange={v=>alterarItem(c,'medidas_polegadas',{...(edit.medidas_polegadas||{}),[chave]:v})}/>
                </div>)}
                <div className="sm:col-span-2"><Campo label="Aplicação / onde é usado" value={edit.aplicacao||''} onChange={v=>alterarItem(c,'aplicacao',v)}/></div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button disabled={salvandoId===c.id} onClick={()=>void salvarEdicao(c)} className="inline-flex items-center gap-2 rounded-xl bg-[#182444] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{salvandoId===c.id?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}Salvar alterações</button>
                  {precisaValidar&&<button onClick={()=>onAbrirValidacao(c)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">Abrir validação completa</button>}
                </div>
              </div>:<div className="grid gap-2 text-sm">
                {c.dados?.imagem_preview_local&&<p className="text-xs font-semibold text-blue-700">Imagem local de teste: não foi gravada no cadastro oficial.</p>}
                <InfoItem rotulo="Código" valor={c.dados?.codigo}/>
                <InfoItem rotulo="Descrição" valor={c.dados?.descricao}/>
                <InfoItem rotulo="Categoria" valor={c.dados?.categoria}/>
                <InfoItem rotulo="Unidade" valor={c.dados?.unidade}/>
                <InfoItem rotulo="Linha" valor={c.dados?.linha}/>
                <InfoItem rotulo="Peso kg/m" valor={c.dados?.peso_kg_m}/>
                {Object.entries(c.dados?.medidas_mm||{}).map(([chave,valor])=><InfoItem key={'mm-'+chave} rotulo={chave+' (mm)'} valor={valor}/>)}
                {Object.entries(c.dados?.medidas_polegadas||{}).map(([chave,valor])=><InfoItem key={'pol-'+chave} rotulo={chave+' (polegadas)'} valor={valor}/>)}
                <InfoItem rotulo="Barra (mm)" valor={c.dados?.tamanho_barra_mm}/>
                <InfoItem rotulo="Preço fornecedor" valor={c.dados?.preco_fornecedor}/>
              </div>}
              {c.deduplicacao?.produto_existente&&<div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><b>Produto existente:</b> {c.deduplicacao.produto_existente.codigo||''} {c.deduplicacao.produto_existente.nome}</div>}
              {!podeEditar&&<div className="mt-3 rounded-lg border bg-white p-3 text-xs text-slate-500">Somente o Master ou responsável com edição no setor pode alterar este item.</div>}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Eye size={14}/>Imagem do item</div>{fontePagina&&<a href={fontePagina} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-blue-700">Ver evidência no catálogo</a>}</div>
              {imagemItem?<img src={imagemItem} alt={String(c.dados?.descricao||c.dados?.codigo||'Item do catálogo')} className="max-h-[420px] w-full rounded-xl border bg-white object-contain"/>
              :pagina>0&&entrada.fonte_url?<ImagemPerfilCatalogo fonteUrl={entrada.fonte_url} pagina={pagina} codigo={String(c.dados?.codigo||'')} descricao={String(c.dados?.descricao||c.titulo)} somenteLeitura={somenteLeitura} onSalvar={imagem=>onSalvarImagem(c,imagem)}/>
              :<div className="grid min-h-56 place-items-center rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-400"><div>{mapeando?<Loader2 className="mx-auto mb-2 animate-spin" size={22}/>:<Eye className="mx-auto mb-2" size={22}/>}<b className="text-slate-500">{mapeando?'Preparando o catálogo...':'Localizando este perfil no PDF...'}</b><p className="mt-1 text-xs">Assim que a página for identificada, o Atlas gera o recorte do desenho e salva como imagem do produto.</p></div></div>}
            </div>
            {['perfil','acessorio'].includes(String(c.dados?.categoria||''))&&<div className="lg:col-span-2">
              <CompararPerfilCatalogo key={c.id} candidato={c} api={onConsultarEquivalencia}
                somenteLeitura={somenteLeitura} onVinculado={onVinculado}/>
            </div>}
          </div>}
        </div>
      })}
    </div>
  </div>
}

function imagemProdutoCandidato(c:Candidato){
  const direto=String(c.dados?.imagem_item_url||c.dados?.imagem_url||c.dados?.foto_url||'').trim()
  // A imagem oficial do cadastro prevalece sobre recortes antigos não homologados.
  if(c.foto_cadastro)return c.foto_cadastro
  if(direto)return direto
  const existente=c.deduplicacao?.produto_existente||{}
  const doExistente=String(existente.imagem_item_url||existente.imagem_url||existente.foto_url||'').trim()
  // Evita herdar o desenho de um perfil parecido ou de outra referência:
  // o catálogo precisa ter código idêntico ao do produto que fornece a imagem.
  if(doExistente&&mesmaReferenciaCatalogo(c.dados?.codigo,existente.codigo))return doExistente
  // Se o código for diferente ou desconhecido, exigir recorte do PDF original.
  return ''
}

function normalizarCodigoImagem(v:string){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function pareceCodigoImagem(v:string){
  const x=String(v||'').toUpperCase().replace(/\s+/g,'')
  return /^[A-Z]{1,6}\d{0,3}(?:[-_/][A-Z0-9]{2,8}){1,2}$/.test(x)||/^[A-Z]{1,6}\d{2,8}[A-Z]{0,3}$/.test(x)
}

function ProdutoImagemValidacao({candidato,entrada,somenteLeitura,onSalvar}:{candidato:Candidato;entrada?:Entrada|null;somenteLeitura:boolean;onSalvar:(imagem:string)=>Promise<any>}){
  const imagem=imagemProdutoCandidato(candidato)
  const pagina=Number(candidato.dados?.pagina_catalogo||0)
  const fonteUrl=entrada?.fonte_url||''
  const codigo=String(candidato.dados?.codigo||'')
  const descricao=String(candidato.dados?.descricao||candidato.titulo||'Produto')
  const [anexando,setAnexando]=useState(false)
  const [erroAnexo,setErroAnexo]=useState('')
  async function anexarImagem(file:File|null){
    if(!file)return
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>3*1024*1024||file.size===0){
      setErroAnexo('Utilize PNG, JPG ou WebP de até 3 MB.')
      return
    }
    setAnexando(true);setErroAnexo('')
    try{
      const url=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result||''))
        reader.onerror=()=>reject(new Error('Erro ao ler a imagem.'))
        reader.readAsDataURL(file)
      })
      await onSalvar(url)
    }catch(e:any){setErroAnexo(e?.message||'Não foi possível anexar imagem.')}
    finally{setAnexando(false)}
  }

  return <div className="rounded-2xl border bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Eye size={14}/>Imagem para validar</div>
      {fonteUrl&&pagina>0&&<a href={fonteUrl+'#page='+pagina+'&zoom=page-width'} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-blue-700">Abrir catálogo</a>}
    </div>
    <div className="mb-2 text-xs font-semibold text-slate-700">Código {codigo||'não informado'} · {descricao}</div>
    {candidato.foto_cadastro&&<p className="mb-2 text-[11px] font-semibold text-emerald-700">Imagem existente do produto localizado pelo código exato.</p>}
    {candidato.dados?.imagem_preview_local&&<p className="mb-2 text-[11px] font-semibold text-blue-700">Desenho preservado neste navegador de testes, não gravado no banco oficial.</p>}
    {imagem?<img src={imagem} alt={descricao||codigo} className="max-h-72 w-full rounded-xl border bg-white object-contain"/>
    :pagina>0&&fonteUrl?<ImagemPerfilCatalogo fonteUrl={fonteUrl} pagina={pagina} codigo={codigo} descricao={descricao} somenteLeitura={somenteLeitura} onSalvar={onSalvar}/>
    :<div className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-slate-50 p-5 text-center text-sm text-slate-500">
      <div>
        <PackageSearch className="mx-auto mb-2 text-slate-400" size={24}/>
        <b>Sem imagem cadastrada para este código.</b>
        <p className="mt-1 text-xs leading-5">Para validar perfil ou acessório com segurança, envie o catálogo/foto ou gere o recorte do PDF antes de aprovar.</p>
      </div>
    </div>}
    <label className={'mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 '+(anexando?'pointer-events-none opacity-60':'')}>
      <Upload size={15}/>{anexando?'Anexando...':imagem?'Substituir imagem deste candidato':'Anexar foto/desenho deste código'}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={anexando} onChange={e=>{void anexarImagem(e.target.files?.[0]||null);e.target.value=''}}/>
    </label>
    {erroAnexo&&<p className="mt-2 text-xs text-red-700">{erroAnexo}</p>}
  </div>
}

function ImagemPerfilCatalogo({fonteUrl,pagina,codigo,descricao,somenteLeitura,onSalvar,apenasVisualizacao=false}:{fonteUrl:string;pagina:number;codigo:string;descricao:string;somenteLeitura:boolean;onSalvar:(imagem:string)=>Promise<any>;apenasVisualizacao?:boolean}){
  const [imagem,setImagem]=useState('')
  const [erroImagem,setErroImagem]=useState('')
  const [erroSalvarImagem,setErroSalvarImagem]=useState('')
  const [carregandoImagem,setCarregandoImagem]=useState(true)
  const [salvandoImagem,setSalvandoImagem]=useState(false)
  const [codigoEncontrado,setCodigoEncontrado]=useState(false)
  const [imagemConfirmada,setImagemConfirmada]=useState(false)

  useEffect(()=>{
    let cancelado=false
    async function gerar(){
      setCarregandoImagem(true);setErroImagem('');setErroSalvarImagem('');setCodigoEncontrado(false);setImagemConfirmada(false)
      try{
        const pdfModuleUrl='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs'
        const pdfjs:any=await import(/* webpackIgnore: true */ pdfModuleUrl)
        if(!pdfjs.GlobalWorkerOptions.workerSrc)pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs'
        const doc=await pdfjs.getDocument({url:fonteUrl}).promise
        const page=await doc.getPage(pagina)
        const base=page.getViewport({scale:1})
        const scale=Math.max(1.6,Math.min(2.4,1400/Math.max(1,base.width)))
        const viewport=page.getViewport({scale})
        const text=await page.getTextContent()
        const itens=(text.items||[]).filter((i:any)=>i?.str&&i?.transform).map((i:any)=>{
          const t=pdfjs.Util.transform(viewport.transform,i.transform)
          return {str:String(i.str),x:Number(t[4]||0),y:Number(t[5]||0),w:Number(i.width||0)*scale,h:Math.max(10,Number(i.height||0)*scale)}
        })
        const codigoNoTexto=(str:string)=>{
          const m=str.trim().match(/^([A-Z]{1,6}\s*[-_/]?\s*\d{2,8}[A-Z]{0,3})(?=\s|$)/i)
          return m?normalizarCodigoImagem(m[1]):''
        }
        const codigos=itens.map((i:any)=>{const row=itens.filter((j:any)=>Math.abs(j.y-i.y)<2*scale&&j.x>=i.x&&j.x<i.x+100*scale).sort((a:any,b:any)=>a.x-b.x);return {...i,codigo:codigoNoTexto(i.str)||codigoNoTexto(row.slice(0,3).map((j:any)=>j.str).join(''))}}).filter((i:any)=>i.codigo)
        const localizado=localizarCodigoCatalogo(itens,codigo,scale)
        const target=localizado.alvo

        const canvas=document.createElement('canvas')
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
        const ctx=canvas.getContext('2d')
        if(!ctx)throw new Error('Canvas indisponível.')
        await page.render({canvasContext:ctx,viewport}).promise

        let sx=0,sy=0,sw=canvas.width,sh=canvas.height
        if(target){
          const kg=itens.filter((i:any)=>/^kg$/i.test(i.str.trim())&&i.y<target.y&&i.x>target.x).sort((a:any,b:any)=>b.y-a.y)[0]
          const titulos=itens.map((i:any)=>({...i,str:itens.filter((j:any)=>Math.abs(j.y-i.y)<2*scale&&j.x>=i.x&&j.x<i.x+180*scale).sort((a:any,b:any)=>a.x-b.x).map((j:any)=>j.str).join('')})).filter((i:any)=>/^(cantoneiras?|barra chata|tubo (quadrado|retangular|redondo))/i.test(i.str.trim()))
          const titulo=kg? titulos.filter((i:any)=>i.y<kg.y).sort((a:any,b:any)=>b.y-a.y)[0]:null
          if(kg&&titulo&&target.y-kg.y<300*scale){
            // Shared family drawing is left of the table, never a single table row.
            const proximo=titulos.filter((i:any)=>i.y>target.y).sort((a:any,b:any)=>a.y-b.y)[0]
            sx=Math.max(0,Math.floor(titulo.x-18*scale))
            sy=Math.max(0,Math.floor(titulo.y-titulo.h-12*scale))
            sw=Math.min(canvas.width-sx,Math.max(100*scale,target.x-sx-12*scale))
            sh=Math.min(canvas.height-sy,(proximo?proximo.y-proximo.h-12*scale:canvas.height-30*scale)-sy)
          }else{
            // PDF de cartões: peso imediatamente abaixo do código, desenho e
            // cotas logo em seguida. Evita engolir toda a parte inferior da página.
            // Para perfis sem esse layout, conserva o recorte já homologado.
            const cartao=limitesRecorteCartao(itens,target,scale,canvas.width,canvas.height)
            if(cartao){
              ;({sx,sy,sw,sh}=cartao)
            }else{
              const colunas=codigos.filter((i:any)=>Math.abs(i.y-target.y)<24*scale).sort((a:any,b:any)=>a.x-b.x)
              const proximo=colunas.find((i:any)=>i.x>target.x+30*scale)
              const abaixo=codigos.filter((i:any)=>i.y>target.y+30*scale&&Math.abs(i.x-target.x)<80*scale).sort((a:any,b:any)=>a.y-b.y)[0]
              sx=Math.max(0,Math.floor(target.x-18*scale))
              sy=Math.max(0,Math.floor(target.y-target.h-12*scale))
              sw=Math.min(canvas.width-sx,(proximo?proximo.x-18*scale:canvas.width-25*scale)-sx)
              sh=Math.min(canvas.height-sy,(abaixo?abaixo.y-abaixo.h-12*scale:canvas.height-25*scale)-sy)
            }
          }
        }else{
          throw new Error('O código não foi localizado de forma única nesta página. Abra a fonte e anexe o desenho correto.')
        }
        if(sw<=0||sh<=0)throw new Error('Não foi possível delimitar o desenho com segurança.')

        const limite=900
        const fator=Math.min(1,limite/sw)
        const out=document.createElement('canvas')
        out.width=Math.max(1,Math.round(sw*fator));out.height=Math.max(1,Math.round(sh*fator))
        const octx=out.getContext('2d')
        if(!octx)throw new Error('Canvas de recorte indisponível.')
        octx.fillStyle='#fff';octx.fillRect(0,0,out.width,out.height)
        octx.drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height)
        const data=out.toDataURL('image/jpeg',0.9)
        if(cancelado)return
        setImagem(data);setCodigoEncontrado(localizado.ocorrencias===1&&Boolean(target));setCarregandoImagem(false)
        try{await doc.destroy()}catch{}
      }catch(e:any){
        if(cancelado)return
        setErroImagem(e?.message||'Não foi possível gerar o recorte deste perfil.')
        setCarregandoImagem(false)
      }
    }
    void gerar()
    return()=>{cancelado=true}
  },[fonteUrl,pagina,codigo])

  if(carregandoImagem)return <div className="grid min-h-56 place-items-center rounded-xl border bg-white p-6 text-center text-sm text-slate-500"><div><Loader2 className="mx-auto mb-2 animate-spin" size={24}/><b>Gerando desenho do perfil...</b><p className="mt-1 text-xs text-slate-400">Página {pagina} · código {codigo}</p></div></div>
  if(erroImagem)return <div className="grid min-h-56 place-items-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800"><div><Eye className="mx-auto mb-2" size={22}/><b>Não consegui recortar automaticamente.</b><p className="mt-1 text-xs">{erroImagem}</p><a href={fonteUrl+'#page='+pagina} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-blue-700">Abrir página {pagina}</a></div></div>
  return <div className="space-y-2">
    <img src={imagem} alt={'Prévia do catálogo para '+(codigo||descricao)} className="max-h-[420px] w-full rounded-xl border bg-white object-contain"/>
    {apenasVisualizacao
      ?<p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800">Visualização do PDF original. Para confirmar e salvar este desenho, abra a validação individual do produto.</p>
      :!codigoEncontrado
      ?<p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Código não localizado de forma única no texto do PDF. O recorte não será vinculado automaticamente.</p>
      :imagemConfirmada
        ?<p className={'rounded-lg p-2 text-xs font-semibold '+(somenteLeitura?'border border-blue-200 bg-blue-50 text-blue-800':'bg-emerald-50 text-emerald-800')}>{somenteLeitura?'Desenho do código '+codigo+' guardado somente neste navegador de testes.':'Imagem do código '+codigo+' confirmada e vinculada.'}</p>
        :<button type="button" disabled={salvandoImagem} onClick={async()=>{
          setSalvandoImagem(true);setErroSalvarImagem('')
          try{await onSalvar(imagem);setImagemConfirmada(true)}
          catch(e:any){setErroSalvarImagem(e?.message||'Falha ao salvar a imagem. O desenho continua disponível para tentar novamente.')}
          finally{setSalvandoImagem(false)}
        }} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">
          {salvandoImagem?'Confirmando...':somenteLeitura?'Confirmar desenho (teste local)':'Confirmar: este desenho corresponde ao código '+codigo}
        </button>}
    {somenteLeitura&&!apenasVisualizacao&&<p className="text-xs text-blue-700">Prévia segura: a confirmação fica somente neste navegador, não no banco do Atlas.</p>}
    {erroSalvarImagem&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Não foi possível salvar a confirmação: {erroSalvarImagem}. O desenho foi mantido na tela.</p>}
  </div>
}

function InfoItem({rotulo,valor}:{rotulo:string;valor:any}){
  return <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-slate-100 pb-1.5"><span className="text-xs text-slate-400">{rotulo}</span><span className="break-words text-xs font-medium text-slate-700">{valor==null||valor===''?'—':String(valor)}</span></div>
}

function Campo({label,value,onChange}:{label:string;value:any;onChange:(v:string)=>void}){
  return <label className="block text-xs font-semibold text-slate-600">{label}
    <input value={value??''} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
  </label>
}
