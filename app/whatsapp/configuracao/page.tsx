'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, MessageCircleMore, Plus, Save, ShieldCheck, Trash2, Users } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Usuario = { id: string; nome: string; role?: string | null }
type CanalResumo = {
  id: string
  nome: string
  numero_declarado?: string | null
  principal?: boolean
  gateway_status?: string | null
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
type GrupoWhatsApp = {
  id: string
  whatsapp_canal_id: string
  grupo_jid: string
  nome: string
  participantes: number
  sincronizado_em?: string | null
}
type GrupoAutomacao = {
  grupoId: string
  ativo: boolean
  responsavelId: string
  criarRascunho: boolean
  criarTarefa: boolean
  janelaAgregacaoMinutos: number
}
type Regra = {
  nome: string
  prioridade: number
  palavrasChave: string
  setor: string
  usuarioId: string
  ativo: boolean
}

async function authHeaders() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

export default function ConfiguracaoWhatsAppPage() {
  const [usuarios,setUsuarios]=useState<Usuario[]>([])
  const [canais,setCanais]=useState<CanalResumo[]>([])
  const [permissoes,setPermissoes]=useState<PermissaoCanal[]>([])
  const [grupos,setGrupos]=useState<GrupoWhatsApp[]>([])
  const [gruposAutomacao,setGruposAutomacao]=useState<GrupoAutomacao[]>([])
  const [numero,setNumero]=useState('5517996355667')
  const [setorPadrao,setSetorPadrao]=useState('')
  const [usuarioPadraoId,setUsuarioPadraoId]=useState('')
  const [regras,setRegras]=useState<Regra[]>([])
  const [erro,setErro]=useState('')
  const [salvando,setSalvando]=useState(false)
  const [salvo,setSalvo]=useState(false)

  useEffect(()=>{void carregar()},[])

  async function carregar(){
    setErro('')
    const headers=await authHeaders()
    const resp=await fetch('/api/integracoes/whatsapp/configuracao',{headers})
    const json=await resp.json()
    if(!resp.ok){setErro(json.error||'Nao foi possivel carregar.');return}
    setUsuarios(json.usuarios||[])
    setCanais(json.canais||[])
    setPermissoes(json.permissoes||[])
    const gruposRecebidos:GrupoWhatsApp[]=json.grupos||[]
    const automacoesRecebidas:any[]=json.gruposAutomacao||[]
    const automacaoPorGrupo=new Map(automacoesRecebidas.map(a=>[a.grupo_id,a]))
    setGrupos(gruposRecebidos)
    setGruposAutomacao(gruposRecebidos.map(g=>{
      const a=automacaoPorGrupo.get(g.id)
      return {
        grupoId:g.id,
        ativo:Boolean(a?.ativo),
        responsavelId:a?.responsavel_id||'',
        criarRascunho:a?.criar_rascunho!==false,
        criarTarefa:a?.criar_tarefa!==false,
        janelaAgregacaoMinutos:Number(a?.janela_agregacao_minutos||5),
      }
    }))
    const c=json.configuracao
    if(c){
      setNumero(c.numero_principal||'5517996355667')
      setSetorPadrao(c.setor_padrao||'')
      setUsuarioPadraoId(c.usuario_padrao_id||'')
    }
    setRegras((json.regras||[]).map((r:any)=>({
      nome:r.nome||'',
      prioridade:r.prioridade||100,
      palavrasChave:(r.palavras_chave||[]).join(', '),
      setor:r.setor||'',
      usuarioId:r.usuario_id||'',
      ativo:r.ativo!==false,
    })))
  }

  function alterar(indice:number, campo:keyof Regra, valor:string|number|boolean){
    setRegras(rs=>rs.map((r,i)=>i===indice?{...r,[campo]:valor}:r))
  }

  function alterarGrupo(grupoId:string,campo:keyof GrupoAutomacao,valor:string|number|boolean){
    setGruposAutomacao(gs=>gs.map(g=>g.grupoId===grupoId?{...g,[campo]:valor}:g))
  }

  function permissaoDoUsuario(canalId:string,usuarioId:string):PermissaoCanal {
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
  ){
    setErro('')
    try{
      const atual=permissaoDoUsuario(canalId,usuarioId)
      const proxima={...atual,[campo]:valor}
      if(campo!=='pode_visualizar'&&valor)proxima.pode_visualizar=true
      const headers=await authHeaders()
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
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel salvar a permissao.')
      setPermissoes(lista=>[
        ...lista.filter(p=>!(p.canal_id===canalId&&p.usuario_id===usuarioId)),
        json.permissao,
      ])
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel salvar a permissao.')
    }
  }

  async function revogarPermissao(canalId:string,usuarioId:string){
    setErro('')
    try{
      const headers=await authHeaders()
      const resp=await fetch(`/api/integracoes/whatsapp/canais/permissoes?canalId=${encodeURIComponent(canalId)}&usuarioId=${encodeURIComponent(usuarioId)}`,{
        method:'DELETE',headers,
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel revogar a permissao.')
      setPermissoes(lista=>lista.filter(p=>!(p.canal_id===canalId&&p.usuario_id===usuarioId)))
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel revogar a permissao.')
    }
  }

  function adicionar(){
    setRegras(rs=>[...rs,{
      nome:'Nova regra',
      prioridade:(rs.length+1)*10,
      palavrasChave:'',
      setor:'',
      usuarioId:'',
      ativo:true,
    }])
  }

  async function salvar(){
    setSalvando(true);setErro('');setSalvo(false)
    try{
      const headers=await authHeaders()
      const resp=await fetch('/api/integracoes/whatsapp/configuracao',{
        method:'PUT',headers,
        body:JSON.stringify({
          numeroPrincipal:numero,
          setorPadrao:setorPadrao||null,
          usuarioPadraoId:usuarioPadraoId||null,
          regras:regras.map(r=>({
            ...r,
            palavrasChave:r.palavrasChave.split(',').map(p=>p.trim()).filter(Boolean),
          })),
          gruposAutomacao,
        }),
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel salvar.')
      setSalvo(true)
      await carregar()
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel salvar.')
    }finally{setSalvando(false)}
  }

  return <main className="min-h-screen bg-slate-100 p-4 md:p-8">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/whatsapp" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
          <div>
            <h1 className="font-bold text-slate-900">Configurações do WhatsApp</h1>
            <p className="text-xs text-slate-500">Multiatendimento, equipe, permissões, filas e automações</p>
          </div>
        </div>
        <button onClick={()=>void salvar()} disabled={salvando}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Save size={16}/>{salvando?'Salvando...':'Salvar'}
        </button>
      </header>

      {erro&&<div className="border-b bg-red-50 px-5 py-2 text-sm text-red-700">{erro}</div>}
      {salvo&&<div className="border-b bg-emerald-50 px-5 py-2 text-sm text-emerald-700">Configuracao salva.</div>}

      <div className="space-y-6 p-5">
        <section className="flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <MessageCircleMore size={20} className="text-emerald-600"/>
              <h2 className="font-bold text-slate-900">Números conectados</h2>
            </div>
            <p className="text-sm text-slate-600">
              O QR Code, o vínculo de cada número com seu usuário e o status de conexão ficam no painel de números.
            </p>
          </div>
          <Link href="/whatsapp/numeros"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white">
            Gerenciar números
          </Link>
        </section>

        <section className="rounded-2xl border p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600"/>
                <h2 className="font-bold text-slate-900">Equipe e permissões</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Todo usuário cadastrado no Atlas aparece aqui automaticamente. O Master sempre possui acesso total.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              {usuarios.filter(u=>u.role!=='master').length} usuários configuráveis
            </span>
          </div>

          <div className="space-y-4">
            {canais.map(canal=>(
              <div key={canal.id} className="overflow-hidden rounded-2xl border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-sm text-slate-900">{canal.nome}</b>
                      {canal.principal&&(
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {canal.gateway_status==='connected'?'Conectado':'Desconectado'}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500">Ver · Atender · Transferir · Supervisionar</p>
                </div>

                <div className="divide-y">
                  {usuarios.filter(u=>u.role!=='master').map(u=>{
                    const p=permissaoDoUsuario(canal.id,u.id)
                    const ativa=Boolean(
                      p.id||p.pode_visualizar||p.pode_atender||p.pode_transferir||p.pode_supervisionar
                    )
                    return (
                      <div key={u.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(140px,1fr)_repeat(4,110px)_70px] md:items-center">
                        <div className="min-w-0">
                          <b className="block truncate text-sm text-slate-800">{u.nome}</b>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">{u.role||'usuario'}</span>
                        </div>
                        {([
                          ['pode_visualizar','Ver'],
                          ['pode_atender','Atender'],
                          ['pode_transferir','Transferir'],
                          ['pode_supervisionar','Supervisionar'],
                        ] as const).map(([campo,rotulo])=>(
                          <label key={campo} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700">
                            <input type="checkbox" checked={Boolean(p[campo])}
                              onChange={e=>void salvarPermissao(canal.id,u.id,campo,e.target.checked)}/>
                            <span>{rotulo}</span>
                          </label>
                        ))}
                        <button disabled={!ativa} onClick={()=>void revogarPermissao(canal.id,u.id)}
                          className="text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-25">
                          Revogar
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border p-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Numero principal
            <input value={numero} readOnly
              className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2 font-normal text-slate-600" placeholder="5517996355667"/>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Setor padrao
            <input value={setorPadrao} onChange={e=>setSetorPadrao(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" placeholder="Ex.: Comercial"/>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Usuario padrao
            <select value={usuarioPadraoId} onChange={e=>setUsuarioPadraoId(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal">
              <option value="">Deixar em espera</option>
              {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <p className="md:col-span-3 text-xs text-slate-500">
            Se nenhuma regra abaixo combinar, a conversa usa o usuario padrao. Sem usuario padrao, entra na fila para alguem assumir.
          </p>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-bold text-slate-900">Grupos do WhatsApp e automações</h2>
            <p className="text-xs text-slate-500">
              Os grupos são sincronizados por número conectado. Marque somente os grupos operacionais que devem gerar orçamento no Atlas.
            </p>
          </div>
          <div className="space-y-3">
            {grupos.length===0&&(
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-400">
                Nenhum grupo sincronizado ainda. Com o gateway conectado, os grupos do número aparecerão aqui automaticamente.
              </div>
            )}
            {grupos.map(g=>{
              const auto=gruposAutomacao.find(a=>a.grupoId===g.id)
              const canal=canais.find(c=>c.id===g.whatsapp_canal_id)
              return <div key={g.id} className="grid gap-4 rounded-2xl border p-4 md:grid-cols-[minmax(0,1.4fr)_180px_210px_120px] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700"><Users size={17}/></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{g.nome}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {canal?.nome||'WhatsApp'}{canal?.principal?' · Principal':''} · {g.participantes||0} participantes
                      </p>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={auto?.ativo===true}
                    onChange={e=>alterarGrupo(g.id,'ativo',e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"/>
                  Automatizar orçamento
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Responsável
                  <select value={auto?.responsavelId||''} disabled={!auto?.ativo}
                    onChange={e=>{
                      alterarGrupo(g.id,'responsavelId',e.target.value)
                      alterarGrupo(g.id,'criarTarefa',Boolean(e.target.value))
                    }}
                    className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm font-normal text-slate-900 disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">Só criar rascunho no Kanban</option>
                    {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Agrupar por
                  <div className="mt-1 flex items-center gap-1">
                    <input type="number" min={1} max={120} value={auto?.janelaAgregacaoMinutos||5}
                      disabled={!auto?.ativo}
                      onChange={e=>alterarGrupo(g.id,'janelaAgregacaoMinutos',Number(e.target.value)||5)}
                      className="w-16 rounded-lg border px-2 py-2 text-sm font-normal disabled:bg-slate-50"/>
                    <span className="text-[11px] text-slate-500">min</span>
                  </div>
                </label>
              </div>
            })}
          </div>
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            Ao receber texto, foto, áudio ou documento neste grupo, o Atlas agrupa as mensagens do mesmo remetente, cria um rascunho no Kanban e, se houver responsável, cria também uma tarefa vinculada. Informações ausentes continuam pendentes para validação.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Regras automaticas</h2>
              <p className="text-xs text-slate-500">A menor prioridade numerica e analisada primeiro.</p>
            </div>
            <button onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
              <Plus size={15}/> Nova regra
            </button>
          </div>
          <div className="space-y-3">
            {regras.length===0&&<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">Nenhuma regra cadastrada.</div>}
            {regras.map((r,i)=><div key={i} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[90px_1fr_1.3fr_1fr_1fr_44px]">
              <label className="text-xs font-semibold text-slate-500">Prioridade
                <input type="number" value={r.prioridade} onChange={e=>alterar(i,'prioridade',Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Nome
                <input value={r.nome} onChange={e=>alterar(i,'nome',e.target.value)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Palavras-chave
                <input value={r.palavrasChave} onChange={e=>alterar(i,'palavrasChave',e.target.value)}
                  placeholder="orcamento, preco, projeto" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Setor
                <input value={r.setor} onChange={e=>alterar(i,'setor',e.target.value)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Direcionar para
                <select value={r.usuarioId} onChange={e=>alterar(i,'usuarioId',e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm font-normal text-slate-900">
                  <option value="">Somente setor/fila</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </label>
              <button onClick={()=>setRegras(rs=>rs.filter((_,x)=>x!==i))}
                className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50" title="Excluir regra">
                <Trash2 size={17}/>
              </button>
            </div>)}
          </div>
        </section>
        <section className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <b className="text-slate-800">Como funciona:</b> quando o cliente envia uma mensagem,
          o Atlas compara o texto com as palavras-chave na ordem de prioridade. A primeira regra
          compativel define o setor e, se configurado, o usuario responsavel. Conversas recorrentes
          continuam com o atendente que ja estava responsavel.
        </section>
      </div>
    </div>
  </main>
}