'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, LocateFixed, MapPin, Plus, Trash2, UserRound } from 'lucide-react'
import { criarProspeccao, PAPEIS_CONTATO, type PapelContatoProspeccao } from '@/lib/prospeccao'

const FASES = ['Fundação','Alvenaria','Cobertura','Instalações','Reboco','Acabamento','Pronta para esquadrias','Não identificada']
const INTERESSES = ['Portas','Janelas','Fachada','Guarda-corpo','Ripado','Cobertura','Vidros','Ainda não identificado']

type ContatoForm = { id: string; papel: PapelContatoProspeccao; nome: string; telefone: string; empresa: string }

export default function NovaProspeccaoPage() {
  const router = useRouter()
  const [nome,setNome]=useState('')
  const [telefone,setTelefone]=useState('')
  const [nomeObra,setNomeObra]=useState('')
  const [cidade,setCidade]=useState('')
  const [bairro,setBairro]=useState('')
  const [endereco,setEndereco]=useState('')
  const [complemento,setComplemento]=useState('')
  const [fase,setFase]=useState('')
  const [interesses,setInteresses]=useState<string[]>([])
  const [temperatura,setTemperatura]=useState<'frio'|'morno'|'quente'>('frio')
  const [observacoes,setObservacoes]=useState('')
  const [proximaAcao,setProximaAcao]=useState('')
  const [proximaAcaoEm,setProximaAcaoEm]=useState('')
  const [latitude,setLatitude]=useState<number|null>(null)
  const [longitude,setLongitude]=useState<number|null>(null)
  const [precisao,setPrecisao]=useState<number|null>(null)
  const [capturando,setCapturando]=useState(false)
  const [contatos,setContatos]=useState<ContatoForm[]>([])
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')

  function capturarLocalizacao(){
    if(!navigator.geolocation){setErro('Este aparelho não disponibiliza localização.');return}
    setCapturando(true);setErro('')
    navigator.geolocation.getCurrentPosition(pos=>{setLatitude(pos.coords.latitude);setLongitude(pos.coords.longitude);setPrecisao(pos.coords.accuracy);setCapturando(false)},()=>{setErro('Não foi possível obter a localização. Autorize o GPS e tente novamente.');setCapturando(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }
  function alternarInteresse(valor:string){setInteresses(prev=>prev.includes(valor)?prev.filter(i=>i!==valor):[...prev,valor])}
  function novoContato(){setContatos(prev=>[...prev,{id:crypto.randomUUID(),papel:'pedreiro',nome:'',telefone:'',empresa:''}])}
  function editarContato(id:string,patch:Partial<ContatoForm>){setContatos(prev=>prev.map(c=>c.id===id?{...c,...patch}:c))}

  async function salvar(e:React.FormEvent){
    e.preventDefault();setErro('')
    if(!nome.trim()){setErro('Informe o nome do cliente ou uma identificação da obra.');return}
    setSalvando(true)
    const r=await criarProspeccao({nome_cliente:nome,telefone,nome_obra:nomeObra,cidade,bairro,endereco,complemento,latitude,longitude,precisao_m:precisao,fase_obra:fase,interesses,temperatura,observacoes,proxima_acao:proximaAcao,proxima_acao_em:proximaAcaoEm?new Date(proximaAcaoEm).toISOString():undefined,contatos})
    setSalvando(false)
    if(!r.ok||!r.id){setErro(r.error||'Não foi possível salvar.');return}
    router.push(`/prospeccao/${r.id}`)
  }

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3"><Link href="/prospeccao" className="rounded-xl border p-2 text-slate-600"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Prospecção em campo</p><h1 className="font-bold text-slate-900">Pré-cadastro rápido</h1></div></div></header>
    <form onSubmit={salvar} className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-32">
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><UserRound size={17} className="text-blue-600"/><div><h2 className="font-bold">Identificação</h2><p className="text-xs text-slate-500">Preencha o que conseguir agora. Só o primeiro campo é obrigatório.</p></div></div><div className="space-y-3"><label className="block text-xs font-semibold text-slate-600">Cliente ou identificação da obra *<input autoFocus value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: João Silva ou Obra Rua Brasil, 250" className="mt-1 w-full rounded-xl border px-3 py-3 text-base"/></label><div className="grid gap-3 sm:grid-cols-2"><input value={telefone} onChange={e=>setTelefone(e.target.value)} inputMode="tel" placeholder="Telefone / WhatsApp" className="rounded-xl border px-3 py-3 text-sm"/><input value={nomeObra} onChange={e=>setNomeObra(e.target.value)} placeholder="Nome da obra" className="rounded-xl border px-3 py-3 text-sm"/></div></div></section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MapPin size={17} className="text-emerald-600"/><div><h2 className="font-bold">Local da obra</h2><p className="text-xs text-slate-500">Endereço digitado e ponto exato do GPS.</p></div></div><button type="button" onClick={capturarLocalizacao} disabled={capturando} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><LocateFixed size={15}/>{capturando?'Capturando...':'Usar localização'}</button></div><div className="grid gap-3 sm:grid-cols-2"><input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade" className="rounded-xl border px-3 py-3 text-sm"/><input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Bairro" className="rounded-xl border px-3 py-3 text-sm"/><input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Rua e número" className="rounded-xl border px-3 py-3 text-sm sm:col-span-2"/><input value={complemento} onChange={e=>setComplemento(e.target.value)} placeholder="Complemento / referência" className="rounded-xl border px-3 py-3 text-sm sm:col-span-2"/></div>{latitude!=null&&longitude!=null&&<p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Check size={14}/>Localização capturada · precisão aproximada de {Math.round(precisao||0)} m</p>}</section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">Pessoas da obra</h2><p className="text-xs text-slate-500">Pedreiro, mestre de obras, arquiteto, engenheiro ou construtora.</p></div><button type="button" onClick={novoContato} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Plus size={14}/>Adicionar</button></div><div className="space-y-3">{contatos.map(c=><div key={c.id} className="rounded-xl border bg-slate-50 p-3"><div className="grid gap-2 sm:grid-cols-[150px_1fr_1fr_auto]"><select value={c.papel} onChange={e=>editarContato(c.id,{papel:e.target.value as PapelContatoProspeccao})} className="rounded-lg border bg-white px-2 py-2 text-sm">{PAPEIS_CONTATO.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select><input value={c.nome} onChange={e=>editarContato(c.id,{nome:e.target.value})} placeholder="Nome" className="rounded-lg border px-3 py-2 text-sm"/><input value={c.telefone} onChange={e=>editarContato(c.id,{telefone:e.target.value})} placeholder="Telefone" className="rounded-lg border px-3 py-2 text-sm"/><button type="button" onClick={()=>setContatos(prev=>prev.filter(x=>x.id!==c.id))} className="rounded-lg border bg-white p-2 text-red-500"><Trash2 size={16}/></button></div></div>)}{contatos.length===0&&<button type="button" onClick={novoContato} className="w-full rounded-xl border border-dashed py-5 text-sm text-slate-400">+ Registrar uma pessoa da obra</button>}</div></section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-bold">Oportunidade</h2><div className="mt-3 space-y-3"><select value={fase} onChange={e=>setFase(e.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm"><option value="">Fase da obra</option>{FASES.map(f=><option key={f}>{f}</option>)}</select><div><p className="mb-2 text-xs font-semibold text-slate-600">Interesses identificados</p><div className="flex flex-wrap gap-2">{INTERESSES.map(i=><button type="button" key={i} onClick={()=>alternarInteresse(i)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${interesses.includes(i)?'border-blue-600 bg-blue-50 text-blue-700':'text-slate-500'}`}>{i}</button>)}</div></div><div><p className="mb-2 text-xs font-semibold text-slate-600">Temperatura</p><div className="grid grid-cols-3 gap-2">{(['frio','morno','quente'] as const).map(t=><button type="button" key={t} onClick={()=>setTemperatura(t)} className={`rounded-xl border py-2.5 text-sm font-semibold capitalize ${temperatura===t?'border-slate-900 bg-slate-900 text-white':'text-slate-500'}`}>{t==='frio'?'❄️ ':t==='morno'?'🌤️ ':'🔥 '}{t}</button>)}</div></div><textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={4} placeholder="O que você observou na obra?" className="w-full rounded-xl border px-3 py-3 text-sm"/></div></section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-bold">Próximo passo</h2><p className="mb-3 text-xs text-slate-500">Se já souber quando retornar, isso entrará na agenda.</p><div className="grid gap-3 sm:grid-cols-2"><input value={proximaAcao} onChange={e=>setProximaAcao(e.target.value)} placeholder="Ex.: ligar para pedir o projeto" className="rounded-xl border px-3 py-3 text-sm"/><input type="datetime-local" value={proximaAcaoEm} onChange={e=>setProximaAcaoEm(e.target.value)} className="rounded-xl border px-3 py-3 text-sm"/></div></section>
      {erro&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}
      <div className="fixed inset-x-0 bottom-[calc(4.3rem+env(safe-area-inset-bottom))] z-40 border-t bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0"><button disabled={salvando} className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"><Check size={17}/>{salvando?'Salvando...':'Salvar prospecção'}</button></div>
    </form>
  </div>
}
