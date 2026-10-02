'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, BriefcaseBusiness, CheckCircle2, CircleOff,
  Link2, Plus, QrCode, RefreshCw, Save, Smartphone,
  Trash2, UserRound, Wifi, WifiOff,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Usuario = { id: string; nome: string; role?: string }
type PermissaoCanal = {
  id?: string
  canal_id: string
  usuario_id: string
  pode_visualizar: boolean
  pode_atender: boolean
  pode_transferir: boolean
  pode_supervisionar: boolean
}
type Canal = {
  id: string
  nome: string
  numero_declarado?: string | null
  numero_conectado?: string | null
  tipo_conta: 'business' | 'pessoal' | 'nao_informado'
  principal: boolean
  usuario_id?: string | null
  usuario_nome?: string | null
  nivel_hierarquia: number
  criado_por?: string | null
  criado_por_nome?: string | null
  ativo: boolean
  gateway_status: string
  gateway_qr_data_url?: string | null
  gateway_qr_updated_at?: string | null
  gateway_connected_jid?: string | null
  gateway_last_seen_at?: string | null
}

async function headersJson() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

function formatarNumero(valor?: string | null) {
  const n = String(valor || '').replace(/\D/g, '')
  if (n.startsWith('55') && n.length >= 12) {
    const ddd = n.slice(2, 4)
    const local = n.slice(4)
    return `+55 (${ddd}) ${local.length === 9 ? local.slice(0,5) : local.slice(0,4)}-${local.length === 9 ? local.slice(5) : local.slice(4)}`
  }
  return valor || '—'
}

function statusLabel(status: string) {
  if (status === 'connected') return 'Conectado'
  if (status === 'qr') return 'Aguardando QR'
  if (status === 'connecting') return 'Conectando'
  if (status === 'mismatch') return 'Número divergente'
  if (status === 'disconnected') return 'Reconectando'
  return 'Desconectado'
}

