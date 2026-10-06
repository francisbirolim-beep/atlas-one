'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircleMore, ShieldCheck, UserRoundCheck, Users } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Canal = {
  id: string
  nome: string
  numero_declarado?: string | null
  numero_conectado?: string | null
  principal?: boolean
  gateway_status?: string | null
  usuario_id?: string | null
  usuario_nome?: string | null
}

type PermissaoCanal = {
  id?: string
  canal_id: string
  usuario_id: string
  pode_visualizar: boolean
  pode_atender: boolean
  pode_transferir: boolean
  pode_supervisionar: boolean
}

type Grupo = {
  id: string
  whatsapp_canal_id: string
  nome: string
  participantes?: number | null
}

type PermissaoGrupo = {
  id?: string
  grupo_id: string
  usuario_id: string
  nivel: 'sem_acesso' | 'acompanhar' | 'atender' | 'gerenciar'
  responsavel_principal: boolean
}

type ResponsavelGrupo = {
  grupo_id: string
  usuario_id: string
  usuario_nome?: string | null
  nivel: string
  responsavel_principal: boolean
}

type Props = {
  usuarioId: string
  usuarioNome: string
  usuarioRole?: string | null
}

async function headersJson() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

function numeroFormatado(valor?: string | null) {
  const n = String(valor || '').replace(/\D/g,'')
  if (n.startsWith('55') && n.length >= 12) {
    const ddd=n.slice(2,4)
    const local=n.slice(4)
    return `+55 (${ddd}) ${local.length===9?local.slice(0,5):local.slice(0,4)}-${local.length===9?local.slice(5):local.slice(4)}`
  }
  return valor || ''
}

