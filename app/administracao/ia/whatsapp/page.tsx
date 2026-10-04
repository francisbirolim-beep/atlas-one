'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Bot, BrainCircuit, CheckCircle2, CircleAlert, Eye, Lightbulb,
  MessageSquareText, RefreshCw, Save, ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type ModoIA = 'observando' | 'sugerindo' | 'automatico'
type Canal = {
  id: string
  nome: string
  numero_declarado?: string | null
  numero_conectado?: string | null
  tipo_conta?: string | null
  principal?: boolean
  usuario_id?: string | null
  usuario_nome?: string | null
  gateway_status?: string | null
}
type CanalIA = {
  canal_id: string
  aprender: boolean
  classificacao: 'auto' | 'empresa' | 'pessoal'
  setor_padrao?: string | null
  permitir_sugestoes: boolean
  permitir_automatico: boolean
}
type Observacao = {
  id: string
  canal_nome: string
  classe: 'empresa' | 'pessoal' | 'duvida'
  setor?: string | null
  confianca?: number | null
  aprendizado_resumo?: string | null
  motivo?: string | null
  candidato_aprendizado_id?: string | null
  created_at: string
}
type Dados = {
  configuracao: {
    modo: ModoIA
    ativo: boolean
    aprender_todos_canais: boolean
    classificar_canal_pessoal: boolean
    confianca_minima_sugestao: number
    confianca_minima_automatico: number
  }
  canais: Canal[]
  canaisIA: CanalIA[]
  observacoes: Observacao[]
  metricas: Record<string, number>
}

const SETORES = [
  ['','Automático'],
  ['comercial','Comercial'],
  ['orcamento','Orçamento'],
  ['financeiro','Financeiro'],
  ['engenharia','Engenharia'],
  ['compras','Compras'],
  ['estoque','Estoque'],
  ['producao','Produção'],
  ['instalacao','Instalação'],
  ['medicao_final','Medição final'],
  ['rh','RH'],
  ['marketing','Marketing'],
  ['gestao','Gestão'],
] as const

async function headersJson() {
  const token = await tokenAtual()
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

function numero(v?: string | null) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  if (d.length === 12 && d.startsWith('55')) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
  return v || 'Número identificado pelo QR'
}