export default function NumerosWhatsAppPage() {
  const [eu,setEu]=useState<Usuario|null>(null)
  const [canais,setCanais]=useState<Canal[]>([])
  const [usuarios,setUsuarios]=useState<Usuario[]>([])
  const [permissoes,setPermissoes]=useState<PermissaoCanal[]>([])
  const [erro,setErro]=useState('')
  const [carregando,setCarregando]=useState(true)
  const [novo,setNovo]=useState({nome:'',tipoConta:'business',usuarioId:'',nivelHierarquia:100})
  const [criando,setCriando]=useState(false)
  const [editando,setEditando]=useState<Record<string,{nome:string;tipoConta:string;usuarioId:string;nivelHierarquia:number}>>({})

  async function carregar(silencioso=false) {
    if(!silencioso){setErro('');setCarregando(true)}
    try {
      const headers=await headersJson()
      const resp=await fetch('/api/integracoes/whatsapp/canais',{headers})
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel carregar os numeros.')
      setEu(json.usuario||null)
      setCanais(json.canais||[])
      setUsuarios(json.usuarios||[])
      if(json.usuario?.role==='master'){
        const pResp=await fetch('/api/integracoes/whatsapp/canais/permissoes',{headers})
        const pJson=await pResp.json()
        if(!pResp.ok)throw new Error(pJson.error||'Nao foi possivel carregar as permissoes.')
        setPermissoes(pJson.permissoes||[])
      } else {
        setPermissoes([])
      }
      setEditando(prev=>{
        const next={...prev}
        for(const canal of json.canais||[]){
          if(!next[canal.id]){
            next[canal.id]={
              nome:canal.nome||'',
              tipoConta:canal.tipo_conta||'nao_informado',
              usuarioId:canal.usuario_id||'',
              nivelHierarquia:Number(canal.nivel_hierarquia||100),
            }
          }
        }
        return next
      })
    } catch(e) {
      setErro(e instanceof Error?e.message:'Falha ao carregar.')
    } finally {
      if(!silencioso)setCarregando(false)
    }
  }

  useEffect(()=>{
    void carregar()
    const timer=setInterval(()=>void carregar(true),2500)
    return()=>clearInterval(timer)
  },[])

  const conectados=useMemo(
    ()=>canais.filter(c=>c.gateway_status==='connected').length,
    [canais],
  )

  async function criar() {
    if(!novo.nome.trim())return
    setCriando(true);setErro('')
    try{
      const headers=await headersJson()
      const resp=await fetch('/api/integracoes/whatsapp/canais',{
        method:'POST',headers,
        body:JSON.stringify(novo),
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Falha ao cadastrar numero.')
      setNovo({nome:'',tipoConta:'business',usuarioId:'',nivelHierarquia:100})
      await carregar(true)
    }catch(e){
      setErro(e instanceof Error?e.message:'Falha ao cadastrar.')
    }finally{setCriando(false)}
  }

  async function atualizar(canal:Canal, acao='editar') {
    setErro('')
    const form=editando[canal.id]||{
      nome:canal.nome,tipoConta:canal.tipo_conta,usuarioId:canal.usuario_id||'',
      nivelHierarquia:Number(canal.nivel_hierarquia||100),
    }
    const headers=await headersJson()
    const resp=await fetch('/api/integracoes/whatsapp/canais',{
      method:'PATCH',headers,
      body:JSON.stringify({id:canal.id,acao,...form}),
    })
    const json=await resp.json()
    if(!resp.ok){setErro(json.error||'Falha ao atualizar.');return}
    await carregar(true)
  }

  async function remover(canal:Canal) {
    if(canal.principal)return
    setErro('')
    const headers=await headersJson()
    const resp=await fetch(`/api/integracoes/whatsapp/canais?id=${encodeURIComponent(canal.id)}`,{
      method:'DELETE',headers,
    })
    const json=await resp.json()
    if(!resp.ok){setErro(json.error||'Falha ao remover.');return}
    await carregar(true)
  }

  function permissaoDoUsuario(canalId:string, usuarioId:string):PermissaoCanal {
    return permissoes.find(p=>p.canal_id===canalId&&p.usuario_id===usuarioId)||{
      canal_id:canalId,
      usuario_id:usuarioId,
      pode_visualizar:false,
      pode_atender:false,
      pode_transferir:false,
      pode_supervisionar:false,
    }
  }

  async function salvarPermissao(
    canalId:string,
    usuarioId:string,
    campo:'pode_visualizar'|'pode_atender'|'pode_transferir'|'pode_supervisionar',
    valor:boolean,
  ) {
    setErro('')
    const atual=permissaoDoUsuario(canalId,usuarioId)
    const proxima={...atual,[campo]:valor}
    if(campo!=='pode_visualizar'&&valor)proxima.pode_visualizar=true
    try{
      const headers=await headersJson()
      const resp=await fetch('/api/integracoes/whatsapp/canais/permissoes',{
        method:'PUT',headers,
        body:JSON.stringify({
          canalId,usuarioId,
          podeVisualizar:proxima.pode_visualizar,
          podeAtender:proxima.pode_atender,
          podeTransferir:proxima.pode_transferir,
          podeSupervisionar:proxima.pode_supervisionar,
        }),
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Falha ao salvar permissao.')
      setPermissoes(lista=>[
        ...lista.filter(p=>!(p.canal_id===canalId&&p.usuario_id===usuarioId)),
        json.permissao,
      ])
    }catch(e){
      setErro(e instanceof Error?e.message:'Falha ao salvar permissao.')
    }
  }

  async function revogarPermissao(canalId:string,usuarioId:string){
    setErro('')
    const headers=await headersJson()
    const resp=await fetch(
      `/api/integracoes/whatsapp/canais/permissoes?canalId=${encodeURIComponent(canalId)}&usuarioId=${encodeURIComponent(usuarioId)}`,
      {method:'DELETE',headers},
    )
    const json=await resp.json()
    if(!resp.ok){setErro(json.error||'Falha ao revogar permissao.');return}
    setPermissoes(lista=>lista.filter(p=>!(p.canal_id===canalId&&p.usuario_id===usuarioId)))
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/whatsapp" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
            <div>
              <h1 className="font-bold text-slate-900">Gestão dos canais WhatsApp</h1>
              <p className="text-xs text-slate-500">Número principal, canais pessoais e permissões da equipe</p>
            </div>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {conectados}/{canais.length} conectados
          </div>
        </header>

        {erro&&<div className="border-b bg-red-50 px-5 py-2 text-sm text-red-700">{erro}</div>}

        <div className="space-y-6 p-5">
          <section className="rounded-2xl border bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <Plus size={17}/> Adicionar canal
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Defina o nome, a hierarquia e o usuário. O número real será identificado automaticamente quando o QR for escaneado.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_150px_170px_1fr_auto]">
              <input value={novo.nome} onChange={e=>setNovo(v=>({...v,nome:e.target.value}))}
                placeholder="Ex.: WhatsApp Francis" className="rounded-xl border bg-white px-3 py-2.5 text-sm"/>
              <input type="number" min={1} value={novo.nivelHierarquia}
                onChange={e=>setNovo(v=>({...v,nivelHierarquia:Math.max(1,Number(e.target.value)||1)}))}
                placeholder="Hierarquia" className="rounded-xl border bg-white px-3 py-2.5 text-sm"/>
              <select value={novo.tipoConta} onChange={e=>setNovo(v=>({...v,tipoConta:e.target.value}))}
                className="rounded-xl border bg-white px-3 py-2.5 text-sm">
                <option value="business">Business</option>
                <option value="pessoal">WhatsApp comum</option>
              </select>
              <select value={novo.usuarioId} onChange={e=>setNovo(v=>({...v,usuarioId:e.target.value}))}
                className="rounded-xl border bg-white px-3 py-2.5 text-sm">
                <option value="">Vincular ao criador</option>
                {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <button onClick={()=>void criar()} disabled={criando||!novo.nome.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                {criando?'Criando...':'Criar QR'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Hierarquia 0 é exclusiva do canal principal. Nos demais, valores menores representam maior nível hierárquico.
            </p>
          </section>

          {carregando?(
            <div className="p-10 text-center text-sm text-slate-400">Carregando números...</div>
          ):(
            <section className="grid gap-4 lg:grid-cols-2">
              {canais.map(canal=>{
                const form=editando[canal.id]||{
                  nome:canal.nome,
                  tipoConta:canal.tipo_conta,
                  usuarioId:canal.usuario_id||'',
                  nivelHierarquia:Number(canal.nivel_hierarquia||100),
                }
                const conectado=canal.gateway_status==='connected'
                const qr=canal.gateway_status==='qr'&&canal.gateway_qr_data_url
                return (
                  <article key={canal.id} className={`rounded-2xl border p-4 ${canal.principal?'border-emerald-300 bg-emerald-50/30':'bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${canal.principal?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}`}>
                        {canal.tipo_conta==='business'?<BriefcaseBusiness size={20}/>:<Smartphone size={20}/>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="truncate text-slate-900">{canal.nome}</b>
                          {canal.principal&&<span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">PRINCIPAL</span>}
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          {canal.numero_declarado ? formatarNumero(canal.numero_declarado) : 'Número será identificado pelo QR'}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Hierarquia {canal.principal ? 0 : canal.nivel_hierarquia}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${conectado?'bg-emerald-100 text-emerald-700':canal.gateway_status==='qr'?'bg-blue-100 text-blue-700':canal.gateway_status==='mismatch'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>
                            {conectado?<Wifi size={12}/>:canal.gateway_status==='qr'?<QrCode size={12}/>:<WifiOff size={12}/>}
                            {statusLabel(canal.gateway_status)}
                          </span>
                          {canal.usuario_nome&&<span className="inline-flex items-center gap-1 text-slate-500"><UserRound size={12}/>{canal.usuario_nome}</span>}
                        </div>
                      </div>
                    </div>

                    {canal.gateway_status==='mismatch'&&canal.numero_conectado&&(
                      <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                        Número conectado: <b>{formatarNumero(canal.numero_conectado)}</b>. Para o canal principal, use o número esperado da empresa.
                      </div>
                    )}

                    {qr&&(
                      <div className="mt-4 flex flex-col items-center rounded-2xl border bg-white p-4">
                        <img src={canal.gateway_qr_data_url||''} alt={`QR de ${canal.nome}`} className="h-56 w-56"/>
                        <p className="mt-2 text-center text-xs font-semibold text-slate-600">
                          No celular: Aparelhos conectados → Conectar aparelho
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-500">
                        Nome do canal
                        <input value={form.nome} onChange={e=>setEditando(v=>({...v,[canal.id]:{...form,nome:e.target.value}}))}
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-900"/>
                      </label>
                      <label className="text-xs font-semibold text-slate-500">
                        Tipo
                        <select value={form.tipoConta} onChange={e=>setEditando(v=>({...v,[canal.id]:{...form,tipoConta:e.target.value}}))}
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-900">
                          <option value="business">Business</option>
                          <option value="pessoal">WhatsApp comum</option>
                          <option value="nao_informado">Não informado</option>
                        </select>
                      </label>
                      {!canal.principal&&(
                        <>
                          <label className="text-xs font-semibold text-slate-500">
                            Nível de hierarquia
                            <input type="number" min={1} value={form.nivelHierarquia}
                              onChange={e=>setEditando(v=>({...v,[canal.id]:{...form,nivelHierarquia:Math.max(1,Number(e.target.value)||1)}}))}
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-900"/>
                          </label>
                          <label className="text-xs font-semibold text-slate-500">
                            Usuário vinculado
                            <select value={form.usuarioId} onChange={e=>setEditando(v=>({...v,[canal.id]:{...form,usuarioId:e.target.value}}))}
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-900">
                              <option value="">Vincular ao criador</option>
                              {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                          </label>
                        </>
                      )}
                    </div>
                    {canal.criado_por_nome&&(
                      <p className="mt-2 text-[10px] text-slate-400">
                        QR/canal criado por {canal.criado_por_nome}.
                      </p>
                    )}

                    {eu?.role==='master'&&(
                      <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <b className="text-xs text-slate-800">Permissões da equipe</b>
                            <p className="text-[10px] text-slate-500">
                              Ver, atender, transferir ou apenas supervisionar este canal.
                            </p>
                          </div>
                          {canal.usuario_nome&&(
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                              Dono: {canal.usuario_nome}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {usuarios.filter(u=>u.role!=='master'&&u.id!==canal.usuario_id).map(u=>{
                            const p=permissaoDoUsuario(canal.id,u.id)
                            const ativa=Boolean(p.id||p.pode_visualizar||p.pode_atender||p.pode_transferir||p.pode_supervisionar)
                            return(
                              <div key={u.id} className="rounded-lg border bg-white p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-bold text-slate-700">{u.nome}</span>
                                  {ativa&&(
                                    <button onClick={()=>void revogarPermissao(canal.id,u.id)}
                                      className="text-[10px] font-bold text-red-600 hover:underline">
                                      Revogar
                                    </button>
                                  )}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                                  {([
                                    ['pode_visualizar','Ver canal'],
                                    ['pode_atender','Atender'],
                                    ['pode_transferir','Transferir'],
                                    ['pode_supervisionar','Supervisionar'],
                                  ] as const).map(([campo,rotulo])=>(
                                    <label key={campo} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
                                      <input type="checkbox" checked={Boolean(p[campo])}
                                        onChange={e=>void salvarPermissao(canal.id,u.id,campo,e.target.checked)}/>
                                      <span>{rotulo}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                          {usuarios.filter(u=>u.role!=='master'&&u.id!==canal.usuario_id).length===0&&(
                            <p className="py-2 text-center text-[11px] text-slate-400">
                              Nenhum outro usuário disponível.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={()=>void atualizar(canal)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        <Save size={14}/> Salvar
                      </button>
                      <button onClick={()=>void atualizar(canal,'reconectar')}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold">
                        <RefreshCw size={14}/> Novo QR
                      </button>
                      {!canal.principal&&(
                        <button onClick={()=>void remover(canal)}
                          className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                          <Trash2 size={14}/> Remover
                        </button>
                      )}
                    </div>

                    {canal.gateway_last_seen_at&&(
                      <p className="mt-3 text-[10px] text-slate-400">
                        Último sinal: {new Date(canal.gateway_last_seen_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </article>
                )
              })}
            </section>
          )}

          <section className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            <div className="flex gap-2">
              <Link2 size={16} className="mt-0.5 shrink-0"/>
              <p>
                O canal principal fica no nível 0 e recebe os atendimentos gerais. Cada novo canal é criado por nome e hierarquia;
                o número é descoberto no QR e as conversas entram para o usuário vinculado. O Atlas não impõe limite de canais cadastrados,
                e o Master continua vendo todas as conversas juntas.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}