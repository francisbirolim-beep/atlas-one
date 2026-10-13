'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { adicionarDocumentoCliente } from '@/lib/cliente360'
import { tokenAtual } from '@/lib/auth'
import { disponibilidadePeca, refItemProducaoInstalacao, type OrdemParaInstalacao } from '@/lib/vendaInstalacaoProducao'

type InstalacaoItem={
  id:string
  venda_obra_id:string
  obra_id?:string|null
  cliente_id?:string|null
  orcamento_id?:string|null
  item_ref:string
  ambiente?:string|null
  descricao?:string|null
  quantidade:number
  quantidade_instalada:number
  status:'pendente'|'em_instalacao'|'instalado'|'pendencia'
  checklist?:Record<string,boolean>|null
  pendencia?:string|null
  observacoes?:string|null
  updated_at?:string|null
}
type Doc={id:string;titulo:string;url:string;tipo?:string|null;observacoes?:string|null;created_at:string}
const CHECKS=[
  ['nivelamento','Nivelamento'],
  ['vedacao','Vedação'],
  ['acabamento','Acabamento'],
  ['limpeza','Limpeza'],
] as const

function refItem(item:any,idx:number){return refItemProducaoInstalacao(item,idx)}
function ambiente(item:any,idx:number){return String(item?.ambiente||item?.local||item?.descricao_curta||item?.configuracao_nome||item?.descricao||`Tipologia ${idx+1}`)}
function descricao(item:any){return String(item?.descricao||item?.tipo_esquadria||item?.tipologia_nome||item?.configuracao_nome||'Peça')}
function statusLabel(v:string){return v==='instalado'?'Instalado':v==='em_instalacao'?'Em instalação':v==='pendencia'?'Com pendência':'Pendente'}
function badge(v:string){return v==='instalado'?'bg-emerald-100 text-emerald-700':v==='em_instalacao'?'bg-blue-100 text-blue-700':v==='pendencia'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}

