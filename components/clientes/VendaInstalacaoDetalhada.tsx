'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { adicionarDocumentoCliente } from '@/lib/cliente360'
import { tokenAtual } from '@/lib/auth'
import { refItemProducaoInstalacao, type OrdemParaInstalacao } from '@/lib/vendaInstalacaoProducao'
import { etapaKanbanInstalacao } from '@/lib/instalacaoKanban'

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
  const [docs,setDocs]=useState<Doc[]>([])
  const [carregando,setCarregando]=useState(true)
  const [salvandoId,setSalvandoId]=useState<string|null>(null)
  const [erro,setErro]=useState('')
  const [msg,setMsg]=useState('')
  const [arrastandoId,setArrastandoId]=useState<string|null>(null)
  const [colunaDestino,setColunaDestino]=useState<string|null>(null)
  const [pendenciaItem,setPendenciaItem]=useState<InstalacaoItem|null>(null)
  const [textoPendencia,setTextoPendencia]=useState('')
  const [fotoPendencia,setFotoPendencia]=useState<File|null>(null)
  const [acaoItem,setAcaoItem]=useState<InstalacaoItem|null>(null)
  const [quantidadeAcao,setQuantidadeAcao]=useState('')
  const [enviandoFotosCard,setEnviandoFotosCard]=useState(false)
  const [finalizacaoItem,setFinalizacaoItem]=useState<InstalacaoItem|null>(null)
  const [fotosFinalizacao,setFotosFinalizacao]=useState<File[]>([])
  const [pendenciaResolvida,setPendenciaResolvida]=useState(false)
  const [finalizacaoSalva,setFinalizacaoSalva]=useState(false)
  const [enviandoFotos,setEnviandoFotos]=useState(false)

  async function carregar(){
    if(!vendaId){setCarregando(false);return}
    setCarregando(true);setErro('')
    const [ir,dr,pr]=await Promise.all([
      supabase.from('venda_instalacao_itens').select('*').eq('venda_obra_id',vendaId).order('created_at'),
      supabase.from('cliente_documentos').select('id,titulo,url,tipo,observacoes,created_at').eq('cliente_id',clienteId).eq('tipo','instalacao_foto').order('created_at',{ascending:false}),
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
      if(!json.obraVinculada)setMsg('As tipologias estão disponíveis para a instalação física. O vínculo administrativo com a obra pode ser feito depois.')
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
      onAtualizar?.()
      return true
    }catch(e){
      setErro(e instanceof Error?e.message:'Falha ao registrar instalação.')
      return false
    }finally{setSalvandoId(null)}
  }

  async function mudarStatus(item:InstalacaoItem,status:'pendente'|'em_instalacao'|'instalado'|'pendencia'){
    if(status==='pendencia'){abrirPendencia(item);return}
    if(status==='instalado'){abrirFinalizacao(item);return}
    if(String(item.pendencia||'').trim()){
      setErro('Resolva a pendência ou confirme sua resolução ao finalizar a tipologia.')
      return
    }
    if(status==='pendente'&&Number(item.quantidade_instalada||0)>0
      &&!window.confirm('Voltar para A instalar irá zerar a quantidade registrada como instalada. Confirma?'))return
    if(status==='em_instalacao'&&item.status==='instalado'
      &&!window.confirm('Reabrir a instalação irá zerar a quantidade finalizada para nova conferência. Confirma?'))return
    const ok=await patch(item.id,'status',{status})
    if(ok)setMsg('Etapa de instalação atualizada.')
  }
  function abrirPendencia(item:InstalacaoItem){
    setPendenciaItem(item)
    setTextoPendencia(item.pendencia||'')
    setFotoPendencia(null)
    setErro('')
  }
  async function salvarPendencia(){
    if(!pendenciaItem)return
    const texto=textoPendencia.trim()
    if(!texto&&!(pendenciaItem.pendencia||'').trim()){setErro('Descreva a pendência antes de salvar.');return}
    const ok=await patch(pendenciaItem.id,'pendencia',{pendencia:texto})
    if(!ok)return
    // A descrição é persistida primeiro. Uma falha no anexo não perde o registro.
    if(fotoPendencia){
      const fotoOk=await anexarFoto(pendenciaItem,fotoPendencia)
      if(!fotoOk)return
    }
    setPendenciaItem(null)
    setFotoPendencia(null)
    setMsg(texto?'Pendência registrada; a tipologia não foi finalizada.':'Pendência removida. A tipologia pode ser finalizada quando estiver instalada.')
  }
  function abrirAcoes(item:InstalacaoItem){
    setAcaoItem(item)
    setQuantidadeAcao(String(item.quantidade_instalada||0))
    setErro('')
  }
  async function salvarQuantidadeAcao(){
    if(!acaoItem)return
    const qtd=Number(quantidadeAcao)
    if(!Number.isInteger(qtd)||qtd<0||qtd>Number(acaoItem.quantidade)){
      setErro('Informe uma quantidade inteira entre zero e a quantidade prevista.')
      return
    }
    if(qtd===Number(acaoItem.quantidade_instalada||0))return
    const ok=await patch(acaoItem.id,'quantidade',{quantidade:qtd})
    if(ok){setAcaoItem(null);setMsg('Quantidade instalada atualizada.')}
  }
  async function anexarFotosCard(item:InstalacaoItem,arquivos:File[]){
    if(!arquivos.length)return
    setEnviandoFotosCard(true)
    let enviadas=0
    for(const arquivo of arquivos){
      if(!await anexarFoto(item,arquivo))break
      enviadas+=1
    }
    setEnviandoFotosCard(false)
    if(enviadas===arquivos.length)setMsg(enviadas+' foto(s) anexada(s) à instalação.')
    else setErro(enviadas+' de '+arquivos.length+' foto(s) anexada(s). Reenvie as restantes.')
  }
  function abrirFinalizacao(item:InstalacaoItem){
    setAcaoItem(null)
    setFinalizacaoItem(item)
    setFotosFinalizacao([])
    setPendenciaResolvida(false)
    setFinalizacaoSalva(etapaKanbanInstalacao(item)==='finalizados')
    setErro('')
  }
  async function salvarFinalizacao(){
    if(!finalizacaoItem||enviandoFotos||salvandoId)return
    const item=finalizacaoItem
    if(!finalizacaoSalva){
      if(item.pendencia&&!pendenciaResolvida){
        setErro('Confirme que a pendência foi resolvida para finalizar.')
        return
      }
      const ok=await patch(item.id,'status',{
        status:'instalado',confirmadoInstalado:true,resolverPendencia:!!item.pendencia&&pendenciaResolvida
      })
      if(!ok)return
      setFinalizacaoSalva(true)
    }
    if(fotosFinalizacao.length){
      setEnviandoFotos(true)
      let anexadas=0
      for(const foto of fotosFinalizacao){
        const ok=await anexarFoto(item,foto)
        if(!ok){
          setFotosFinalizacao(anteriores=>anteriores.slice(anexadas))
          setEnviandoFotos(false)
          setErro('A instalação foi finalizada. Algumas fotos não foram anexadas; tente novamente para enviar as restantes.')
          return
        }
        anexadas+=1
      }
      setEnviandoFotos(false)
      setMsg('Instalação finalizada. '+anexadas+' foto(s) anexada(s).')
    }else{
      setMsg('Instalação finalizada. Fotos são opcionais e podem ser enviadas depois.')
    }
    setFinalizacaoItem(null)
    setFotosFinalizacao([])
  }
  async function soltarCard(destino:string,id:string){
    const item=lista.find(x=>x.id===id)
    if(!item||etapaKanbanInstalacao(item)===destino)return
    setAcaoItem(null)
    if(destino==='com_pendencia'){abrirPendencia(item);return}
    if(destino==='finalizados'){abrirFinalizacao(item);return}
    if(destino==='em_instalacao'){await mudarStatus(item,'em_instalacao');return}
    if(destino==='a_instalar')await mudarStatus(item,'pendente')
  }
  async function anexarFoto(item:InstalacaoItem,file:File|null):Promise<boolean>{
    if(!file)return false
    if(!file.type.startsWith('image/')){setErro('Selecione apenas arquivos de imagem.');return false}
    if(file.size>25*1024*1024){setErro('A foto deve ter até 25 MB.');return false}
    setSalvandoId(item.id);setErro('');setMsg('')
    try{
    const r=await adicionarDocumentoCliente({
      clienteId,obraId,titulo:`Instalação · ${item.ambiente||item.descricao||item.item_ref}`,
      arquivo:file,tipo:'instalacao_foto',observacoes:`venda=${vendaId}; item_ref=${item.item_ref}`,
    })
    if(!r.ok){setErro(r.error||'Não foi possível anexar a foto. O registro da instalação foi preservado.');return false}
    // Atualiza só a lista de fotos, sem recarregar nem interromper o Kanban.
    if(r.documento)setDocs(atual=>[r.documento as Doc,...atual])
    setMsg('Foto anexada à instalação.')
    return true
    }catch{
      setErro('Falha de conexão ao anexar foto. O registro da instalação foi preservado.')
      return false
    }finally{setSalvandoId(null)}
  }

  const total=lista.reduce((s,x)=>s+Number(x.quantidade||0),0)
  const instaladas=lista.reduce((s,x)=>s+Math.min(Number(x.quantidade_instalada||0),Number(x.quantidade||0)),0)
  const pendentes=Math.max(0,total-instaladas)
  const itensOriginais=useMemo(()=>new Map((Array.isArray(itens)?itens:[])
    .map((item,idx)=>[refItem(item,idx),item] as const)),[itens])
  const concluiu=(item:InstalacaoItem)=>etapaKanbanInstalacao(item)==='finalizados'
  const statusItem=etapaKanbanInstalacao
  const kanbanEtapas=[
    {id:'a_instalar' as const,titulo:'A instalar',cor:'border-slate-300'},
    {id:'em_instalacao' as const,titulo:'Em instalação',cor:'border-blue-300'},
    {id:'com_pendencia' as const,titulo:'Pendência / falta finalizar',cor:'border-amber-300'},
    {id:'finalizados' as const,titulo:'Finalizadas',cor:'border-emerald-300'}
  ]
  const finalizadas=lista.filter(concluiu).length
  const itensComPendencia=lista.filter(item=>statusItem(item)==='com_pendencia').length
  const fotoTipologia=(item:any)=>{
    const origem=item?.wvetro_item||{}
    return String(item?.foto_url||item?.referencia_wvetro?.imagem_url||origem.URL||
      (Array.isArray(item?.foto_urls)?item.foto_urls.find((u:unknown)=>typeof u==='string'):null)||'')
  }
  const fotosPorRef=useMemo(()=>{
    const m:Record<string,Doc[]>={}
    docs.filter(d=>d.tipo==='instalacao_foto'&&String(d.observacoes||'').includes('venda='+vendaId+';')).forEach(d=>{
      const match=String(d.observacoes||'').match(/item_ref=([^;]+)/)
      if(match){const ref=match[1].trim();(m[ref]||(m[ref]=[])).push(d)}
    })
    return m
  },[docs])

  if(carregando)return <div className="rounded-xl border p-8 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Preparando instalação...</div>

  return <div className="space-y-4">
    {!obraId&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <b>Obra ainda sem vínculo.</b> As tipologias do orçamento vendido aparecem abaixo e podem receber checklists e registros de pendências.
      Fotos e pendências podem ser registradas nesta venda. O vínculo administrativo pode ser feito depois e não impede finalizar a instalação física. Não serão criadas ordens de produção ou baixas de estoque automaticamente.
    </div>}
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    {msg&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
    {!ordens.some(o=>o.tipo_producao==='esquadria'&&o.status!=='cancelada')&&
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Não há ordem de esquadria vinculada a esta venda. A confirmação física de instalação permanece disponível, sem alterar os registros de produção.
      </div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase text-slate-400">Status geral</p><p className="mt-1 text-lg font-bold text-slate-900">{statusGeral||'Ainda não gerada'}</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-bold uppercase text-emerald-600">Instalado</p><p className="mt-1 text-2xl font-bold text-emerald-700">{instaladas}</p><p className="text-xs text-emerald-700">de {total} peça(s)</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[11px] font-bold uppercase text-amber-600">Pendente de instalação / finalização</p><p className="mt-1 text-2xl font-bold text-amber-700">{pendentes} peça(s)</p><p className="text-xs text-amber-700">{itensComPendencia} tipologia(s) com serviço a finalizar</p></div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-[11px] font-bold uppercase text-blue-600">Progresso físico (não é finalização)</p><p className="mt-1 text-2xl font-bold text-blue-700">{total?Math.round((instaladas/total)*100):0}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600" style={{width:`${total?Math.round((instaladas/total)*100):0}%`}}/></div></div>
    </div>

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-bold text-slate-900">Kanban de instalação por tipologia</h3><p className="text-xs text-slate-500">{lista.length} tipologia(s) do orçamento vendido · {finalizadas} finalizada(s). Clique no card para ações ou arraste entre as etapas.</p></div>
      </div>
      <p className="text-[11px] text-slate-500">Arraste para Pendência e descreva o que falta. Arraste para Finalizadas, confirme a instalação e, se desejar, anexe várias fotos. Fotos não são obrigatórias.</p>
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kanbanEtapas.map(etapa=><div key={etapa.id}
          onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';setColunaDestino(etapa.id)}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setColunaDestino(null)}}
          onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain')||arrastandoId||'';setArrastandoId(null);setColunaDestino(null);void soltarCard(etapa.id,id)}}
          className={'rounded-xl border-t-4 bg-slate-50 p-3 transition-colors '+etapa.cor+(colunaDestino===etapa.id?' ring-2 ring-blue-400 bg-blue-50':'')}>
          <div className="mb-3 flex w-full items-center justify-between text-left">
            <b className="text-xs text-slate-800">{etapa.titulo}</b>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{lista.filter(x=>statusItem(x)===etapa.id).length}</span>
          </div>
          <div className="space-y-2">{lista.filter(x=>statusItem(x)===etapa.id).map(x=>{
            const original=itensOriginais.get(x.item_ref)
            const imagem=fotoTipologia(original)
            return <button type="button" key={x.id} draggable={salvandoId===null}
              onDragStart={e=>{e.dataTransfer.setData('text/plain',x.id);e.dataTransfer.effectAllowed='move';setArrastandoId(x.id)}}
              onDragEnd={()=>{setArrastandoId(null);setColunaDestino(null)}}
              aria-label={'Arrastar '+(x.ambiente||x.descricao||'tipologia')+' para outra etapa ou clicar para opções'}
              onClick={()=>abrirAcoes(x)}
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

    {acaoItem&&<div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvandoId&&!enviandoFotosCard)setAcaoItem(null)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-acoes-instalacao" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <h3 id="titulo-acoes-instalacao" className="text-base font-bold text-slate-900">{acaoItem.ambiente||'Tipologia'}</h3>
        <p className="mt-1 text-xs text-slate-600">{acaoItem.descricao} · {acaoItem.quantidade_instalada}/{acaoItem.quantidade} instalada(s).</p>
        <p className="mt-2 text-xs font-semibold text-slate-700">Etapa atual: {statusLabel(acaoItem.status)}</p>
        {acaoItem.pendencia&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Pendência: {acaoItem.pendencia}</div>}
        {(fotosPorRef[acaoItem.item_ref]||[]).length>0&&<div className="mt-3">
          <p className="text-xs font-semibold text-slate-700">Fotos registradas</p>
          <div className="mt-2 flex flex-wrap gap-2">{(fotosPorRef[acaoItem.item_ref]||[]).map((f,i)=><a key={f.id} href={f.url} target="_blank" rel="noreferrer" title={'Ver foto '+(i+1)}><img src={f.url} alt={'Foto da instalação '+(i+1)} className="h-20 w-20 rounded-lg border object-cover"/></a>)}</div>
        </div>}
        <div className="mt-4 rounded-lg border bg-slate-50 p-3">
          <label className="text-xs font-semibold text-slate-700">Quantidade já instalada (registro parcial)
            <input type="number" min={0} max={acaoItem.quantidade} step={1} value={quantidadeAcao}
              disabled={!!salvandoId||enviandoFotosCard} onChange={e=>setQuantidadeAcao(e.target.value)}
              className="ml-2 w-20 rounded border px-2 py-1 text-sm"/>
          </label>
          <button type="button" disabled={!!salvandoId||enviandoFotosCard}
            onClick={()=>void salvarQuantidadeAcao()} className="ml-2 rounded border bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50">Salvar quantidade</button>
          <p className="mt-1 text-[11px] text-slate-500">O registro parcial segue as conferências de produção. Para concluir a instalação física, use Finalizadas.</p>
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-700">Adicionar fotos da instalação (opcional)
          <input type="file" accept="image/*" multiple disabled={!!salvandoId||enviandoFotosCard}
            onChange={e=>{const arquivos=Array.from(e.target.files||[]);e.target.value='';void anexarFotosCard(acaoItem,arquivos)}}
            className="mt-1 block w-full rounded border p-2 text-xs font-normal"/>
        </label>
        {erro&&<p role="alert" className="mt-2 text-xs font-semibold text-red-700">{erro}</p>}
        <p className="mt-4 text-xs text-slate-500">Escolha a etapa ou arraste o card diretamente no Kanban.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {kanbanEtapas.filter(e=>e.id!==statusItem(acaoItem)).map(e=><button key={e.id} type="button"
            disabled={!!salvandoId||enviandoFotosCard} onClick={()=>void soltarCard(e.id,acaoItem.id)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{e.titulo}</button>)}
          {statusItem(acaoItem)==='finalizados'&&<button type="button" onClick={()=>abrirFinalizacao(acaoItem)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700">Adicionar fotos</button>}
          {statusItem(acaoItem)==='com_pendencia'&&<button type="button" onClick={()=>{const x=acaoItem;setAcaoItem(null);abrirPendencia(x)}} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700">Editar pendência</button>}
        </div>
        <div className="mt-4 flex justify-end"><button type="button" disabled={!!salvandoId||enviandoFotosCard} onClick={()=>setAcaoItem(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Fechar</button></div>
      </div>
    </div>}

    {finalizacaoItem&&<div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvandoId&&!enviandoFotos)setFinalizacaoItem(null)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-finalizacao-instalacao" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <h3 id="titulo-finalizacao-instalacao" className="text-base font-bold text-slate-900">{finalizacaoSalva?'Fotos da instalação':'Finalizar instalação'}</h3>
        <p className="mt-1 text-xs text-slate-600">{finalizacaoItem.ambiente||finalizacaoItem.descricao} · {finalizacaoItem.quantidade} peça(s) previstas.</p>
        {!finalizacaoSalva&&<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Confirme que todas as peças desta tipologia estão instaladas. Esta confirmação não altera produção ou estoque e não depende do vínculo administrativo da obra.</p>}
        {!finalizacaoSalva&&!!finalizacaoItem.pendencia&&<label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <input type="checkbox" checked={pendenciaResolvida} onChange={e=>setPendenciaResolvida(e.target.checked)} className="mt-0.5"/>
          <span>A pendência foi resolvida: {finalizacaoItem.pendencia}</span>
        </label>}
        <label className="mt-4 block text-xs font-semibold text-slate-700">Fotos da esquadria instalada (opcional — pode selecionar várias)
          <input type="file" accept="image/*" multiple disabled={!!salvandoId||enviandoFotos}
            onChange={e=>setFotosFinalizacao(Array.from(e.target.files||[]))}
            className="mt-2 block w-full rounded-lg border p-2 text-xs font-normal"/>
        </label>
        {fotosFinalizacao.length>0&&<p className="mt-2 text-xs text-slate-600">{fotosFinalizacao.length} imagem(ns) selecionada(s). {fotosFinalizacao.map(f=>f.name).join(', ')}</p>}
        {finalizacaoSalva&&<p className="mt-3 text-xs font-semibold text-emerald-700">A instalação já foi finalizada. As fotos podem ser adicionadas agora ou mais tarde.</p>}
        {erro&&<p role="alert" className="mt-3 text-xs text-red-700">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={!!salvandoId||enviandoFotos} onClick={()=>{setFinalizacaoItem(null);setErro('')}} className="rounded-lg border px-4 py-2 text-sm font-semibold">Fechar</button>
          <button type="button" disabled={!!salvandoId||enviandoFotos||(!finalizacaoSalva&&!!finalizacaoItem.pendencia&&!pendenciaResolvida)}
            onClick={()=>void salvarFinalizacao()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {salvandoId||enviandoFotos?'Salvando...':finalizacaoSalva?'Salvar fotos / concluir':'Confirmar finalização'}
          </button>
        </div>
      </div>
    </div>}

    {pendenciaItem&&<div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvandoId)setPendenciaItem(null)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-pendencia-instalacao" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <h3 id="titulo-pendencia-instalacao" className="text-base font-bold text-slate-900">Registrar pendência de instalação</h3>
        <p className="mt-1 text-xs text-slate-600">{pendenciaItem.ambiente||pendenciaItem.descricao} · {pendenciaItem.quantidade_instalada}/{pendenciaItem.quantidade} instalada(s). A tipologia continuará pendente até ser conferida e finalizada.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-700">O que está faltando? <span className="text-red-500">*</span>
          <textarea rows={4} maxLength={1000} autoFocus value={textoPendencia} onChange={e=>setTextoPendencia(e.target.value)} placeholder="Ex.: Porta instalada, mas falta colocar a cantoneira, fazer o arremate e conferir a vedação." className="mt-1 block w-full resize-y rounded-lg border p-3 text-sm font-normal text-slate-800"/>
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-700">Foto da pendência (opcional)
          <input type="file" accept="image/*" onChange={e=>setFotoPendencia(e.target.files?.[0]||null)} className="mt-1 block w-full rounded-lg border p-2 text-xs font-normal"/>
        </label>
        {erro&&<p className="mt-3 text-xs text-red-700" role="alert">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={!!salvandoId} onClick={()=>{setPendenciaItem(null);setErro('')}} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button>
          <button type="button" disabled={!!salvandoId||(!textoPendencia.trim()&&!pendenciaItem.pendencia)} onClick={()=>void salvarPendencia()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvandoId?'Salvando...':textoPendencia.trim()?'Salvar pendência':'Remover pendência'}</button>
        </div>
      </div>
    </div>}
    {!lista.length&&<div className="rounded-xl border border-dashed p-8 text-center"><RefreshCw className="mx-auto text-slate-300"/><p className="mt-2 text-sm text-slate-500">Não há tipologias para preparar a instalação desta venda.</p></div>}
  </div>
}
