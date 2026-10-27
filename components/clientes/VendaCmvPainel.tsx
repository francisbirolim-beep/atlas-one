'use client'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario } from '@/lib/setores'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { custoPrevistoOriginal, custoRevisado, revisaoAtual, revisaoPerfilSobrepoePerda, type CategoriaCmvRevisao, type RevisaoCmv } from '@/lib/vendaCmvRevisao'
import { compararPesosCmv } from '@/lib/vendaCmvPesos'
import {UNIDADES_CMV,unidadePadraoCmv,rotuloUnidadeCmv,mostrarQuantidadeCmv} from '@/lib/vendaCmvUnidades'
import { separarEtapasCmv } from '@/lib/vendaCmvEtapas'
import VendaCmvRecebimentos, { type RecebimentoCmv, type HistoricoRecebimento } from '@/components/clientes/VendaCmvRecebimentos'
import FornecedorCmvCampo from '@/components/clientes/FornecedorCmvCampo'
type Categoria='perfil'|'acessorio'|'vidro'|'perda'|'mao_obra'|'instalacao'|'frete'|'outros'
type Previsao={categorias:{perfil:number|null;acessorio:number|null;vidro:number|null;sobra:number|null;perda:number|null};total:number|null;fonte:string;aviso:string|null;perfil_previsao?:number|null;perfil_previsao_fonte?:'despesas_extras_wvetro'|'uso_mais_sobra_wvetro'|null;total_uso?:number|null;total_com_sobra?:number|null;perfil_centro_custo?:number|null;perda_fonte?:'wvetro'|'conciliacao_wvetro'|null}
type Lancamento={id:string;categoria:Categoria;origem:string;etapa_cmv?:'comprado'|'recebido';descricao:string;valor:number;data_lancamento:string;fornecedor?:string|null;documento?:string|null;quantidade?:number|null;unidade?:string|null;observacoes?:string|null;anexo_nome?:string|null;anexo_url?:string|null;criado_por_id?:string|null;criado_por_nome?:string|null;versao?:number;atualizado_em?:string|null;atualizado_por_nome?:string|null;cancelado_em?:string|null;cancelado_por_nome?:string|null;motivo_cancelamento?:string|null}
type HistoricoLancamento={id:string;lancamento_id:string;antes:Record<string,any>;depois:Record<string,any>;alterado_por_nome?:string|null;alterado_em:string;anexo_anterior_url?:string|null}
type Dados={numeroWvetro:string;previsto:Previsao;lancamentos:Lancamento[];excluidos?:Lancamento[];historicoLancamentos?:HistoricoLancamento[];revisoes:Partial<Record<CategoriaCmvRevisao,RevisaoCmv>>;historicoRevisoes:RevisaoCmv[];feedbackIA:number;etapasDisponiveis?:boolean;vendaValorAtual?:number|null;vendaValorWvetro?:number|null;historicoValorVenda?:Array<{anterior:number;novo:number;acao:string;usuario:string;em:string;justificativa:string}>}

