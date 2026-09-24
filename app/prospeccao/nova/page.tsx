'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, LocateFixed, MapPin } from 'lucide-react'
import { criarProspeccao, registrarInteracao, buscarProspeccao, type StatusProspeccao } from '@/lib/prospeccao'

const RESULTADOS: Array<{id:string; titulo:string; descricao:string; status:StatusProspeccao; proxima?:string}> = [
  {id:'identificada',titulo:'Só identifiquei a obra',descricao:'Passei pelo local e apenas marquei.',status:'nova'},
  {id:'ninguem',titulo:'Não encontrei ninguém',descricao:'Não havia ninguém na obra.',status:'tentando_contato',proxima:'Retornar à obra'},
  {id:'conversa',titulo:'Conversei com alguém',descricao:'Falei com alguém no local.',status:'contato_realizado'},
  {id:'contato',titulo:'Consegui contato',descricao:'Obtive telefone ou outro contato.',status:'contato_realizado'},
  {id:'retornar',titulo:'Preciso retornar',descricao:'É necessário fazer uma nova visita.',status:'aguardando_retorno',proxima:'Retornar à obra'},
  {id:'oportunidade',titulo:'Virou oportunidade',descricao:'Há potencial comercial para orçamento.',status:'oportunidade_qualificada'},
  {id:'sem_interesse',titulo:'Sem interesse',descricao:'Sem interesse comercial no momento.',status:'sem_interesse'},
]

export default function NovaProspeccaoPage(){
  const router=useRouter()
  const [numero,setNumero]=useState('')
  const [cidade,setCidade]=useState('')
  const [bairro,setBairro]=useState('')
  const [endereco,setEndereco]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [resultado,setResultado]=useState('identificada')
  const [latitude,setLatitude]=useState<number|null>(null)
  const [longitude,setLongitude]=useState<number|null>(null)
  const [precisao,setPrecisao]=useState<number|null>(null)
  const [capturando,setCapturando]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')

  function capturarLocalizacao(){
    if(!navigator.geolocation){setErro('Este aparelho não disponibiliza localização.');return}
    setCapturando(true);setErro('')
    navigator.geolocation.getCurrentPosition(pos=>{setLatitude(pos.coords.latitude);setLongitude(pos.coords.longitude);setPrecisao(pos.coords.accuracy);setCapturando(false)},()=>{setErro('Não foi possível obter a localização. Autorize o GPS e tente novamente.');setCapturando(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }

  async function salvar(e:React.FormEvent){
    e.preventDefault();setErro('')
    const escolha=RESULTADOS.find(r=>r.id===resultado) || RESULTADOS[0]
    const identificacao=[endereco.trim(),numero.trim()].filter(Boolean).join(', ') || `Obra ${numero.trim()||'identificada em campo'}`
    setSalvando(true)
    const r=await criarProspeccao({nome_cliente:identificacao,nome_obra:identificacao,cidade,bairro,endereco:[endereco.trim(),numero.trim()].filter(Boolean).join(', '),latitude,longitude,precisao_m:precisao,observacoes,proxima_acao:escolha.proxima})
    if(!r.ok||!r.id){setSalvando(false);setErro(r.error||'Não foi possível salvar.');return}
    const dados=await buscarProspeccao(r.id)
    if(dados.prospeccao){
      await registrarInteracao(dados.prospeccao,{tipo:'visita',descricao:`Resultado da passagem: ${escolha.titulo}.${observacoes.trim()?` ${observacoes.trim()}`:''}`,status_novo:escolha.status,proxima_acao:escolha.proxima})
    }
    setSalvando(false);router.push(`/prospeccao/${r.id}`)
  }

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3"><Link href="/prospeccao" className="rounded-xl border p-2 text-slate-600"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Prospecção em campo</p><h1 className="font-bold text-slate-900">Registrar obra aqui</h1></div></div></header>
    <form onSubmit={salvar} className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-32">
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MapPin size={18} className="text-blue-600"/><div><h2 className="font-bold">Local da obra</h2><p className="text-xs text-slate-500">Marque primeiro. Complete os detalhes depois.</p></div></div><button type="button" onClick={capturarLocalizacao} disabled={capturando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><LocateFixed size={15}/>{capturando?'Capturando...':'Usar localização'}</button></div>{latitude!=null&&longitude!=null&&<p className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Check size={14}/>Localização capturada · precisão aproximada de {Math.round(precisao||0)} m</p>}<div className="grid gap-3 sm:grid-cols-2"><input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade" className="rounded-xl border px-3 py-3 text-sm"/><input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Bairro" className="rounded-xl border px-3 py-3 text-sm"/><input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Rua / referência" className="rounded-xl border px-3 py-3 text-sm"/><input value={numero} onChange={e=>setNumero(e.target.value)} inputMode="numeric" placeholder="Número do imóvel" className="rounded-xl border px-3 py-3 text-sm"/></div><textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={3} placeholder="Observação rápida (opcional)" className="mt-3 w-full rounded-xl border px-3 py-3 text-sm"/></section>
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-bold">Resultado da passagem</h2><p className="mb-3 text-xs text-slate-500">Isso diferencia obra encontrada de visita ou contato realizado.</p><div className="space-y-2">{RESULTADOS.map(item=><button type="button" key={item.id} onClick={()=>setResultado(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${resultado===item.id?'border-blue-600 bg-blue-50 ring-1 ring-blue-600':'bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{item.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{item.descricao}</p></div><span className={`mt-1 h-4 w-4 rounded-full border ${resultado===item.id?'border-[5px] border-blue-600':'border-slate-300'}`}/></div></button>)}</div></section>
      {erro&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}
      <div className="fixed inset-x-0 bottom-[calc(4.3rem+env(safe-area-inset-bottom))] z-40 border-t bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0"><button disabled={salvando} className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"><Check size={17}/>{salvando?'Salvando...':'Salvar registro'}</button></div>
    </form>
  </div>
}
