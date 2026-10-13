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
function descricao(item:any){return String(item?.tipo_outro_texto||item?.descricao||item?.tipo_esquadria||item?.tipologia_nome||item?.configuracao_nome||'Peça')}
function statusLabel(v:string){return v==='instalado'?'Finalizado':v==='em_instalacao'?'Em instalação':v==='pendencia'?'Com pendência / falta finalizar':'A instalar'}
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
  const [filtro,setFiltro]=useState<'todos'|'a_instalar'|'em_instalacao'|'com_pendencia'|'finalizados'>('todos')
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
    if(!vendaId){setCarregando(false);return}
    setCarregando(true);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente.')
      const resp=await fetch('/api/vendas/instalacao/preparar',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId}),cache:'no-store'
      })
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok)throw new Error(json.error||'Não foi possível preparar as tipologias vendidas.')
      await carregar()
      onAtualizar?.()
      if(!json.obraVinculada)setMsg('As tipologias do orçamento vendido estão disponíveis. Vincule uma obra para anexar fotos e concluir o processo geral de instalação.')
    }catch(e){
      const mensagem=e instanceof Error?e.message:'Falha ao preparar instalação.'
      await carregar()
      setErro(mensagem)
    }finally{setCarregando(false)}
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
    if(status==='pendencia'){
      const motivo=window.prompt('O que falta instalar ou finalizar nesta tipologia? Ex.: cantoneira, arremate, vedação.',item.pendencia||'')
      if(motivo===null)return
      if(!motivo.trim()){setErro('Descreva o que falta concluir antes de marcar uma pendência.');return}
      const ok=await patch(item.id,'pendencia',{pendencia:motivo.trim()})
      if(ok)setMsg('Pendência registrada sem finalizar a tipologia.')
      return
    }
    if(status==='instalado'&&!window.confirm('Finalizar esta tipologia? Confirme que todas as unidades foram instaladas, não há pendências e o checklist está completo.'))return
    if(status==='pendente'&&Number(item.quantidade_instalada||0)>0&&!window.confirm('Voltar esta tipologia a pendente também zera a quantidade instalada. Confirma a correção?'))return
    const ok=await patch(item.id,'status',{status})
    if(ok)setMsg(status==='instalado'?'Tipologia finalizada e conferida.':'Status da instalação atualizado.')
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
  const itensOriginais=useMemo(()=>new Map((Array.isArray(itens)?itens:[])
    .map((item,idx)=>[refItem(item,idx),item] as const)),[itens])
  const concluiu=(item:InstalacaoItem)=>{
    const checks={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{})}
    return item.status==='instalado'&&Number(item.quantidade_instalada||0)>=Number(item.quantidade||0)
      &&Number(item.quantidade||0)>0&&!String(item.pendencia||'').trim()
      &&CHECKS.every(([key])=>checks[key]===true)
  }
  const statusItem=(item:InstalacaoItem)=>{
    const qtd=Number(item.quantidade||0),inst=Number(item.quantidade_instalada||0)
    if(concluiu(item))return 'finalizados' as const
    if(inst>=qtd&&qtd>0||item.status==='pendencia'||Boolean(item.pendencia))return 'com_pendencia' as const
    if(inst>0)return 'em_instalacao' as const
    return 'a_instalar' as const
  }
  const kanbanEtapas=[
    {id:'a_instalar' as const,titulo:'A instalar',cor:'border-slate-300'},
    {id:'em_instalacao' as const,titulo:'Em instalação',cor:'border-blue-300'},
    {id:'com_pendencia' as const,titulo:'Pendência / falta finalizar',cor:'border-amber-300'},
    {id:'finalizados' as const,titulo:'Finalizadas',cor:'border-emerald-300'}
  ]
  const visiveis=lista.filter(item=>filtro==='todos'||statusItem(item)===filtro)
  const finalizadas=lista.filter(concluiu).length
  const itensComPendencia=lista.filter(item=>statusItem(item)==='com_pendencia').length
  const fotoTipologia=(item:any)=>{
    const origem=item?.wvetro_item||{}
    return String(item?.foto_url||item?.referencia_wvetro?.imagem_url||origem.URL||
      (Array.isArray(item?.foto_urls)?item.foto_urls.find((u:unknown)=>typeof u==='string'):null)||'')
  }
  const fotosPorRef=useMemo(()=>{
    const m:Record<string,Doc[]>={}
    docs.filter(d=>d.tipo==='instalacao_foto').forEach(d=>{
      const match=String(d.observacoes||'').match(/item_ref=([^;]+)/)
      if(match){const ref=match[1].trim();(m[ref]||(m[ref]=[])).push(d)}
    })
    return m
  },[docs])

  if(carregando)return <div className="rounded-xl border p-8 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Preparando instalação...</div>

  return <div className="space-y-4">
    {!obraId&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <b>Obra ainda sem vínculo.</b> As tipologias do orçamento vendido aparecem abaixo e podem receber checklists e registros de pendências.
      Para anexar fotos e concluir definitivamente, vincule a obra pelo botão no início da venda. Não serão criadas ordens de produção ou baixas de estoque automaticamente.
    </div>}
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {msg&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
    {!ordens.some(o=>o.tipo_producao==='esquadria'&&o.status!=='cancelada')&&
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        A produção ainda não possui ordens de esquadria desta venda. É possível preparar fotos e pendências, mas registrar quantidades instaladas depende das peças produzidas e liberadas.
      </div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase text-slate-400">Status geral</p><p className="mt-1 text-lg font-bold text-slate-900">{statusGeral||'Ainda não gerada'}</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-bold uppercase text-emerald-600">Instalado</p><p className="mt-1 text-2xl font-bold text-emerald-700">{instaladas}</p><p className="text-xs text-emerald-700">de {total} peça(s)</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[11px] font-bold uppercase text-amber-600">Pendente de instalação / finalização</p><p className="mt-1 text-2xl font-bold text-amber-700">{pendentes} peça(s)</p><p className="text-xs text-amber-700">{itensComPendencia} tipologia(s) com serviço a finalizar</p></div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-[11px] font-bold uppercase text-blue-600">Progresso físico (não é finalização)</p><p className="mt-1 text-2xl font-bold text-blue-700">{total?Math.round((instaladas/total)*100):0}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600" style={{width:`${total?Math.round((instaladas/total)*100):0}%`}}/></div></div>
    </div>

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-bold text-slate-900">Kanban de instalação por tipologia</h3><p className="text-xs text-slate-500">{lista.length} tipologia(s) do orçamento vendido · {finalizadas} finalizada(s). Clique em um card para conferir a instalação.</p></div>
        {filtro!=='todos'&&<button type="button" onClick={()=>setFiltro('todos')} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Mostrar todas as tipologias</button>}
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kanbanEtapas.map(etapa=><div key={etapa.id} className={'rounded-xl border-t-4 bg-slate-50 p-3 '+etapa.cor}>
          <button type="button" onClick={()=>setFiltro(filtro===etapa.id?'todos':etapa.id)} className="mb-3 flex w-full items-center justify-between text-left">
            <b className="text-xs text-slate-800">{etapa.titulo}</b>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{lista.filter(x=>statusItem(x)===etapa.id).length}</span>
          </button>
          <div className="space-y-2">{lista.filter(x=>statusItem(x)===etapa.id).map(x=>{
            const original=itensOriginais.get(x.item_ref)
            const imagem=fotoTipologia(original)
            return <button type="button" key={x.id} onClick={()=>{setFiltro('todos');setTimeout(()=>document.getElementById('instalar-'+x.id)?.scrollIntoView({behavior:'smooth',block:'center'}),20)}}
              className="flex w-full items-center gap-2 rounded-lg border bg-white p-2.5 text-left shadow-sm hover:border-blue-300">
              {imagem?<img src={imagem} alt={'Tipologia '+x.descricao} className="h-12 w-12 rounded border object-contain"/>:<span className="flex h-12 w-12 items-center justify-center rounded border text-slate-400"><ImageIcon size={18}/></span>}
              <span className="min-w-0 flex-1"><b className="block text-xs text-slate-900">{x.ambiente||'Ambiente não informado'}</b><span className="block truncate text-[11px] text-slate-600">{x.descricao}</span>
                <span className="mt-1 block text-[11px] font-semibold text-blue-700">{x.quantidade_instalada}/{x.quantidade} instaladas</span>
                {x.pendencia&&<span className="block truncate text-[10px] text-amber-700">{x.pendencia}</span>}
              </span>
            </button>
          })}
          {!lista.some(x=>statusItem(x)===etapa.id)&&<p className="rounded-lg border border-dashed p-4 text-center text-[11px] text-slate-400">Nenhuma tipologia</p>}
          </div>
        </div>)}
      </div>
    </section>

    <div className="space-y-3">{visiveis.map(item=>{
      const checks={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{})}
      const producao=disponibilidadePeca(ordens,item.item_ref,Number(item.quantidade||0))
      const fotos=fotosPorRef[item.item_ref]||[]
      const original=itensOriginais.get(item.item_ref)
      const imagem=fotoTipologia(original)
      const larg=Number(original?.largura_mm||0),alt=Number(original?.altura_mm||0)
      const fisicamenteInstalada=Number(item.quantidade_instalada||0)>=Number(item.quantidade||0)
      const pendenciaFinal=!!item.pendencia||(!concluiu(item)&&fisicamenteInstalada)
      return <section key={item.id} id={'instalar-'+item.id} className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {imagem?<img src={imagem} alt={'Tipologia '+item.descricao} className="h-24 w-24 shrink-0 rounded-lg border object-contain"/>:<div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-400"><ImageIcon size={24}/></div>}
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{item.ambiente||'Sem ambiente'}</b><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${badge(item.status)}`}>{statusLabel(item.status)}</span>{item.pendencia&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700"><AlertTriangle size={11}/>Pendência</span>}</div><p className="mt-1 text-xs text-slate-500">{item.descricao||'Peça'} · Item {item.item_ref}</p>
              {Boolean(larg&&alt)&&<p className="mt-1 text-xs font-semibold text-slate-700">Medidas: {larg.toLocaleString('pt-BR')} × {alt.toLocaleString('pt-BR')} mm</p>}
              {original?.linha_nome&&<p className="text-[11px] text-slate-500">Linha: {String(original.linha_nome)}</p>}
              {pendenciaFinal&&<p className="mt-1 text-xs font-bold text-amber-700">{fisicamenteInstalada?'Peça instalada — falta finalizar':'Instalação com pendência'}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Instaladas <input type="number" min={0} max={producao.prontas} step={1} value={qtdEditando[item.id]??String(Number(item.quantidade_instalada||0))} disabled={salvandoId===item.id||(!producao.prontas&&!Number(item.quantidade_instalada||0))} onChange={e=>setQtdEditando(prev=>({...prev,[item.id]:e.target.value}))} onBlur={e=>void mudarQtd(item,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} className="ml-1 w-20 rounded-lg border px-2 py-1.5 text-sm font-bold text-slate-800 disabled:bg-slate-100"/></label><span className="text-xs text-slate-500">de <b>{Number(item.quantidade||0)}</b></span>
            <select disabled={salvandoId===item.id} value={item.status} onChange={e=>void mudarStatus(item,e.target.value as any)} className="rounded-lg border px-2 py-1.5 text-xs font-semibold">
              <option value="pendente">A instalar</option>
              <option value="em_instalacao" disabled={producao.prontas<=0||producao.planejadas<=1||Number(item.quantidade_instalada||0)<=0||Number(item.quantidade_instalada||0)>=Number(item.quantidade||0)}>Instalação parcial</option>
              <option value="pendencia">Com pendência / falta finalizar</option>
              <option value="instalado" disabled={producao.prontas<producao.planejadas||!obraId}>Finalizado e conferido</option>
            </select>
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
          <button type="button" disabled={salvandoId===item.id||!obraId} title={!obraId?'Vincule a obra para anexar fotos':undefined} onClick={()=>inputFoto.current[item.id]?.click()} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><Camera size={13}/>Adicionar foto</button>
          {fisicamenteInstalada&&!concluiu(item)&&<button type="button" disabled={salvandoId===item.id||!obraId||!!item.pendencia||!CHECKS.every(([key])=>checks[key]===true)} onClick={()=>void mudarStatus(item,'instalado')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><CheckCircle2 size={13}/>Finalizar esta tipologia</button>}
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