const labels:Record<Categoria,string>={perfil:'Perfis',acessorio:'Acessórios',vidro:'Vidros',perda:'Perda de corte',mao_obra:'Mão de obra',instalacao:'Instalação',frete:'Frete',outros:'Outros'}
const moedas=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const quilos=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:3})+' kg'
const variacaoPeso=(n:number)=>((n>0?'+':'')+n.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%')
const previstoFmt=(n:number|null)=>n===null?'Aguardando W.Vetro':moedas(n)
const categories=Object.keys(labels) as Categoria[]
const dataLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function Card({titulo,valor,detalhe,nota}:{titulo:string;valor:string;detalhe?:string;nota?:string}){
 return <div className="rounded-xl border bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</div><div className="mt-1 text-xl font-bold text-slate-900">{valor}</div>{detalhe&&<div className="mt-2 text-sm font-semibold text-slate-800">{detalhe}</div>}{nota&&<p className="mt-1 text-xs text-slate-500">{nota}</p>}</div>
}
type RecebimentoVendaResumo={id:string;valor?:number|null;data_recebimento?:string|null;forma?:string|null;status?:string|null}
export default function VendaCmvPainel({vendaId,comprasExistentes,onMudanca,onVendaAtualizada,abrirEdicaoVenda,onEdicaoVendaAberta,recebimentosRegistrados=[],totalPago=0,valorTitulos=0,numeroTitulos=0,onRegistrarRecebimento}:{vendaId:string;comprasExistentes:Partial<Record<Categoria,number>>;onMudanca?:(total:number,previstoRevisado:number|null)=>void;onVendaAtualizada?:()=>void;abrirEdicaoVenda?:boolean;onEdicaoVendaAberta?:()=>void;recebimentosRegistrados?:RecebimentoVendaResumo[];totalPago?:number;valorTitulos?:number;numeroTitulos?:number;onRegistrarRecebimento?:()=>void}){
 const [dados,setDados]=useState<Dados|null>(null)
 const [recebimentos,setRecebimentos]=useState<RecebimentoCmv[]>([])
 const [historicoRecebimentos,setHistoricoRecebimentos]=useState<HistoricoRecebimento[]>([])
 const [recebimentosDisponiveis,setRecebimentosDisponiveis]=useState(false)
 const [origemNova,setOrigemNova]=useState('compra')
 const [etapaNova,setEtapaNova]=useState<'comprado'|'recebido'>('comprado')
 const [etapaEdicao,setEtapaEdicao]=useState<'comprado'|'recebido'>('comprado')
 const [valorCompra,setValorCompra]=useState('')
 const [pesoCompra,setPesoCompra]=useState('')
 const [unidadeNova,setUnidadeNova]=useState('KG')
 const [categoriaNova,setCategoriaNova]=useState<Categoria>('perfil')
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [aberto,setAberto]=useState<Categoria|null>('perfil')
 const [adicionar,setAdicionar]=useState<'compra'|'adicional'|null>(null)
 const [salvando,setSalvando]=useState(false)
 const enviandoRef=useRef(false)
 const [sucesso,setSucesso]=useState('')
 const [editandoLancamento,setEditandoLancamento]=useState<string|null>(null)
 const [salvandoEdicao,setSalvandoEdicao]=useState(false)
 const [excluindoLancamento,setExcluindoLancamento]=useState<string|null>(null)
 const [motivoExclusao,setMotivoExclusao]=useState('')
 const [salvandoExclusao,setSalvandoExclusao]=useState(false)
 const [restaurandoId,setRestaurandoId]=useState<string|null>(null)
 const enviandoExclusao=useRef(false)
 const enviandoEdicao=useRef(false)
 const [corrigindo,setCorrigindo]=useState<CategoriaCmvRevisao|null>(null)
 const [valorConferido,setValorConferido]=useState('')
 const [justificativa,setJustificativa]=useState('')
 const [salvandoRevisao,setSalvandoRevisao]=useState(false)
 const [podeRevisarVenda,setPodeRevisarVenda]=useState(false)
 const [acessoCmv,setAcessoCmv]=useState<{id:string;master:boolean;podeEditar:boolean;delegacoes:Record<string,boolean>}|null>(null)
 const podeModificarCmv=(registro:{criado_por_id?:string|null},acao:string)=>{
  if(!acessoCmv)return false
  return acessoCmv.master||Boolean(acessoCmv.podeEditar&&(Boolean(registro.criado_por_id&&registro.criado_por_id===acessoCmv.id)||acessoCmv.delegacoes[acao]))
 }
 const [corrigirVenda,setCorrigirVenda]=useState(false)
 const [valorVendaConferido,setValorVendaConferido]=useState('')
 const [motivoVenda,setMotivoVenda]=useState('')
 const [salvandoVenda,setSalvandoVenda]=useState(false)
 const [ajustarParcela,setAjustarParcela]=useState(true)
 const [editandoRecebimento,setEditandoRecebimento]=useState<string|null>(null)
 const [valorPagoCorreto,setValorPagoCorreto]=useState('')
 const [motivoPagamento,setMotivoPagamento]=useState('')
 const [salvandoPagamento,setSalvandoPagamento]=useState(false)
 const [historicoPagamentos,setHistoricoPagamentos]=useState<Array<{id:string;recebimento_id:string;valor_anterior:number;valor_novo:number;justificativa:string;criado_por_nome:string;created_at:string}>>([])
 useEffect(()=>{let ativo=true;void (async()=>{
  try{
   const u=await usuarioAtual()
   if(!u)return
   const master=u.role==='master'
   if(ativo)setPodeRevisarVenda(master)
   if(master){if(ativo)setAcessoCmv({id:u.id,master:true,podeEditar:true,delegacoes:{}});return}
   const [setores,config]=await Promise.all([listarPermissoesUsuario(u.id),lerAcessoUsuarioConfig(u)])
   const nomes=[
    'editar_terceiros','excluir_terceiros','restaurar_terceiros',
    'recebimentos_editar_terceiros','recebimentos_cancelar_terceiros','recebimentos_conferir_terceiros'
   ]
   const podeEditar=setores.financeiro==='edicao' &&
      (config.modulos?.['custos-cmv']===undefined||config.modulos?.['custos-cmv']==='edicao')
   const delegacoes=Object.fromEntries(nomes.map(nome=>[nome,
    podeEditar&&config.acoes?.['financeiro.cmv.'+nome]==='edicao']))
   if(ativo)setAcessoCmv({id:u.id,master:false,podeEditar,delegacoes})
  }catch{if(ativo)setAcessoCmv(null)}
 })();return()=>{ativo=false}},[])
 async function buscar(){
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await resp.json();if(!resp.ok)throw new Error(json.error||'Falha no CMV.')
   setDados(json as Dados)
   onMudanca?.((json.lancamentos as Lancamento[]).filter(l=>l.etapa_cmv!=='recebido').reduce((s,l)=>s+Number(l.valor||0),0),
    json.previsto?custoRevisado(json.previsto,json.revisoes||{},'total'):null)
   // Recebimentos são opcionais no banco até a migração nova ser aprovada.
   // A ausência desta tabela NUNCA impede a leitura do CMV anterior.
   try{
    const rr=await fetch('/api/vendas/cmv/recebimentos?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    if(!rr.ok)throw new Error('Consulta de recebimentos indisponível.')
    const recebidos=await rr.json()
    setRecebimentos((recebidos.recebimentos||[]) as RecebimentoCmv[])
    setHistoricoRecebimentos((recebidos.historico||[]) as HistoricoRecebimento[])
    setRecebimentosDisponiveis(Boolean(recebidos.disponivel))
   }catch{setRecebimentos([]);setHistoricoRecebimentos([]);setRecebimentosDisponiveis(false)}
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar custos.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void buscar()},[vendaId])
 useEffect(()=>{if(numeroTitulos===0)setAjustarParcela(false)},[numeroTitulos])
 useEffect(()=>{
  if(!podeRevisarVenda)return
  let vivo=true
  void (async()=>{try{
   const token=await tokenAtual();if(!token)return
   const r=await fetch('/api/vendas/financeiro/corrigir-recebimento?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(r.ok&&vivo){const j=await r.json();setHistoricoPagamentos(j.historico||[])}
  }catch{/* Histórico opcional: não bloqueia o CMV */}})()
  return()=>{vivo=false}
 },[vendaId,podeRevisarVenda,recebimentosRegistrados.length])
 // Atalho do cartão Valor da venda: reutiliza a conferência auditada existente.
 useEffect(()=>{
  if(!abrirEdicaoVenda||carregando||!dados||!acessoCmv)return
  if(acessoCmv.master){
   setCorrigirVenda(true)
   setValorVendaConferido(String(dados.vendaValorWvetro??dados.vendaValorAtual??'').replace('.',','))
   setMotivoVenda('')
  }
  requestAnimationFrame(()=>document.getElementById('conferencia-valor-venda')?.scrollIntoView({behavior:'smooth',block:'start'}))
  onEdicaoVendaAberta?.()
 },[abrirEdicaoVenda,carregando,dados,acessoCmv,onEdicaoVendaAberta])
 // Uma linha manual pertence a uma ÚNICA etapa. A movimentação não cria
 // segunda linha, não duplica os R$ da obra e mantém o ID e o anexo.
 const etapas=useMemo(()=>separarEtapasCmv(dados?.lancamentos||[]),[dados])
 const comprasManuais=etapas.comprados
 const recebimentosManuais=etapas.recebidos
 const recebimentosConsolidados=useMemo(()=>[
  ...recebimentos,
  ...recebimentosManuais.map(l=>({
   id:l.id,categoria:l.categoria,peso_kg:l.unidade==='KG'?Number(l.quantidade||0):null,
   preco_kg:l.unidade==='KG'&&Number(l.quantidade)>0?Number(l.valor)/Number(l.quantidade):null,
   quantidade:l.quantidade,unidade:l.unidade,
   valor_total:Number(l.valor),fornecedor:l.fornecedor||'',nota_numero:l.documento,
   data_recebimento:l.data_lancamento,versao:l.versao||1
  }))
 ],[recebimentos,recebimentosManuais])
 const realizado=useMemo(()=>Object.values(comprasExistentes).reduce<number>((s,v)=>s+Number(v||0),0)+comprasManuais.reduce((s,l)=>s+Number(l.valor||0),0),[comprasManuais,comprasExistentes])
 const porCategoria=useMemo(()=>Object.fromEntries(categories.map(c=>[c,Number(comprasExistentes[c]||0)+comprasManuais.filter(l=>l.categoria===c).reduce((s,l)=>s+Number(l.valor||0),0)])) as Record<Categoria,number>,[comprasManuais,comprasExistentes])
 const comparativos=useMemo(()=>Object.fromEntries(categories.map(c=>[c,compararPesosCmv(c,comprasManuais,recebimentosConsolidados,porCategoria[c],Number(comprasExistentes[c]||0))])) as Record<Categoria,ReturnType<typeof compararPesosCmv>>,[comprasManuais,recebimentosConsolidados,porCategoria,comprasExistentes])
 const totalRecebido=useMemo(()=>recebimentosConsolidados.reduce((s,r)=>s+Number(r.valor_total||0),0),[recebimentosConsolidados])
 // O resumo geral soma apenas custos em reais, nunca unidades físicas incompatíveis.
 const existeRecebimento=recebimentosConsolidados.length>0
 async function enviar(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(enviandoRef.current)return
  // Capturar o elemento e o arquivo ANTES de qualquer await: o evento React
  // pode perder currentTarget após a primeira suspensão assíncrona.
  const form=e.currentTarget
  const dadosEnvio=new FormData(form)
  dadosEnvio.set('vendaId',vendaId)
  // Nenhum recebimento poderá gravar sem o banco aprovado/habilitado.
  if(etapaNova==='recebido'&&!dados?.etapasDisponiveis){
   setErro('O cadastro de recebidos aguarda habilitação no banco. A compra anterior permanece intacta.')
   return
  }
  enviandoRef.current=true
  setErro('');setSucesso('');setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv',{method:'POST',headers:{Authorization:'Bearer '+token},body:dadosEnvio})
   const json=await resp.json();if(!resp.ok)throw new Error(json.error||'Erro ao salvar custo.')
   form.reset();setAdicionar(null);setEtapaNova('comprado');setValorCompra('');setPesoCompra('');setSucesso('Registro realizado com sucesso.');await buscar()
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao registrar custo.')}
  finally{enviandoRef.current=false;setSalvando(false)}
 }
 async function salvarEdicao(e:FormEvent<HTMLFormElement>,l:Lancamento){
  e.preventDefault();if(enviandoEdicao.current)return
  // Montar FormData antes de qualquer await: evita erro HTMLFormElement.
  const form=e.currentTarget
  const payload=new FormData(form)
  payload.set('vendaId',vendaId)
  payload.set('lancamentoId',l.id)
  payload.set('versao',String(l.versao||1))
  if(etapaEdicao==='recebido'&&!dados?.etapasDisponiveis){
   setErro('A mudança para Recebido aguarda habilitação no banco. O custo original não foi alterado.')
   return
  }
  enviandoEdicao.current=true;setSalvandoEdicao(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/cmv',{method:'PATCH',headers:{Authorization:'Bearer '+token},body:payload})
   const json=await resposta.json()
   if(!resposta.ok)throw new Error(json.error||'Falha ao corrigir lançamento.')
   setEditandoLancamento(null)
   await buscar()
   setSucesso('Correção salva no mesmo lançamento. Histórico atualizado.')
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao editar lançamento.')}
  finally{enviandoEdicao.current=false;setSalvandoEdicao(false)}
 }
 async function excluirLancamento(e:FormEvent<HTMLFormElement>,l:Lancamento){
  e.preventDefault()
  if(enviandoExclusao.current||motivoExclusao.trim().length<5)return
  enviandoExclusao.current=true;setSalvandoExclusao(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/cmv',{method:'DELETE',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json',
   },body:JSON.stringify({vendaId,lancamentoId:l.id,versao:l.versao||1,motivo:motivoExclusao.trim()})})
   const json=await resposta.json()
   if(!resposta.ok)throw new Error(json.error||'Não foi possível excluir o lançamento.')
   setExcluindoLancamento(null);setMotivoExclusao('');setEditandoLancamento(null)
   await buscar()
   setSucesso('Lançamento excluído dos custos realizados. Registro, comprovante e histórico preservados.')
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao excluir lançamento.')}
  finally{enviandoExclusao.current=false;setSalvandoExclusao(false)}
 }
 async function restaurarLancamento(l:Lancamento){
  if(restaurandoId || !window.confirm('Restaurar este lançamento de '+moedas(Number(l.valor))+'? Ele voltará a somar no custo realizado da obra.'))return
  setRestaurandoId(l.id);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/cmv',{method:'PUT',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json',
   },body:JSON.stringify({vendaId,lancamentoId:l.id,versao:l.versao||1})})
   const json=await resposta.json()
   if(!resposta.ok)throw new Error(json.error||'Falha ao restaurar lançamento.')
   await buscar()
   setSucesso('Lançamento restaurado sem duplicação. O histórico de exclusão foi preservado.')
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao restaurar lançamento.')}
  finally{setRestaurandoId(null)}
 }
 async function revisarCusto(categoria:CategoriaCmvRevisao,acao:'validado'|'corrigido'){
  if(salvandoRevisao)return
  setSalvandoRevisao(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv/revisao',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,categoria,acao,valor:valorConferido,justificativa})})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Falha na revisão.')
   setCorrigindo(null);setValorConferido('');setJustificativa('')
   await buscar()
   setSucesso(acao==='validado'?'Custo validado. A IA recebeu o feedback para futuras análises.':'Custo corrigido e registrado no histórico de aprendizado da IA.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar revisão.')}
  finally{setSalvandoRevisao(false)}
 }
 async function revisarVenda(acao:'validado'|'corrigido'){
  if(salvandoVenda||!dados)return
  setSalvandoVenda(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/cmv/revisao-venda',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao,valor:valorVendaConferido,valorAnterior:dados.vendaValorAtual,justificativa:motivoVenda,ajustarParcela:ajustarParcela&&numeroTitulos>0})})
   const json=await resposta.json();if(!resposta.ok)throw new Error(json.error||'Falha ao revisar valor de venda.')
   setCorrigirVenda(false);setMotivoVenda('');setValorVendaConferido('')
   await buscar();onVendaAtualizada?.()
   setSucesso(acao==='validado'?'Valor W.Vetro validado e atualizado na venda, com histórico.':'Valor de venda corrigido com histórico. Confira eventuais parcelas financeiras já emitidas.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar conferência de venda.')}
  finally{setSalvandoVenda(false)}
 }
 async function corrigirPagamento(e:FormEvent<HTMLFormElement>,r:RecebimentoVendaResumo){
  e.preventDefault()
  if(salvandoPagamento)return
  setSalvandoPagamento(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resposta=await fetch('/api/vendas/financeiro/corrigir-recebimento',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,recebimentoId:r.id,valorAnterior:r.valor,valorNovo:valorPagoCorreto,justificativa:motivoPagamento})})
   const json=await resposta.json()
   if(!resposta.ok)throw new Error(json.error||'Falha ao corrigir pagamento.')
   setEditandoRecebimento(null);setValorPagoCorreto('');setMotivoPagamento('')
   setSucesso('Pagamento corrigido e auditado. Consulte o Financeiro atualizado.')
   onVendaAtualizada?.()
  }catch(err){setErro(err instanceof Error?err.message:'Falha ao corrigir pagamento.')}
  finally{setSalvandoPagamento(false)}
 }
 function abrirCorrecao(categoria:CategoriaCmvRevisao){
  const base=dados?.previsto
  const atual=base?custoRevisado(base,dados?.revisoes||{},categoria):null
  setCorrigindo(corrigindo===categoria?null:categoria)
  setValorConferido(atual===null?'':String(atual).replace('.',','))
  setJustificativa('')
  setSucesso('')
 }
 function formularioRevisao(categoria:CategoriaCmvRevisao){
  if(corrigindo!==categoria)return null
  return <form onSubmit={e=>{e.preventDefault();void revisarCusto(categoria,'corrigido')}} className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
   <label className="text-xs font-semibold text-slate-700">Custo correto (R$)
    <input required type="text" inputMode="decimal" pattern="[0-9.,]+" value={valorConferido} onChange={e=>setValorConferido(e.target.value)} placeholder="Ex.: 525,90" className="mt-1 block w-36 rounded-lg border bg-white px-3 py-2"/>
   </label>
   <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-700">O que foi corrigido? (obrigatório)
    <input required minLength={8} maxLength={500} value={justificativa} onChange={e=>setJustificativa(e.target.value)} placeholder="Ex.: W.Vetro não incluiu sobra de perfil" className="mt-1 block w-full rounded-lg border bg-white px-3 py-2"/>
   </label>
   <button type="submit" disabled={salvandoRevisao} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{salvandoRevisao?'Salvando...':'Salvar correção'}</button>
   <button type="button" onClick={()=>setCorrigindo(null)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><X size={13}/>Cancelar</button>
  </form>
 }
 const p=dados?.previsto
 const perfis=p?(p.perfil_previsao??(p.categorias.perfil!==null&&p.categorias.sobra!==null?p.categorias.perfil+p.categorias.sobra:null)):null
 const revisoes=dados?.revisoes||{}
 const esperado=Object.fromEntries(categories.map(c=>[c,p?custoRevisado(p,revisoes,c):null])) as Record<Categoria,number|null>
 const totalRevisado=p?custoRevisado(p,revisoes,'total'):null
 const totalBruto=p?custoPrevistoOriginal(p,'total'):null
 const semSobraRevisado=p?custoRevisado(p,revisoes,'total_uso'):null
 function botoesRevisao(categoria:CategoriaCmvRevisao){
  const bruto=p?custoPrevistoOriginal(p,categoria):null
  const revisao=revisoes[categoria]
  const atual=revisaoAtual(revisao,bruto)
  const perdaDuplicada=categoria==='perfil'&&p?revisaoPerfilSobrepoePerda(p,revisoes):false
  return <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
   {atual&&!perdaDuplicada&&<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${revisao?.acao==='corrigido'?'bg-blue-100 text-blue-800':'bg-emerald-100 text-emerald-800'}`}>{revisao?.acao==='corrigido'?'Corrigido':'Validado'} · {revisao?.usuario_nome}</span>}
   {perdaDuplicada&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Conferência conciliada: R$ {p?.categorias.perda?.toFixed(2).replace('.',',')} de perda já contabilizados separadamente</span>}
   {!atual&&revisao&&<span className="text-[10px] font-bold text-amber-700">W.Vetro mudou: revisar novamente</span>}
   <button type="button" disabled={salvandoRevisao||bruto===null} onClick={()=>void revisarCusto(categoria,'validado')} title={bruto===null?'Sem valor informado pelo W.Vetro':'Confirmar valor W.Vetro sem alterações'} className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"><CheckCircle2 size={12}/>{categoria==='total'?'Validar custo com sobra':categoria==='total_uso'?'Validar custo sem sobra':'Validar custo'}</button>
   <button type="button" disabled={salvandoRevisao} onClick={()=>abrirCorrecao(categoria)} className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"><Pencil size={12}/>{categoria==='total'?'Corrigir custo com sobra':categoria==='total_uso'?'Corrigir custo sem sobra':'Corrigir custo'}</button>
  </div>
 }
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-bold text-slate-900">Custos / CMV da obra</h3><p className="text-xs text-slate-500">Previsão W.Vetro separada dos lançamentos reais e do financeiro da venda.</p></div>
   <div className="flex flex-wrap gap-2"><Link href={`/relatorios/fornecedores?obra=${encodeURIComponent(vendaId)}`} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">Comparar compra e recebimento</Link><button type="button" onClick={()=>void buscar()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw size={14}/> Atualizar</button><button type="button" onClick={()=>{setOrigemNova('compra');setEtapaNova('comprado');setUnidadeNova('KG');setCategoriaNova('perfil');setValorCompra('');setPesoCompra('');setAdicionar(adicionar==='compra'?null:'compra')}} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/> Adicionar compra</button><button type="button" onClick={()=>{setOrigemNova('outro');setEtapaNova('comprado');setCategoriaNova('outros');setAdicionar(adicionar==='adicional'?null:'adicional')}} className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><Plus size={14}/> Custo adicional</button></div>
  </div>
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
  {sucesso&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
  {carregando&&!dados?<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Carregando CMV...</p>:null}
  {adicionar&&<form onSubmit={enviar} className="rounded-xl border bg-slate-50 p-4">
   <h4 className="mb-3 font-bold">{adicionar==='compra'?(etapaNova==='recebido'?'Registrar custo recebido / material':'Registrar custo comprado / material'):'Registrar custo adicional não previsto'}</h4>
   <p className="mb-3 text-xs text-slate-600">Escolha se este lançamento pertence ao custo Comprado ou Recebido. O valor e o peso aparecem somente na etapa selecionada. Nenhum lançamento é duplicado.</p>
   {adicionar==='compra'&&<div className="mb-3 max-w-md"><label className="text-xs font-bold text-slate-800">Destino do lançamento *
    <select name="etapa_cmv" value={etapaNova} onChange={e=>{const destino=e.target.value as 'comprado'|'recebido';setEtapaNova(destino);if(destino==='recebido'){setOrigemNova('compra');setUnidadeNova(unidadePadraoCmv(categoriaNova))}}} className="mt-1 block w-full rounded-lg border-2 border-blue-300 bg-white p-3">
     <option value="comprado">Custo comprado — pedido / cotação</option>
     <option value="recebido">Custo recebido — nota fiscal / romaneio</option>
    </select></label></div>}
   {etapaNova==='recebido'&&!dados?.etapasDisponiveis&&<p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">A opção Recebido está visível para sua conferência, mas sua gravação ficará disponível após habilitar a migração do banco. Não afetará o custo comprado já lançado.</p>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold">Categoria<select required name="categoria" key={adicionar} value={categoriaNova} onChange={e=>{const categoria=e.target.value as Categoria;setCategoriaNova(categoria);setUnidadeNova(unidadePadraoCmv(categoria));setPesoCompra('')}} className="mt-1 w-full rounded-lg border bg-white p-2.5">{(adicionar==='compra'?(['perfil','acessorio','vidro','outros'] as Categoria[]):categories).map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></label>
    <label className="text-xs font-semibold">Origem<select required name="origem" key={adicionar} value={origemNova} onChange={e=>{setOrigemNova(e.target.value);if(e.target.value==='compra')setUnidadeNova(unidadePadraoCmv(categoriaNova))}} className="mt-1 w-full rounded-lg border bg-white p-2.5">{adicionar==='compra'?<><option value="compra">Compra</option>{etapaNova!=='recebido'&&<option value="estoque">Material / sobra do estoque</option>}</>:<><option value="outro">Custo adicional</option><option value="servico">Serviço adicional</option></>}</select></label>
    <label className="text-xs font-semibold">Valor total (R$)<input required name="valor" inputMode="decimal" value={valorCompra} onChange={e=>setValorCompra(e.target.value)} placeholder="Ex.: 832,00" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Descrição (opcional)<input name="descricao" maxLength={500} placeholder="Ex.: compra de perfis / sobra aproveitada" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Data *<input required name="data" type="date" defaultValue={dataLocal()} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">{adicionar==='compra'&&origemNova==='compra'?(etapaNova==='recebido'?'Quantidade recebida *':'Quantidade comprada *'):'Quantidade (opcional)'}<input required={adicionar==='compra'&&origemNova==='compra'} name="quantidade" type="number" min={unidadeNova==='KG'?'0.001':'1'} step={unidadeNova==='KG'?'any':'1'} value={pesoCompra} onChange={e=>setPesoCompra(e.target.value)} placeholder={adicionar==='compra'?'Ex.: 100':''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Unidade {adicionar==='compra'&&origemNova==='compra'?'*':'(opcional)'}<select name="unidade" value={unidadeNova} onChange={e=>setUnidadeNova(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2.5">{UNIDADES_CMV.map(u=><option value={u} key={u}>{u==='KG'?'Quilo (KG)':u==='UN'?'Unidade (UN)':u==='PC'?'Peça (PC)':'Pacote (PCT)'}</option>)}</select></label>
    {adicionar==='compra'&&origemNova==='compra'&&<div className="rounded-lg border bg-white p-2.5 text-xs"><b>{etapaNova==='recebido'?'Preço por unidade recebida':'Preço por unidade comprada'}</b><p className="mt-1 text-lg font-bold">{Number(pesoCompra)>0?moedas(Number(String(valorCompra).replace(/\./g,'').replace(',','.'))/Number(pesoCompra))+'/'+rotuloUnidadeCmv(unidadeNova):'Preencha valor e quantidade'}</p></div>}
    <FornecedorCmvCampo />
    <label className="text-xs font-semibold">{etapaNova==='recebido'?'Nº nota fiscal / romaneio *':'Nº nota/documento (opcional)'}<input name="documento" required={etapaNova==='recebido'} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Comprovante (PDF ou foto, até 15 MB)<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full rounded-lg border bg-white p-2"/></label>
    <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Observações<input name="observacoes" maxLength={1000} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
   </div>
   <p className="mt-3 text-xs text-slate-500">Este formulário registra valores no CMV, mas não movimenta o Kanban de Compras. Para acompanhar pedidos e recebimentos, use a aba Compras. Material reaproveitado entra como estoque pelo custo consumido. Se a compra já tem valor real vinculado à obra, não registre a mesma nota novamente.</p>
   <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setAdicionar(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando||(etapaNova==='recebido'&&!dados?.etapasDisponiveis)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando?'Salvando...':adicionar==='compra'?(etapaNova==='recebido'?'Registrar recebido':'Registrar compra'):'Registrar custo adicional'}</button></div>
  </form>}
  {dados&&<div className="space-y-4">
   {realizado<=0&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Ainda não há custo efetivamente registrado nesta venda. O custo previsto W.Vetro é referência; não representa o realizado. Registre compras e custos antes de avaliar margem real.</p>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card titulo="Custo previsto total da obra" valor={previstoFmt(totalRevisado)} nota={`Original W.Vetro com sobra: ${previstoFmt(totalBruto)} · ${dados.numeroWvetro?'Orçamento #'+dados.numeroWvetro:'Fonte: W.Vetro'}`}/>
    <Card titulo="Custo comprado total da obra" valor={moedas(realizado)} nota="Compras e custos da obra, sem duplicar recebimentos"/>
    <Card titulo="Custo recebido total da obra" valor={existeRecebimento?moedas(totalRecebido):'Aguardando recebimento'} nota="Valores recebidos conforme notas e romaneios; entregas parciais incluídas"/>
    <Card titulo="Diferença até agora" valor={totalRevisado==null?'—':moedas(totalRevisado-(existeRecebimento?totalRecebido:realizado))} detalhe={existeRecebimento?'Comprado − recebido: '+moedas(realizado-totalRecebido):'Aguardando recebimentos'} nota={existeRecebimento?'Previsto − recebido (parcial)':'Previsto − comprado; ainda sem recebimentos'}/>
    <Card titulo="Lançamentos" valor={String(dados.lancamentos.length)} nota="Registros de custos desta venda"/>

   </div>
   <section id="conferencia-valor-venda" aria-label="Conferência do valor de venda" className="scroll-mt-20 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h4 className="text-sm font-bold text-slate-900">Conferência do valor de venda · W.Vetro</h4><p className="mt-1 text-xs text-slate-600">A validação confirma o total importado do W.Vetro. A correção permite informar outro valor, com histórico. Não altera os itens ou os recebíveis já lançados.</p></div>
     {podeRevisarVenda&&<div className="flex flex-wrap gap-2">
      <button type="button" disabled={salvandoVenda||dados.vendaValorWvetro==null} onClick={()=>{if(window.confirm('Validar o valor de venda W.Vetro ('+previstoFmt(dados.vendaValorWvetro??null)+') e atualizar a venda no Atlas? O financeiro ja lancado nao sera alterado automaticamente.'))void revisarVenda('validado')}} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"><CheckCircle2 size={14}/>Validar valor de venda W.Vetro</button>
      <button type="button" disabled={salvandoVenda} onClick={()=>{setCorrigirVenda(!corrigirVenda);setValorVendaConferido(String(dados.vendaValorWvetro??dados.vendaValorAtual??'').replace('.',','));setMotivoVenda('')}} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800"><Pencil size={14}/>Corrigir valor de venda</button>
     </div>}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
     <Card titulo="Venda importada do W.Vetro" valor={previstoFmt(dados.vendaValorWvetro??null)} nota="Referência histórica da origem"/>
     <Card titulo="Venda atual no Atlas" valor={previstoFmt(dados.vendaValorAtual??null)} nota="Valor gravado na venda; usado no cálculo de margem"/>
     <Card titulo="Diferença · W.Vetro − Atlas" valor={dados.vendaValorWvetro==null||dados.vendaValorAtual==null?'A conferir':moedas(dados.vendaValorWvetro-dados.vendaValorAtual)} nota="Somente a aprovação altera o valor da venda"/>
    </div>
    {corrigirVenda&&podeRevisarVenda&&<form onSubmit={e=>{e.preventDefault();void revisarVenda('corrigido')}} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-white p-3">
     <label className="text-xs font-semibold">Valor correto de venda (R$)<input required inputMode="decimal" pattern="[0-9.,]+" value={valorVendaConferido} onChange={e=>setValorVendaConferido(e.target.value)} className="mt-1 block w-40 rounded-lg border p-2" placeholder="Ex.: 9.450,00"/></label>
     <label className="min-w-[220px] flex-1 text-xs font-semibold">Justificativa obrigatória<input required minLength={8} maxLength={500} value={motivoVenda} onChange={e=>setMotivoVenda(e.target.value)} className="mt-1 block w-full rounded-lg border p-2" placeholder="Ex.: Valor contratado diverge do importado"/></label>
     {numeroTitulos>0&&<label className="flex w-full items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={ajustarParcela} onChange={e=>setAjustarParcela(e.target.checked)}/>Atualizar também a parcela em aberto, preservando pagamentos e parcelas já quitadas (transação única)</label>}
     <button disabled={salvandoVenda} type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{salvandoVenda?'Salvando...':'Salvar correção de venda'}</button>
     <button type="button" onClick={()=>setCorrigirVenda(false)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button>
    </form>}
    {!podeRevisarVenda&&<p className="mt-2 text-xs text-slate-500">Conferência do valor de venda disponível para o perfil Master.</p>}
    <p className="mt-2 text-[11px] text-amber-800">Se marcar a conciliação, apenas uma parcela em aberto poderá ser recalculada; parcelas pagas, pagamentos e descontos existentes permanecem preservados. Confira o Financeiro após a correção.</p>
    {Boolean(dados.historicoValorVenda?.length)&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Histórico de alterações do valor de venda ({dados.historicoValorVenda?.length})</summary>
     <div className="mt-2 space-y-2">{dados.historicoValorVenda?.map((h,i)=><div key={i} className="rounded-lg border bg-white p-2"><b>{h.acao==='validado'?'Validado':'Corrigido'}</b> · {h.usuario} · {new Date(h.em).toLocaleString('pt-BR')} · {moedas(h.anterior)} → {moedas(h.novo)}<div className="text-slate-500">{h.justificativa}</div></div>)}</div>
    </details>}
   </section>
   <section aria-label="Recebimentos da venda" className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h4 className="text-sm font-bold text-slate-900">Pagamentos desta venda</h4>
      <p className="mt-1 text-xs text-slate-500">Valor de parcelas: {moedas(valorTitulos)} · Já recebido: {moedas(totalPago)} · {numeroTitulos} parcela(s) financeira(s)</p>
     </div>
     {onRegistrarRecebimento&&<button type="button" onClick={onRegistrarRecebimento} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><Plus size={13} className="mr-1 inline"/>Registrar valor já pago</button>}
    </div>
    {recebimentosRegistrados.length?recebimentosRegistrados.map(r=><div key={r.id} className="mt-3 rounded-lg border p-3 text-sm">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><b>{moedas(Number(r.valor||0))}</b> · {r.data_recebimento?new Date(r.data_recebimento+'T12:00:00').toLocaleDateString('pt-BR'):'Data não informada'} · {r.forma||'Forma não informada'}</div>
      {podeRevisarVenda&&<button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700" onClick={()=>{setEditandoRecebimento(editandoRecebimento===r.id?null:r.id);setValorPagoCorreto(String(r.valor??'').replace('.',','));setMotivoPagamento('')}}><Pencil size={13}/>Corrigir pagamento</button>}
     </div>
     {editandoRecebimento===r.id&&podeRevisarVenda&&<form onSubmit={e=>void corrigirPagamento(e,r)} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
      <label className="text-xs font-semibold">Valor efetivamente pago (R$)<input required inputMode="decimal" pattern="[0-9.,]+" className="mt-1 block w-44 rounded-lg border bg-white p-2" value={valorPagoCorreto} onChange={e=>setValorPagoCorreto(e.target.value)}/></label>
      <label className="min-w-[200px] flex-1 text-xs font-semibold">Motivo da correção<input required minLength={8} maxLength={500} className="mt-1 block w-full rounded-lg border bg-white p-2" value={motivoPagamento} onChange={e=>setMotivoPagamento(e.target.value)}/></label>
      <button disabled={salvandoPagamento} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Salvar correção auditada</button>
      <button type="button" onClick={()=>setEditandoRecebimento(null)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button>
     </form>}
    </div>):<p className="mt-3 text-xs text-slate-500">{totalPago>0?'Existe pagamento no resumo financeiro sem recibo individual associado. Confira o Financeiro antes de corrigir.':'Nenhum pagamento registrado nesta venda.'}</p>}
    {historicoPagamentos.length>0&&<details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Histórico de correções de pagamentos ({historicoPagamentos.length})</summary><div className="mt-2 space-y-1">{historicoPagamentos.map(h=><p key={h.id} className="rounded border bg-slate-50 p-2">{moedas(Number(h.valor_anterior))} → {moedas(Number(h.valor_novo))} · {h.criado_por_nome} · {new Date(h.created_at).toLocaleString('pt-BR')} · {h.justificativa}</p>)}</div></details>}
    <p className="mt-2 text-[11px] text-amber-800">Corrigir um pagamento não altera automaticamente o valor contratado. Recebimentos com múltiplas alocações ou descontos exigem conciliação financeira específica.</p>
   </section>
   <section aria-label="Resultado original da obra W.Vetro" className="rounded-xl border border-slate-200 p-3">
    <h4 className="mb-2 text-sm font-bold text-slate-800">Resultado do orçamento no W.Vetro · valores originais</h4>
    <div className="grid gap-3 sm:grid-cols-3">
     <div><Card titulo="Custo sem sobra · revisado" valor={previstoFmt(semSobraRevisado)} nota={`Original importado: ${previstoFmt(p?.total_uso??null)} · Materiais permanecem intactos`}/>{botoesRevisao('total_uso')}{formularioRevisao('total_uso')}</div>
     <Card titulo="Sobra de material" valor={previstoFmt(p?.categorias.sobra??null)} nota="Somada somente no resultado com sobra"/>
     <div><Card titulo="Custo com sobra · revisado" valor={previstoFmt(totalRevisado)} nota={`Original importado: ${previstoFmt(p?.total_com_sobra??null)} · Não é custo realizado`}/>{botoesRevisao('total')}</div>
    </div>
    {p?.total_uso!=null&&p?.total_com_sobra!=null&&p?.categorias.sobra!=null&&
     <p className={`mt-2 text-xs font-semibold ${Math.abs(p.total_uso+p.categorias.sobra-p.total_com_sobra)<=0.02?'text-emerald-700':'text-amber-700'}`}>
      {Math.abs(p.total_uso+p.categorias.sobra-p.total_com_sobra)<=0.02
       ?'Conciliação dos resultados W.Vetro: valores conferem.'
       :'Atenção: resultado da obra e sobra não conciliados. Conferir antes de validar.'}
     </p>}
    {semSobraRevisado!=null&&totalRevisado!=null&&p?.categorias.sobra!=null&&Math.abs(Math.round((semSobraRevisado+p.categorias.sobra-totalRevisado)*100)/100)>0.02&&<p role="alert" className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900">Atenção: os dois totais revisados ainda não conciliam com a sobra de material. Confira os valores antes de finalizar.</p>}
    <p className="mt-2 text-[11px] text-slate-500">Não confundir com Despesas Extras/Previsão: os centros de custos podem agregar perda de corte a materiais.</p>
   </section>
   <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><b className="text-sm text-slate-800">Conferência de custos W.Vetro com aprendizado da IA</b><p className="mt-1 text-xs text-slate-600">Valide o que está correto ou corrija com justificativa. Os valores originais do W.Vetro e o CMV realizado não são alterados. Feedbacks armazenados: {dados.feedbackIA||0}.</p></div>
     {botoesRevisao('total')}
    </div>
    {formularioRevisao('total')}
    {dados.historicoRevisoes?.length>0&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Histórico de validações e correções ({dados.historicoRevisoes.length} mais recentes)</summary><div className="mt-2 space-y-1">{dados.historicoRevisoes.map((r,i)=><div key={r.registrado_em+'-'+r.categoria+'-'+i} className="rounded-md border bg-white p-2"><b>{r.categoria==='total'?'Total com sobra':r.categoria==='total_uso'?'Total sem sobra':r.categoria==='perfil_uso'?'Uso do perfil':r.categoria==='sobra'?'Sobra do perfil':labels[r.categoria as Categoria]||r.categoria}</b> · {r.acao==='corrigido'?'Corrigido':'Validado'} · {r.usuario_nome} · {new Date(r.registrado_em).toLocaleString('pt-BR')}<span className="ml-2">W.Vetro: {previstoFmt(r.valor_origem)} → conferido: {moedas(r.valor_revisado)}</span>{r.acao==='corrigido'&&<div className="mt-1 text-slate-500">{r.justificativa}</div>}</div>)}</div></details>}
   </div>
   {p?.aviso&&<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{p.aviso}</div>}
   <div className="overflow-x-auto rounded-xl border">
    <table className="w-full min-w-[850px] text-sm">
     <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Categoria</th><th className="p-3 text-right">Previsto W.Vetro / revisado</th><th className="p-3 text-right">Comprado</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Diferença parcial</th></tr></thead>
     {categories.map(c=>{
      const e=esperado[c],r=porCategoria[c],compara=comparativos[c]
      const dif=e===null?null:e-(compara.temRecebimento?compara.valorRecebido:r)
      return <tbody key={c}>
       <tr className="border-b">
        <td className="p-3"><button className="flex items-center gap-2 font-semibold hover:underline" type="button" onClick={()=>setAberto(aberto===c?null:c)}>{aberto===c?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {labels[c]}</button>{botoesRevisao(c)}</td>
        <td className="p-3 text-right">{previstoFmt(e)}
         {p&&revisaoAtual(revisoes[c],custoPrevistoOriginal(p,c))&&revisoes[c]?.acao==='corrigido'&&<div className="mt-1 text-[10px] font-normal text-slate-500">Original W.Vetro: {previstoFmt(custoPrevistoOriginal(p,c))}</div>}
        </td>
        <td className="p-3 text-right font-semibold">{moedas(r)}</td>
        <td className="p-3 text-right font-semibold">{compara.temRecebimento?moedas(compara.valorRecebido):'Aguardando'}{compara.temRecebimento&&<div className="text-[10px] font-normal text-slate-500">Parcial · {compara.quantidadeRecebimentos} entrega(s)</div>}</td>
        <td className={'p-3 text-right '+(dif!==null&&dif<0?'text-red-700':'text-slate-700')}>{dif===null?'—':moedas(dif)}
         <div className="text-[10px] font-normal text-slate-500">{compara.temRecebimento?'Previsto − recebido (parcial)':'Previsto − comprado'}</div></td>
       </tr>
       {corrigindo===c&&<tr className="border-b"><td colSpan={5} className="px-4 py-3">{formularioRevisao(c)}</td></tr>}
       {aberto===c&&<tr className="border-b bg-slate-50/70"><td colSpan={5} className="px-6 py-4">
        {c==='perfil'&&<div className="space-y-2">
         <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-3"><Card titulo="Uso técnico · ResumoObra W.Vetro" valor={previstoFmt(p?.categorias.perfil??null)}/>{botoesRevisao('perfil_uso')}</div>
          <div className="rounded-xl border bg-white p-3"><Card titulo="Sobra do perfil · W.Vetro original" valor={previstoFmt(p?.categorias.sobra??null)} nota="Custo da sobra, mesmo não cobrada ao cliente"/>{botoesRevisao('sobra')}</div>
          <Card titulo={p?.perfil_previsao_fonte==='despesas_extras_wvetro'?'Previsão do centro de custo':'Perfis utilizados + sobra'} valor={previstoFmt(perfis)} nota={p?.perfil_previsao_fonte==='despesas_extras_wvetro'?'Despesas Extras/Previsão · conferir componentes do valor':'Somente perfis + sobra, sem perda de corte'}/>
         </div>
         {formularioRevisao('perfil_uso')}
         {formularioRevisao('sobra')}
         {p?.perfil_centro_custo!=null&&p.perfil_previsao_fonte!=='despesas_extras_wvetro'&&
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">Referência separada de Despesas Extras/Previsão · MATÉRIA PRIMA - PERFIL: <b>{moedas(p.perfil_centro_custo)}</b>. Esse centro de custo não substitui a decomposição de materiais utilizados e sobra.</p>}
        </div>}
        {c==='perda'&&p?.perda_fonte==='conciliacao_wvetro'&&<p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Perda obtida pela conciliação do resultado da obra com perfis usados, acessórios e vidros. Confirme no quadro Conferir Valores do W.Vetro antes de validar.</p>}
        {(c==='perfil'||c==='acessorio'||c==='vidro'||c==='outros')&&<>
         <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo={compara.unidade==='KG'?'Peso comprado':'Quantidade comprada'} valor={compara.quantidadeComprada>0?mostrarQuantidadeCmv(compara.quantidadeComprada,compara.unidade):'A preencher'} nota={compara.faltaQuantidadeComprada?'Há compras sem quantidades conciliadas nesta unidade':''}/>
          <Card titulo={compara.unidade==='KG'?'Peso recebido':'Quantidade recebida'} valor={compara.temRecebimento&&!compara.unidadesMisturadas?mostrarQuantidadeCmv(compara.quantidadeRecebida,compara.unidade):'A conferir'}/>
          <Card titulo={compara.unidade==='KG'?'Diferença de peso':'Diferença de quantidade'} valor={compara.diferencaQuantidade!==null&&compara.temRecebimento&&!compara.unidadesMisturadas?mostrarQuantidadeCmv(compara.diferencaQuantidade,compara.unidade):'A conferir'} nota="Recebido menos comprado; parcial"/>
          <Card titulo="Variação de quantidade" valor={compara.percentualQuantidade!==null&&compara.temRecebimento&&!compara.unidadesMisturadas?variacaoPeso(compara.percentualQuantidade):'A conferir'} nota="Na mesma unidade de medida"/>
         </div>
         {compara.unidadesMisturadas&&<p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Existem unidades diferentes ou registros antigos em kg nesta categoria. Confira os lançamentos antes de comparar quantidades; kg não é convertido em peças.</p>}
         {compara.temRecebimento&&<div className="mt-2 rounded-lg border bg-white p-3 text-xs">Diferença de valor entre recebido e comprado nesta categoria: <b className={compara.diferencaCompraRecebido!==null&&compara.diferencaCompraRecebido>0?'text-red-700':'text-slate-800'}>{compara.diferencaCompraRecebido!==null?moedas(compara.diferencaCompraRecebido):'—'}</b>. Enquanto houver entrega pendente, os resultados são parciais.</div>}
         {compara.faltaQuantidadeComprada&&<p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">Há compras sem quantidade compatível. Confira os lançamentos e unidades na aba Compras antes de confiar na variação percentual.</p>}
         <VendaCmvRecebimentos acessoCmv={acessoCmv} vendaId={vendaId} categoria={c} registros={recebimentos} historico={historicoRecebimentos} disponivel={recebimentosDisponiveis&&!dados.etapasDisponiveis} onAtualizar={buscar}/>
        </>}
        <div className="mt-3 space-y-2">
         {Number(comprasExistentes[c]||0)>0&&<p className="text-xs text-slate-600">Compras vinculadas anteriormente: {moedas(Number(comprasExistentes[c]))}</p>}
         {dados.lancamentos.filter(l=>l.categoria===c).map(l=>{
          const historico=(dados.historicoLancamentos||[]).filter(h=>h.lancamento_id===l.id)
          const camposMudados=(h:HistoricoLancamento)=>{
           const campos:[string,string][]=[['categoria','Categoria'],['etapa_cmv','Destino do lançamento'],['origem','Origem'],['valor','Valor'],['data_lancamento','Data'],['fornecedor','Fornecedor'],['descricao','Descrição'],['quantidade','Quantidade'],['unidade','Unidade'],['documento','Documento'],['observacoes','Observações'],['anexo_nome','Comprovante']]
           return campos.filter(([campo])=>String(h.antes?.[campo]??'')!==String(h.depois?.[campo]??''))
            .map(([campo,rotulo])=>rotulo+(campo==='valor'?': '+moedas(Number(h.antes.valor))+' → '+moedas(Number(h.depois.valor)):'')).join(' · ')
          }
          return <div key={l.id} className="rounded-lg border bg-white p-3">
           <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-xs">
             <b>{l.descricao}</b>
             <p className="mt-1 font-semibold text-blue-700">Destino: {l.etapa_cmv==='recebido'?'Recebido':'Comprado'}</p>
             <p className="mt-1 text-slate-500">{l.origem==='estoque'?'Retirado do estoque':'Compra / custo'} · {l.data_lancamento}{l.fornecedor?' · '+l.fornecedor:''}{l.documento?' · Doc. '+l.documento:''}</p>
             {l.anexo_url&&<a href={l.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 underline"><FileText size={12}/> {l.anexo_nome||'Comprovante'}</a>}
             {!l.anexo_url&&<p className="mt-1 text-amber-700">Sem comprovante anexado</p>}
             {l.atualizado_em&&<p className="mt-1 text-[11px] text-slate-500">Corrigido por {l.atualizado_por_nome||'usuário autorizado'} em {new Date(l.atualizado_em).toLocaleString('pt-BR')}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
             <b className="text-sm">{moedas(Number(l.valor))}</b>
             {podeModificarCmv(l,'editar_terceiros')&&<button type="button" disabled={salvandoEdicao||salvandoExclusao}
              onClick={()=>{setEtapaEdicao(l.etapa_cmv==='recebido'?'recebido':'comprado');setEditandoLancamento(editandoLancamento===l.id?null:l.id);setExcluindoLancamento(null);setMotivoExclusao('');setErro('');setSucesso('')}}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              <Pencil size={13}/>{editandoLancamento===l.id?'Fechar edição':'Editar lançamento'}
             </button>}
             {podeModificarCmv(l,'excluir_terceiros')&&<button type="button" disabled={salvandoEdicao||salvandoExclusao}
              onClick={()=>{setExcluindoLancamento(excluindoLancamento===l.id?null:l.id);setEditandoLancamento(null);setMotivoExclusao('');setErro('');setSucesso('')}}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
              <Trash2 size={13}/>{excluindoLancamento===l.id?'Fechar exclusão':'Excluir'}
             </button>}
            </div>
           </div>
           {podeModificarCmv(l,'excluir_terceiros')&&excluindoLancamento===l.id&&<form onSubmit={e=>void excluirLancamento(e,l)} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <h4 className="text-sm font-bold text-red-800">Excluir somente este lançamento?</h4>
            <p className="mt-1 text-xs text-red-900">Confirme: <b>{l.descricao}</b> · {moedas(Number(l.valor))} · {l.fornecedor||'Fornecedor não informado'}. Ele deixará de somar ao CMV desta obra e dos relatórios, mas o comprovante e a auditoria serão preservados. Não exclui a compra do módulo Compras.</p>
            <label className="mt-3 block text-xs font-semibold text-red-900">Motivo da exclusão *
             <input required minLength={5} maxLength={500} value={motivoExclusao} onChange={e=>setMotivoExclusao(e.target.value)} placeholder="Ex.: lançamento duplicado" className="mt-1 block w-full rounded-lg border border-red-200 bg-white p-2.5"/>
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
             <button type="button" disabled={salvandoExclusao} onClick={()=>{setExcluindoLancamento(null);setMotivoExclusao('')}} className="rounded-lg border bg-white px-4 py-2 text-xs">Voltar sem excluir</button>
             <button type="submit" disabled={salvandoExclusao||motivoExclusao.trim().length<5} className="rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{salvandoExclusao?'Excluindo...':'Confirmar exclusão deste lançamento'}</button>
            </div>
           </form>}
           {historico.length>0&&<details className="mt-3 border-t pt-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Histórico de correções ({historico.length})</summary>
            <div className="mt-2 space-y-2">{historico.map(h=><div key={h.id} className="rounded-lg bg-slate-50 p-2">
             <b>{h.alterado_por_nome||'Usuário'} · {new Date(h.alterado_em).toLocaleString('pt-BR')}</b>
             <p className="mt-1">{camposMudados(h)||'Dados revisados'}</p>
             {h.anexo_anterior_url&&<a href={h.anexo_anterior_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 underline">
              <FileText size={12}/> Comprovante anterior: {String(h.antes?.anexo_nome||'abrir arquivo')}
             </a>}
            </div>)}</div>
           </details>}
           {podeModificarCmv(l,'editar_terceiros')&&editandoLancamento===l.id&&<form key={l.id+'-'+String(l.versao)} onSubmit={e=>void salvarEdicao(e,l)} className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <h4 className="mb-1 text-sm font-bold text-slate-800">Corrigir lançamento existente</h4>
            <p className="mb-3 text-xs text-slate-600">Salva no mesmo lançamento, preservando comprovantes e histórico. Também permite corrigir o destino Comprado/Recebido sem recriar o custo.</p>
            <label className="mb-3 block max-w-md text-xs font-bold">Destino do lançamento *
             <select name="etapa_cmv" value={etapaEdicao} onChange={e=>setEtapaEdicao(e.target.value as 'comprado'|'recebido')} className="mt-1 block w-full rounded-lg border-2 border-blue-300 bg-white p-3">
              <option value="comprado">Custo comprado — pedido / cotação</option>
              <option value="recebido">Custo recebido — nota fiscal / romaneio</option>
             </select>
            </label>
            {etapaEdicao==='recebido'&&!dados.etapasDisponiveis&&<p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">A reclassificação para Recebido aguarda migração do banco. A compra original permanecerá intacta.</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
             <label className="text-xs font-semibold">Categoria *<select required name="categoria" defaultValue={l.categoria} className="mt-1 w-full rounded-lg border bg-white p-2.5">{categories.map(cat=><option value={cat} key={cat}>{labels[cat]}</option>)}</select></label>
             <label className="text-xs font-semibold">Origem *<select required name="origem" defaultValue={etapaEdicao==='recebido'?'compra':l.origem} key={etapaEdicao} className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="compra">Compra</option><option value="estoque">Material / sobra de estoque</option><option value="servico">Serviço</option><option value="outro">Custo adicional</option></select></label>
             <label className="text-xs font-semibold">Valor total (R$) *<input required name="valor" inputMode="decimal" defaultValue={String(l.valor).replace('.',',')} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
             <label className="text-xs font-semibold lg:col-span-2">Descrição (opcional)<input name="descricao" maxLength={500} defaultValue={l.descricao} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
             <label className="text-xs font-semibold">Data *<input required name="data" type="date" defaultValue={l.data_lancamento} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
             <label className="text-xs font-semibold">{etapaEdicao==='recebido'?'Quantidade recebida *':'Quantidade comprada'}<input name="quantidade" type="number" min="0.001" step="any" required={etapaEdicao==='recebido'} defaultValue={l.quantidade??''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
             <label className="text-xs font-semibold">Unidade *<select name="unidade" key={etapaEdicao} defaultValue={l.unidade||unidadePadraoCmv(l.categoria)} className="mt-1 w-full rounded-lg border bg-white p-2.5">{UNIDADES_CMV.map(u=><option key={u} value={u}>{u==='KG'?'Quilo (KG)':u==='UN'?'Unidade (UN)':u==='PC'?'Peça (PC)':'Pacote (PCT)'}</option>)}</select></label>
             <FornecedorCmvCampo inicial={l.fornecedor??''} />
             <label className="text-xs font-semibold">{etapaEdicao==='recebido'?'Nº nota fiscal / romaneio *':'Nº nota/documento (opcional)'}<input name="documento" required={etapaEdicao==='recebido'} defaultValue={l.documento??''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
             <label className="text-xs font-semibold lg:col-span-2">Anexar ou substituir comprovante (opcional, até 15 MB)
              <input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full rounded-lg border bg-white p-2.5"/>
              <span className="mt-1 block text-[11px] font-normal text-slate-500">{l.anexo_nome?'Atual: '+l.anexo_nome+'. Sem novo arquivo, o atual permanece.':'Nenhum anexo. Selecione PDF ou imagem para acrescentar.'}</span>
             </label>
             <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Observações (opcional)<input name="observacoes" maxLength={1000} defaultValue={l.observacoes??''} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
             <button type="button" disabled={salvandoEdicao} onClick={()=>setEditandoLancamento(null)} className="rounded-lg border bg-white px-4 py-2 text-xs">Cancelar</button>
             <button type="submit" disabled={salvandoEdicao||(etapaEdicao==='recebido'&&!dados.etapasDisponiveis)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{salvandoEdicao?'Salvando...':'Salvar correção'}</button>
            </div>
           </form>}
          </div>
         })}
         {!dados.lancamentos.some(l=>l.categoria===c)&&!comprasExistentes[c]&&<p className="text-xs text-slate-500">Nenhum custo realizado lançado nesta categoria.</p>}

        </div>
       </td></tr>}
      </tbody>
     })}
    </table>
   </div>
   {Boolean(dados.excluidos?.length)&&<details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
    <summary className="cursor-pointer font-semibold">Lançamentos excluídos ({dados.excluidos!.length}) · histórico preservado</summary>
    <div className="mt-3 space-y-2">{dados.excluidos!.map(l=><div key={l.id} className="rounded-lg border bg-white p-3">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><b>{l.descricao}</b><p className="mt-1 text-slate-500">{l.fornecedor||'Fornecedor não informado'} · {l.data_lancamento}</p><p className="mt-1 text-slate-600">Excluído por {l.cancelado_por_nome||'usuário autorizado'}{l.cancelado_em?' em '+new Date(l.cancelado_em).toLocaleString('pt-BR'):''}</p><p className="mt-1 text-slate-600">Motivo: {l.motivo_cancelamento||'Não informado'}</p></div>
     <b className="text-slate-500 line-through">{moedas(Number(l.valor))}</b></div>
     <div className="mt-2 flex flex-wrap items-center gap-3">
      {l.anexo_url&&<a href={l.anexo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline"><FileText size={12}/> {l.anexo_nome||'Comprovante preservado'}</a>}
      {podeModificarCmv(l,'restaurar_terceiros')&&<button type="button" disabled={Boolean(restaurandoId)} onClick={()=>void restaurarLancamento(l)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50">{restaurandoId===l.id?'Restaurando...':'Restaurar lançamento'}</button>}
     </div>
    </div>)}</div>
   </details>}
  </div>}

 </div>
}