export default function WhatsAppIAPage() {
  const [dados,setDados]=useState<Dados|null>(null)
  const [erro,setErro]=useState('')
  const [carregando,setCarregando]=useState(true)
  const [salvando,setSalvando]=useState(false)
  const [modo,setModo]=useState<ModoIA>('observando')
  const [minSugestao,setMinSugestao]=useState(0.70)
  const [minAuto,setMinAuto]=useState(0.92)
  const [canaisIA,setCanaisIA]=useState<Record<string,CanalIA>>({})

  async function carregar(silencioso=false) {
    if(!silencioso){setCarregando(true);setErro('')}
    try{
      const headers=await headersJson()
      const r=await fetch('/api/integracoes/whatsapp/ia',{headers,cache:'no-store'})
      const j=await r.json()
      if(!r.ok)throw new Error(j.error||'Não foi possível carregar o Assistente IA.')
      setDados(j)
      setModo(j.configuracao?.modo||'observando')
      setMinSugestao(Number(j.configuracao?.confianca_minima_sugestao??.70))
      setMinAuto(Number(j.configuracao?.confianca_minima_automatico??.92))
      const existentes=new Map((j.canaisIA||[]).map((x:CanalIA)=>[x.canal_id,x]))
      const mapa:Record<string,CanalIA>={}
      for(const c of (j.canais||[]) as Canal[]){
        const e=existentes.get(c.id) as CanalIA|undefined
        mapa[c.id]=e||{
          canal_id:c.id,
          aprender:true,
          classificacao:'auto',
          setor_padrao:null,
          permitir_sugestoes:true,
          permitir_automatico:false,
        }
      }
      setCanaisIA(mapa)
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar.')}
    finally{setCarregando(false)}
  }

  useEffect(()=>{void carregar()},[])

  async function salvar(novoModo:ModoIA=modo) {
    if(novoModo==='automatico'){
      const canaisAuto=Object.values(canaisIA).filter(c=>c.permitir_automatico)
      if(!canaisAuto.length){
        setErro('Para ativar o modo automático, libere pelo menos um número na coluna “IA pode responder”.')
        return
      }
      const ok=window.confirm('Ativar atendimento automático nos números liberados? A IA continuará bloqueando respostas de risco e conversas pessoais.')
      if(!ok)return
    }
    setSalvando(true);setErro('')
    try{
      const headers=await headersJson()
      const r=await fetch('/api/integracoes/whatsapp/ia',{
        method:'PUT',headers,
        body:JSON.stringify({
          modo:novoModo,
          confirmarAutomatico:novoModo==='automatico',
          ativo:true,
          aprenderTodosCanais:true,
          classificarCanalPessoal:true,
          confiancaMinimaSugestao:minSugestao,
          confiancaMinimaAutomatico:minAuto,
          canais:Object.values(canaisIA).map(c=>({
            canalId:c.canal_id,
            aprender:c.aprender,
            classificacao:c.classificacao,
            setorPadrao:c.setor_padrao||null,
            permitirSugestoes:c.permitir_sugestoes,
            permitirAutomatico:c.permitir_automatico,
          })),
        }),
      })
      const j=await r.json()
      if(!r.ok)throw new Error(j.error||'Falha ao salvar.')
      setModo(novoModo)
      await carregar(true)
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.')}
    finally{setSalvando(false)}
  }

  function alterarCanal(id:string,patch:Partial<CanalIA>){
    setCanaisIA(prev=>({...prev,[id]:{...prev[id],...patch}}))
  }

  const metricas=dados?.metricas||{}
  const totalClassificado=(metricas.empresa||0)+(metricas.pessoal||0)+(metricas.duvida||0)
  const aproveitamento=useMemo(()=>{
    const a=metricas.sugestoes_usadas||0,r=metricas.sugestoes_rejeitadas||0
    return a+r?Math.round(a/(a+r)*100):0
  },[metricas.sugestoes_usadas,metricas.sugestoes_rejeitadas])

  const modos:Array<{id:ModoIA;titulo:string;texto:string;icone:any;cor:string}>=[
    {id:'observando',titulo:'1. Observando',texto:'A IA acompanha, separa empresa/pessoal, identifica setor e cria aprendizados candidatos. Não responde clientes.',icone:Eye,cor:'border-blue-200 bg-blue-50'},
    {id:'sugerindo',titulo:'2. Sugerindo',texto:'Além de aprender, prepara respostas. O atendente decide usar, editar ou rejeitar.',icone:Lightbulb,cor:'border-amber-200 bg-amber-50'},
    {id:'automatico',titulo:'3. Atendendo',texto:'Responde somente casos simples e confiáveis nos números autorizados. O usuário pode assumir a conversa.',icone:Bot,cor:'border-emerald-200 bg-emerald-50'},
  ]

  if(carregando)return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Carregando Assistente IA do WhatsApp...</div>

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/administracao/ia" className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-slate-600 hover:bg-slate-50"><ArrowLeft size={18}/></Link>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><BrainCircuit size={23}/></div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">Assistente IA · WhatsApp</h1>
              <p className="text-xs text-slate-500">Controle Master do aprendizado e da autonomia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/atlas-ia/aprendizado" className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Central de Aprendizado</Link>
            <button onClick={()=>void carregar()} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-slate-600"><RefreshCw size={16}/></button>
            <button onClick={()=>void salvar()} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{salvando?'Salvando...':'Salvar'}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {erro&&<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</div>}

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-slate-900">Estágio atual da IA</h2>
              <p className="text-sm text-slate-500">Só o Master muda o nível de autonomia.</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              {modo==='observando'?'OBSERVANDO':modo==='sugerindo'?'SUGERINDO':'ATENDENDO'}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {modos.map(m=>{
              const I=m.icone
              const ativo=modo===m.id
              return <button key={m.id} onClick={()=>void salvar(m.id)} disabled={salvando}
                className={`rounded-2xl border-2 p-4 text-left transition ${ativo?`${m.cor} ring-2 ring-slate-200`:'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-extrabold text-slate-900"><I size={19}/>{m.titulo}</span>
                  {ativo&&<CheckCircle2 size={18} className="text-emerald-600"/>}
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{m.texto}</p>
              </button>
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-600"/>
            <span>Conhecimento observado entra como <b>candidato</b>. Conversa pessoal é descartada do aprendizado. Atendimento automático ainda exige liberação explícita por número e alta confiança.</span>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Empresa',metricas.empresa||0,'mensagens classificadas'],
            ['Pessoal ignorado',metricas.pessoal||0,'não vira conhecimento'],
            ['Dúvidas',metricas.duvida||0,'sem aprendizado automático'],
            ['Aprendizados pendentes',metricas.conhecimentos_pendentes||0,'aguardando validação'],
          ].map(([a,b,c])=><div key={String(a)} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{a}</p><p className="mt-1 text-3xl font-black text-slate-900">{b}</p><p className="text-xs text-slate-500">{c}</p></div>)}
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-extrabold text-slate-900">Fontes de aprendizado</h2>
            <p className="text-sm text-slate-500">A tela do WhatsApp continua separada por número; o conhecimento empresarial pode ser compartilhado entre os setores.</p>
          </div>
          <div className="space-y-3">
            {(dados?.canais||[]).map(c=>{
              const cfg=canaisIA[c.id]||{canal_id:c.id,aprender:true,classificacao:'auto' as const,setor_padrao:null,permitir_sugestoes:true,permitir_automatico:false}
              const pessoal=c.tipo_conta==='pessoal'
              return <div key={c.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${pessoal?'bg-violet-100 text-violet-700':'bg-emerald-100 text-emerald-700'}`}><Smartphone size={19}/></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="truncate text-slate-900">{c.nome}</b>
                        {c.principal&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">EMPRESA</span>}
                        {pessoal&&<span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">PESSOAL</span>}
                      </div>
                      <p className="text-xs text-slate-500">{numero(c.numero_conectado||c.numero_declarado)}{c.usuario_nome?` · ${c.usuario_nome}`:''}</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={cfg.aprender} onChange={e=>alterarCanal(c.id,{aprender:e.target.checked})} className="h-4 w-4"/>
                    IA aprende
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-600">Classificação
                    <select value={cfg.classificacao} onChange={e=>alterarCanal(c.id,{classificacao:e.target.value as CanalIA['classificacao']})} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                      <option value="auto">Automática: empresa / pessoal / dúvida</option>
                      <option value="empresa">Sempre empresa</option>
                      <option value="pessoal">Sempre pessoal</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Setor padrão
                    <select value={cfg.setor_padrao||''} onChange={e=>alterarCanal(c.id,{setor_padrao:e.target.value||null})} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                      {SETORES.map(([v,n])=><option key={v} value={v}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-end">
                    <span className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={cfg.permitir_sugestoes} onChange={e=>alterarCanal(c.id,{permitir_sugestoes:e.target.checked})}/>
                      Pode sugerir
                    </span>
                  </label>
                  <label className="flex items-end">
                    <span className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${cfg.permitir_automatico?'border-emerald-300 bg-emerald-50 text-emerald-800':'text-slate-700'}`}>
                      <input type="checkbox" checked={cfg.permitir_automatico} onChange={e=>alterarCanal(c.id,{permitir_automatico:e.target.checked})}/>
                      IA pode responder
                    </span>
                  </label>
                </div>
              </div>
            })}
            {!dados?.canais?.length&&<div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhum número de WhatsApp conectado.</div>}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-extrabold text-slate-900">Qualidade das sugestões</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">USADAS</p><p className="text-2xl font-black text-emerald-900">{metricas.sugestoes_usadas||0}</p></div>
              <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs font-bold text-red-700">REJEITADAS</p><p className="text-2xl font-black text-red-900">{metricas.sugestoes_rejeitadas||0}</p></div>
              <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">PENDENTES</p><p className="text-2xl font-black text-amber-900">{metricas.sugestoes_pendentes||0}</p></div>
              <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">AUTOMÁTICAS</p><p className="text-2xl font-black text-blue-900">{metricas.respostas_automaticas||0}</p></div>
            </div>
            <div className="mt-4 rounded-2xl border p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Aproveitamento supervisionado</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{aproveitamento}%</p>
              <p className="text-xs text-slate-500">Baseado em sugestões usadas x rejeitadas.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">Confiança mínima para sugerir
                <input type="number" min="0" max="1" step=".01" value={minSugestao} onChange={e=>setMinSugestao(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Confiança mínima automática
                <input type="number" min="0" max="1" step=".01" value={minAuto} onChange={e=>setMinAuto(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-extrabold text-slate-900">O que a IA está observando</h2>
                <p className="text-sm text-slate-500">{totalClassificado} mensagens classificadas nesta base.</p>
              </div>
              <Link href="/atlas-ia/aprendizado" className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><Sparkles size={15}/>Validar aprendizados</Link>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {(dados?.observacoes||[]).map(o=>{
                const cls=o.classe==='empresa'?'bg-emerald-100 text-emerald-700':o.classe==='pessoal'?'bg-slate-100 text-slate-600':'bg-amber-100 text-amber-700'
                return <div key={o.id} className="rounded-2xl border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${cls}`}>{o.classe}</span>
                    <b className="text-xs text-slate-800">{o.canal_nome}</b>
                    {o.setor&&<span className="text-[11px] text-slate-500">· {o.setor}</span>}
                    {typeof o.confianca==='number'&&<span className="ml-auto text-[11px] text-slate-400">{Math.round(o.confianca*100)}%</span>}
                  </div>
                  {o.classe==='pessoal'
                    ? <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14}/>Conteúdo pessoal ignorado para aprendizado.</p>
                    : o.aprendizado_resumo
                      ? <p className="mt-2 text-sm font-medium text-slate-700">{o.aprendizado_resumo}</p>
                      : <p className="mt-2 text-xs text-slate-500">{o.motivo||'Sem conhecimento reutilizável identificado nesta mensagem.'}</p>}
                  {o.candidato_aprendizado_id&&<div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-700"><BrainCircuit size={13}/>Aprendizado candidato criado</div>}
                </div>
              })}
              {!dados?.observacoes?.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center"><MessageSquareText className="mx-auto mb-2 text-slate-300"/><p className="text-sm text-slate-500">A IA ainda não observou mensagens depois da ativação.</p></div>}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2"><CircleAlert size={18} className="mt-0.5 shrink-0"/><div><b>Regra de segurança:</b> no modo automático, preço, desconto, reclamação, cobrança sensível, promessa de prazo e decisão técnica arriscada continuam fora da resposta autônoma. Esses casos ficam para uma pessoa assumir.</div></div>
        </section>
      </div>
    </main>
  )
}