export default function VendaInstalacaoDetalhada({
  vendaId,obraId,clienteId,orcamentoId,itens,statusGeral,onAtualizar,
}:{
  vendaId:string
  obraId?:string|null
  clienteId:string
  orcamentoId:string
  itens:any[]
  statusGeral?:string|null
  onAtualizar?:()=>void
}){
  const [lista,setLista]=useState<InstalacaoItem[]>([])
  const [ordens,setOrdens]=useState<OrdemParaInstalacao[]>([])
  const [qtdEditando,setQtdEditando]=useState<Record<string,string>>({})
  const [docs,setDocs]=useState<Doc[]>([])
  const [carregando,setCarregando]=useState(true)
  const [salvandoId,setSalvandoId]=useState<string|null>(null)
  const [erro,setErro]=useState('')
  const [msg,setMsg]=useState('')
  const inputFoto=useRef<Record<string,HTMLInputElement|null>>({})

  async function carregar(){
    if(!vendaId){setCarregando(false);return}
    setCarregando(true);setErro('')
    const [ir,dr,pr]=await Promise.all([
      supabase.from('venda_instalacao_itens').select('*').eq('venda_obra_id',vendaId).order('created_at'),
      obraId?supabase.from('cliente_documentos').select('id,titulo,url,tipo,observacoes,created_at').eq('cliente_id',clienteId).eq('obra_id',obraId).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null} as any),
      supabase.from('ordens_producao').select('id,item_ref,tipo_producao,status,bloqueada,quantidade,quantidade_produzida').eq('venda_obra_id',vendaId),
    ])
    if(ir.error||pr.error){setErro('Instalação indisponível: '+(ir.error?.message||pr.error?.message));setCarregando(false);return}
    setLista((ir.data||[]) as InstalacaoItem[])
    setOrdens((pr.data||[]) as OrdemParaInstalacao[])
    setDocs((dr.data||[]) as Doc[])
    setCarregando(false)
  }

  useEffect(()=>{void preparar()},[vendaId,obraId,orcamentoId])

  async function preparar(){
    if(!vendaId||!obraId){setCarregando(false);return}
    setCarregando(true);setErro('')
    const atuais=await supabase.from('venda_instalacao_itens').select('item_ref').eq('venda_obra_id',vendaId)
    if(atuais.error){
      setErro('Checklist de instalação indisponível: '+atuais.error.message)
      setCarregando(false)
      return
    }
    const existentes=new Set((atuais.data||[]).map((x:any)=>String(x.item_ref)))
    const novos=(Array.isArray(itens)?itens:[]).map((item,idx)=>({
      venda_obra_id:vendaId,obra_id:obraId,cliente_id:clienteId,orcamento_id:orcamentoId,
      item_ref:refItem(item,idx),ambiente:ambiente(item,idx),descricao:descricao(item),
      quantidade:Math.max(0,Number(item?.quantidade||1)),quantidade_instalada:0,status:'pendente',
    })).filter(x=>!existentes.has(x.item_ref))
    let inseridos=false
    if(novos.length){
      const ins=await supabase.from('venda_instalacao_itens').insert(novos)
      if(ins.error){setErro('Não foi possível preparar os itens de instalação: '+ins.error.message)}
      else inseridos=true
    }
    await carregar()
    if(inseridos)onAtualizar?.()
  }

  async function patch(id:string,acao:'quantidade'|'status'|'checklist'|'pendencia',dados:Record<string,unknown>){
    if(salvandoId)return false
    setSalvandoId(id);setErro('');setMsg('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente.')
      const resp=await fetch('/api/vendas/instalacao/item',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId,itemId:id,acao,...dados}),
      })
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok)throw new Error(json.error||'Não foi possível atualizar esta peça.')
      const atualizado=json.item as InstalacaoItem
      setLista(atual=>atual.map(x=>x.id===id?atualizado:x))
      setQtdEditando(atual=>{const novo={...atual};delete novo[id];return novo})
      onAtualizar?.()
      return true
    }catch(e){
      setErro(e instanceof Error?e.message:'Falha ao registrar instalação.')
      setQtdEditando(atual=>{const novo={...atual};delete novo[id];return novo})
      return false
    }finally{setSalvandoId(null)}
  }

  async function mudarStatus(item:InstalacaoItem,status:'pendente'|'em_instalacao'|'instalado'|'pendencia'){
    const ok=await patch(item.id,'status',{status})
    if(ok)setMsg('Status da instalação atualizado.')
  }
  async function mudarQtd(item:InstalacaoItem,valor:string){
    if(!valor.trim())return
    const qtd=Number(valor)
    if(qtd===Number(item.quantidade_instalada||0))return
    const ok=await patch(item.id,'quantidade',{quantidade:qtd})
    if(ok)setMsg('Quantidade instalada atualizada.')
  }
  async function toggleCheck(item:InstalacaoItem,chave:'nivelamento'|'vedacao'|'acabamento'|'limpeza'){
    const atual={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{})}
    const ok=await patch(item.id,'checklist',{chave,marcado:!atual[chave]})
    if(ok)setMsg('Checklist atualizado.')
  }
  async function editarPendencia(item:InstalacaoItem){
    const valor=window.prompt('Descreva a pendência desta peça:',item.pendencia||'')
    if(valor==null)return
    const ok=await patch(item.id,'pendencia',{pendencia:valor.trim()})
    if(ok)setMsg(valor.trim()?'Pendência registrada.':'Pendência removida.')
  }
  async function anexarFoto(item:InstalacaoItem,file:File|null){
    if(!file||!obraId)return
    setSalvandoId(item.id);setErro('');setMsg('')
    const r=await adicionarDocumentoCliente({
      clienteId,obraId,titulo:`Instalação · ${item.ambiente||item.descricao||item.item_ref}`,
      arquivo:file,tipo:'instalacao_foto',observacoes:`venda=${vendaId}; item_ref=${item.item_ref}`,
    })
    setSalvandoId(null)
    if(!r.ok){setErro(r.error||'Não foi possível anexar a foto.');return}
    setMsg('Foto anexada à instalação.')
    await carregar()
  }

  const total=lista.reduce((s,x)=>s+Number(x.quantidade||0),0)
  const instaladas=lista.reduce((s,x)=>s+Math.min(Number(x.quantidade_instalada||0),Number(x.quantidade||0)),0)
  const pendentes=Math.max(0,total-instaladas)
  const comPendencia=lista.filter(x=>x.status==='pendencia'||Boolean(x.pendencia)).length
  // Visão Kanban derivada dos registros reais, não cria duplicatas no banco.
  // A mesma tipologia pode aparecer em 'Instalado' e 'Em instalação': são
  // subconjuntos diferentes, sem que o saldo pendente seja marcado como pronto.
  const kanbanInstalacao=[
    {id:'pendente',titulo:'A instalar',cor:'border-slate-300',linhas:lista.filter(x=>!x.pendencia&&x.status!=='pendencia'&&Number(x.quantidade_instalada||0)===0).map(item=>({item,quantidade:Math.max(0,Number(item.quantidade||0)),rotulo:'Falta instalar'})).filter(x=>x.quantidade>0)},
    {id:'parcial',titulo:'Em instalação',cor:'border-blue-300',linhas:lista.filter(x=>!x.pendencia&&x.status!=='pendencia'&&Number(x.quantidade_instalada||0)>0).map(item=>({item,quantidade:Math.max(0,Number(item.quantidade||0)-Number(item.quantidade_instalada||0)),rotulo:'Ainda falta'})).filter(x=>x.quantidade>0)},
    {id:'instalado',titulo:'Instalado',cor:'border-emerald-300',linhas:lista.map(item=>({item,quantidade:Math.min(Number(item.quantidade||0),Number(item.quantidade_instalada||0)),rotulo:'Instalado'})).filter(x=>x.quantidade>0)},
    {id:'pendencia',titulo:'Com pendência',cor:'border-amber-300',linhas:lista.filter(x=>x.status==='pendencia'||Boolean(x.pendencia)).map(item=>({item,quantidade:Math.max(0,Number(item.quantidade||0)-Number(item.quantidade_instalada||0)),rotulo:'A conferir'}))},
  ]
  const fotosPorRef=useMemo(()=>{
    const m:Record<string,Doc[]>={}
    docs.filter(d=>d.tipo==='instalacao_foto').forEach(d=>{
      const match=String(d.observacoes||'').match(/item_ref=([^;]+)/)
      if(match){const ref=match[1].trim();(m[ref]||(m[ref]=[])).push(d)}
    })
    return m
  },[docs])

  if(carregando)return <div className="rounded-xl border p-8 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Preparando instalação...</div>
  if(!obraId)return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Esta venda ainda não possui obra vinculada; o checklist será habilitado quando a obra existir.</div>

  return <div className="space-y-4">
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {msg&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
    {!ordens.some(o=>o.tipo_producao==='esquadria'&&o.status!=='cancelada')&&
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        A produção ainda não possui ordens de esquadria desta venda. É possível preparar fotos e pendências, mas registrar quantidades instaladas depende das peças produzidas e liberadas.
      </div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase text-slate-400">Status geral</p><p className="mt-1 text-lg font-bold text-slate-900">{statusGeral||'Ainda não gerada'}</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-bold uppercase text-emerald-600">Instalado</p><p className="mt-1 text-2xl font-bold text-emerald-700">{instaladas}</p><p className="text-xs text-emerald-700">de {total} peça(s)</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[11px] font-bold uppercase text-amber-600">Pendente</p><p className="mt-1 text-2xl font-bold text-amber-700">{pendentes}</p><p className="text-xs text-amber-700">{comPendencia} com pendência registrada</p></div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-[11px] font-bold uppercase text-blue-600">Progresso</p><p className="mt-1 text-2xl font-bold text-blue-700">{total?Math.round((instaladas/total)*100):0}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600" style={{width:`${total?Math.round((instaladas/total)*100):0}%`}}/></div></div>
    </div>

    <section aria-label="Kanban de Instalação por peça" className="space-y-3">
      <div><h3 className="text-sm font-bold text-slate-900">Kanban de instalação por peça</h3><p className="text-xs text-slate-500">Toque no card para conferir ou atualizar a quantidade. Uma tipologia parcialmente instalada aparece também na coluna Instalado, somente com as unidades concluídas.</p></div>
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kanbanInstalacao.map(coluna=><div key={coluna.id} className={'rounded-xl border-t-4 bg-slate-50 p-3 '+coluna.cor}>
          <div className="mb-3 flex items-center justify-between"><b className="text-xs text-slate-800">{coluna.titulo}</b><span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">{coluna.linhas.reduce((sum,x)=>sum+x.quantidade,0)} peça(s)</span></div>
          <div className="space-y-2">{coluna.linhas.map(({item,quantidade,rotulo})=><button type="button" key={item.id} onClick={()=>document.getElementById('instalacao-item-'+item.id)?.scrollIntoView({behavior:'smooth',block:'center'})}
            className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-300">
            <b className="block text-xs text-slate-800">{item.ambiente||item.descricao||item.item_ref}</b>
            <p className="mt-1 text-[11px] text-slate-600">{item.descricao||'Peça'}</p>
            <p className="mt-2 text-xs font-bold text-blue-700">{quantidade} unidade(s) · {rotulo}</p>
            {item.pendencia&&coluna.id==='pendencia'&&<p className="mt-1 text-[10px] text-amber-700">{item.pendencia}</p>}
          </button>)}{!coluna.linhas.length&&<p className="rounded-lg border border-dashed p-4 text-center text-[11px] text-slate-400">Nenhuma peça</p>}</div>
        </div>)}
      </div>
    </section>

    <div className="space-y-3">{lista.map(item=>{
      const checks={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{})}
      const producao=disponibilidadePeca(ordens,item.item_ref,Number(item.quantidade||0))
      const fotos=fotosPorRef[item.item_ref]||[]
      return <section key={item.id} id={'instalacao-item-'+item.id} className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{item.ambiente||'Sem ambiente'}</b><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${badge(item.status)}`}>{statusLabel(item.status)}</span>{item.pendencia&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700"><AlertTriangle size={11}/>Pendência</span>}</div><p className="mt-1 text-xs text-slate-500">{item.descricao||'Peça'} · Item {item.item_ref}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Instaladas <input type="number" min={0} max={producao.prontas} step={1} value={qtdEditando[item.id]??String(Number(item.quantidade_instalada||0))} disabled={salvandoId===item.id||(!producao.prontas&&!Number(item.quantidade_instalada||0))} onChange={e=>setQtdEditando(prev=>({...prev,[item.id]:e.target.value}))} onBlur={e=>void mudarQtd(item,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} className="ml-1 w-20 rounded-lg border px-2 py-1.5 text-sm font-bold text-slate-800 disabled:bg-slate-100"/></label><span className="text-xs text-slate-500">de <b>{Number(item.quantidade||0)}</b></span>
            <select disabled={salvandoId===item.id} value={item.status} onChange={e=>void mudarStatus(item,e.target.value as any)} className="rounded-lg border px-2 py-1.5 text-xs font-semibold"><option value="pendente">Pendente</option><option value="em_instalacao" disabled={producao.prontas<=0||producao.planejadas<=1}>Em instalação</option><option value="instalado" disabled={producao.prontas<producao.planejadas}>Instalado</option><option value="pendencia">Com pendência</option></select>
          </div>
        </div>

        <div className={'mt-3 rounded-lg border px-3 py-2 text-xs '+(producao.estado==='pronta'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-900')}>
          <b>Produção:</b> {producao.prontas} de {producao.planejadas} peça(s) concluída(s) e liberada(s).
          {producao.estado==='sem_ordem'?' Não existe ordem de esquadria vinculada a esta peça.':producao.faltantes>0?' Ainda faltam '+producao.faltantes+' peça(s) para instalar.':''}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CHECKS.map(([key,label])=><button key={key} type="button" disabled={salvandoId===item.id} onClick={()=>void toggleCheck(item,key)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${checks[key]?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-600'}`}>{checks[key]?<CheckCircle2 size={14}/>:<ClipboardCheck size={14}/>} {label}</button>)}</div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={()=>void editarPendencia(item)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">{item.pendencia?'Editar pendência':'Registrar pendência'}</button>
          <input ref={el=>{inputFoto.current[item.id]=el}} type="file" accept="image/*" className="hidden" onChange={e=>void anexarFoto(item,e.target.files?.[0]||null)}/>
          <button type="button" disabled={salvandoId===item.id} onClick={()=>inputFoto.current[item.id]?.click()} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><Camera size={13}/>Adicionar foto</button>
          {fotos.length>0&&<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"><ImageIcon size={11}/>{fotos.length} foto(s)</span>}
          {salvandoId===item.id&&<Loader2 size={14} className="animate-spin text-slate-400"/>}
        </div>
        {item.pendencia&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{item.pendencia}</div>}
        {fotos.length>0&&<div className="mt-3 flex flex-wrap gap-2">{fotos.slice(0,6).map(f=><a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="rounded-lg border bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700">{f.titulo}</a>)}</div>}
      </section>
    })}</div>

    {!lista.length&&<div className="rounded-xl border border-dashed p-8 text-center"><RefreshCw className="mx-auto text-slate-300"/><p className="mt-2 text-sm text-slate-500">Não há tipologias para preparar a instalação desta venda.</p></div>}
  </div>
}