export default function WhatsAppUsuarioPermissoes({ usuarioId, usuarioNome, usuarioRole }: Props) {
  const [canais,setCanais]=useState<Canal[]>([])
  const [permissoes,setPermissoes]=useState<PermissaoCanal[]>([])
  const [grupos,setGrupos]=useState<Grupo[]>([])
  const [gruposPermissoes,setGruposPermissoes]=useState<PermissaoGrupo[]>([])
  const [responsaveis,setResponsaveis]=useState<ResponsavelGrupo[]>([])
  const [carregando,setCarregando]=useState(true)
  const [salvando,setSalvando]=useState('')
  const [erro,setErro]=useState('')
  const [abertos,setAbertos]=useState<Record<string,boolean>>({})

  async function carregar(silencioso=false){
    if(!silencioso)setCarregando(true)
    setErro('')
    try{
      const headers=await headersJson()
      const resp=await fetch(
        `/api/integracoes/whatsapp/usuarios/permissoes?usuarioId=${encodeURIComponent(usuarioId)}`,
        {headers,cache:'no-store'},
      )
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel carregar as permissoes do WhatsApp.')
      setCanais(json.canais||[])
      setPermissoes(json.permissoes||[])
      setGrupos(json.grupos||[])
      setGruposPermissoes(json.gruposPermissoes||[])
      setResponsaveis(json.responsaveis||[])
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel carregar as permissoes do WhatsApp.')
    }finally{
      if(!silencioso)setCarregando(false)
    }
  }

  useEffect(()=>{void carregar()},[usuarioId])

  useEffect(()=>{
    const atualizar=()=>{if(document.visibilityState==='visible')void carregar(true)}
    const timer=setInterval(atualizar,5000)
    window.addEventListener('focus',atualizar)
    document.addEventListener('visibilitychange',atualizar)
    return()=>{
      clearInterval(timer)
      window.removeEventListener('focus',atualizar)
      document.removeEventListener('visibilitychange',atualizar)
    }
  },[usuarioId])

  const porCanal=useMemo(
    ()=>new Map(permissoes.map(p=>[p.canal_id,p])),
    [permissoes],
  )
  const porGrupo=useMemo(
    ()=>new Map(gruposPermissoes.map(p=>[p.grupo_id,p])),
    [gruposPermissoes],
  )
  const responsavelPorGrupo=useMemo(
    ()=>new Map(responsaveis.map(p=>[p.grupo_id,p])),
    [responsaveis],
  )

  function permissaoCanal(canalId:string):PermissaoCanal{
    return porCanal.get(canalId)||{
      canal_id:canalId,
      usuario_id:usuarioId,
      pode_visualizar:false,
      pode_atender:false,
      pode_transferir:false,
      pode_supervisionar:false,
    }
  }

  async function salvarCanal(
    canalId:string,
    campo:'pode_visualizar'|'pode_atender'|'pode_transferir'|'pode_supervisionar',
    valor:boolean,
  ){
    const atual=permissaoCanal(canalId)
    const proxima={...atual,[campo]:valor}
    if(campo!=='pode_visualizar'&&valor)proxima.pode_visualizar=true
    if(campo==='pode_visualizar'&&!valor){
      proxima.pode_atender=false
      proxima.pode_transferir=false
      proxima.pode_supervisionar=false
    }
    const chave=`canal:${canalId}`
    setSalvando(chave);setErro('')
    setPermissoes(lista=>[
      ...lista.filter(p=>p.canal_id!==canalId),
      proxima,
    ])
    try{
      const headers=await headersJson()
      const resp=await fetch('/api/integracoes/whatsapp/canais/permissoes',{
        method:'PUT',headers,
        body:JSON.stringify({
          canalId,
          usuarioId,
          podeVisualizar:proxima.pode_visualizar,
          podeAtender:proxima.pode_atender,
          podeTransferir:proxima.pode_transferir,
          podeSupervisionar:proxima.pode_supervisionar,
        }),
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel salvar o acesso ao numero.')
      setPermissoes(lista=>[
        ...lista.filter(p=>p.canal_id!==canalId),
        json.permissao,
      ])
    }catch(e){
      setPermissoes(lista=>[
        ...lista.filter(p=>p.canal_id!==canalId),
        atual,
      ])
      setErro(e instanceof Error?e.message:'Nao foi possivel salvar o acesso ao numero.')
    }finally{setSalvando('')}
  }

  async function salvarGrupo(
    grupoId:string,
    nivel:'herdar'|'sem_acesso'|'acompanhar'|'atender'|'gerenciar',
    responsavelPrincipal=false,
  ){
    const chave=`grupo:${grupoId}`
    setSalvando(chave);setErro('')
    try{
      const headers=await headersJson()
      if(nivel==='herdar'){
        const resp=await fetch(
          `/api/integracoes/whatsapp/grupos/permissoes?grupoId=${encodeURIComponent(grupoId)}&usuarioId=${encodeURIComponent(usuarioId)}`,
          {method:'DELETE',headers},
        )
        const json=await resp.json()
        if(!resp.ok)throw new Error(json.error||'Nao foi possivel remover a regra especifica do grupo.')
      }else{
        const resp=await fetch('/api/integracoes/whatsapp/grupos/permissoes',{
          method:'PUT',headers,
          body:JSON.stringify({grupoId,usuarioId,nivel,responsavelPrincipal}),
        })
        const json=await resp.json()
        if(!resp.ok)throw new Error(json.error||'Nao foi possivel salvar a permissao do grupo.')
      }
      await carregar(true)
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel salvar a permissao do grupo.')
    }finally{setSalvando('')}
  }

  const master=usuarioRole==='master'

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-2">
        <MessageCircleMore size={19} className="mt-0.5 text-emerald-600"/>
        <div>
          <h2 className="font-semibold text-slate-900">Permissões do WhatsApp</h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Configuração exclusiva do WhatsApp de {usuarioNome.split(' ')[0]}. Não libera Financeiro, Compras, Comercial ou qualquer outro módulo do Atlas.
          </p>
        </div>
      </div>

      {master ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
          Usuário Master mantém acesso total ao WhatsApp. Para os demais usuários, os acessos abaixo são independentes das permissões do Atlas.
        </div>
      ) : carregando ? (
        <div className="grid place-items-center py-10 text-slate-400"><Loader2 className="animate-spin" size={22}/></div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-800">
            <b>Regra:</b> primeiro escolha o que este usuário pode fazer em cada número. Depois ajuste os grupos. Um grupo pode ficar mais restrito que o número — ou ser liberado especificamente para uma pessoa.
          </div>

          {erro&&<div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{erro}</div>}

          {canais.map(canal=>{
            const p=permissaoCanal(canal.id)
            const gruposCanal=grupos.filter(g=>g.whatsapp_canal_id===canal.id)
            const aberto=abertos[canal.id]===true
            return <div key={canal.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={()=>setAbertos(v=>({...v,[canal.id]:!aberto}))} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm text-slate-900">{canal.nome}</b>
                      {canal.principal&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">PRINCIPAL</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${canal.gateway_status==='connected'?'bg-blue-50 text-blue-700':'bg-slate-200 text-slate-500'}`}>
                        {canal.gateway_status==='connected'?'CONECTADO':'OFFLINE'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {numeroFormatado(canal.numero_conectado||canal.numero_declarado)||'Número aguardando conexão'}
                      {gruposCanal.length? ` · ${gruposCanal.length} grupos`:''}
                    </p>
                  </button>
                  {salvando===`canal:${canal.id}`&&<Loader2 size={15} className="animate-spin text-slate-400"/>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  {([
                    ['pode_visualizar','Ver conversas'],
                    ['pode_atender','Atender'],
                    ['pode_transferir','Transferir'],
                    ['pode_supervisionar','Supervisionar'],
                  ] as const).map(([campo,rotulo])=>(
                    <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 py-2 font-semibold text-slate-700">
                      <input type="checkbox" checked={Boolean(p[campo])}
                        onChange={e=>void salvarCanal(canal.id,campo,e.target.checked)}/>
                      <span>{rotulo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {aberto&&(
                <div className="divide-y">
                  {gruposCanal.length===0&&(
                    <div className="p-4 text-center text-xs text-slate-400">Nenhum grupo sincronizado neste número.</div>
                  )}
                  {gruposCanal.map(grupo=>{
                    const pg=porGrupo.get(grupo.id)
                    const nivel=(pg?.nivel||'herdar') as 'herdar'|'sem_acesso'|'acompanhar'|'atender'|'gerenciar'
                    const respAtual=responsavelPorGrupo.get(grupo.id)
                    const podeResponsavel=nivel==='atender'||nivel==='gerenciar'
                    const souResponsavel=pg?.responsavel_principal===true
                    return <div key={grupo.id} className="p-3">
                      <div className="flex items-start gap-2">
                        <Users size={15} className="mt-0.5 shrink-0 text-violet-600"/>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{grupo.nome}</p>
                          <p className="text-[10px] text-slate-400">{grupo.participantes||0} participantes</p>
                        </div>
                        {salvando===`grupo:${grupo.id}`&&<Loader2 size={14} className="animate-spin text-slate-400"/>}
                      </div>

                      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_190px]">
                        <label className="text-[10px] font-semibold text-slate-500">
                          Permissão neste grupo
                          <select value={nivel}
                            onChange={e=>void salvarGrupo(grupo.id,e.target.value as any,false)}
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs font-semibold text-slate-700">
                            <option value="herdar">Seguir permissão do número</option>
                            <option value="sem_acesso">Não pode ver</option>
                            <option value="acompanhar">Só acompanhar</option>
                            <option value="atender">Pode atender</option>
                            <option value="gerenciar">Pode gerenciar</option>
                          </select>
                        </label>
                        <button type="button" disabled={!podeResponsavel}
                          onClick={()=>void salvarGrupo(grupo.id,nivel as any,!souResponsavel)}
                          className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35 ${souResponsavel?'border-emerald-300 bg-emerald-50 text-emerald-800':'bg-white text-slate-600'}`}>
                          <UserRoundCheck size={14}/>
                          {souResponsavel?'✓ Responsável do grupo':'Definir responsável'}
                        </button>
                      </div>

                      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600">
                        {respAtual
                          ? <>Responsável principal atual: <b>{respAtual.usuario_nome||'Usuário'}</b>.</>
                          : <>Este grupo ainda não tem responsável principal definido.</>}
                        {nivel==='acompanhar'&&<span> {usuarioNome.split(' ')[0]} pode ler, mas não responder ou transferir.</span>}
                        {nivel==='gerenciar'&&<span> {usuarioNome.split(' ')[0]} pode atender, transferir e gerenciar este grupo.</span>}
                      </div>
                    </div>
                  })}
                </div>
              )}
            </div>
          })}

          {canais.length===0&&(
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-slate-400">Nenhum número WhatsApp cadastrado.</div>
          )}

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-900">
            <ShieldCheck size={14} className="mb-1"/>
            Estas permissões são avaliadas pelo atendimento do WhatsApp e não usam os níveis “consulta/edição” dos módulos do Atlas.
          </div>
        </div>
      )}
    </section>
  )
}
