'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Check, LocateFixed, MapPin } from 'lucide-react'
import { anexarFotosProspeccao } from '@/lib/prospeccaoFotos'
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
  const [faixaDe,setFaixaDe]=useState('')
  const [faixaAte,setFaixaAte]=useState('')
  const [fotos,setFotos]=useState<File[]>([])
  const [cidade,setCidade]=useState('')
  const [uf,setUf]=useState('')
  const [cepsRua,setCepsRua]=useState<Array<{cep:string;rua:string;bairro:string;trecho:string}>>([])
  const [consultandoRua,setConsultandoRua]=useState(false)
  const [bairro,setBairro]=useState('')
  const [cep,setCep]=useState('')
  const [consultandoCep,setConsultandoCep]=useState(false)
  const [endereco,setEndereco]=useState('')
  const [observacoes,setObservacoes]=useState('')
  const [resultado,setResultado]=useState('identificada')
  const [latitude,setLatitude]=useState<number|null>(null)
  const [longitude,setLongitude]=useState<number|null>(null)
  const [precisao,setPrecisao]=useState<number|null>(null)
  const [capturando,setCapturando]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')
  const [avisoEndereco,setAvisoEndereco]=useState('')

  async function buscarPeloCep(){
    if(cep.replace(/\D/g,'').length!==8){setAvisoEndereco('Informe um CEP com 8 dígitos.');return}
    setConsultandoCep(true)
    setAvisoEndereco('Consultando a base postal...')
    try{
      const resposta=await fetch('/api/geocodificacao/cep?cep='+encodeURIComponent(cep))
      const dados=await resposta.json() as {cep?:string;rua?:string;bairro?:string;cidade?:string;uf?:string;error?:string}
      if(!resposta.ok) throw new Error(dados.error||'CEP não encontrado.')
      setCep(dados.cep||cep)
      if(dados.rua) setEndereco(dados.rua)
      if(dados.bairro) setBairro(dados.bairro)
      if(dados.cidade) setCidade(dados.cidade)
      if(dados.uf) setUf(dados.uf)
      setAvisoEndereco('CEP consultado na base postal. Confira o número e os dados da obra.')
    }catch(e){
      setAvisoEndereco(e instanceof Error?e.message:'Falha na consulta do CEP.')
    }finally{setConsultandoCep(false)}
  }

  async function buscarCEPsRua(){
    if(!uf||!cidade.trim()||!endereco.trim())return
    setConsultandoRua(true);setCepsRua([])
    try{
      const query=new URLSearchParams({uf,cidade,rua:endereco})
      const response=await fetch('/api/geocodificacao/ceps-rua?'+query.toString())
      const dados=await response.json() as {itens?:Array<{cep:string;rua:string;bairro:string;trecho:string}>;aviso?:string;error?:string}
      if(!response.ok)throw Error(dados.error||'Falha na consulta de CEPs.')
      setCepsRua(dados.itens||[])
      setAvisoEndereco(dados.itens?.length?dados.aviso||'Escolha o CEP correspondente ao endereço. Se houver trechos diferentes, confira a numeração.':'Nenhum CEP desta rua foi confirmado na base postal.')
    }catch(e){setAvisoEndereco(e instanceof Error?e.message:'Falha ao procurar CEPs da rua.')}
    finally{setConsultandoRua(false)}
  }

  async function preencherEndereco(lat:number,lon:number){
    setAvisoEndereco('Identificando cidade, bairro e rua...')
    try{
      const response=await fetch(`/api/geocodificacao/reversa?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
      if(!response.ok) throw new Error('geocodificacao')
      const dados=await response.json() as {cidade?:string;bairro?:string;rua?:string;numero?:string;cep?:string;uf?:string;cepOrigem?:string|null;cepAviso?:string}
      if(dados.cidade) setCidade(dados.cidade)
      if(dados.uf) setUf(dados.uf)
      if(dados.bairro) setBairro(dados.bairro)
      if(dados.rua) setEndereco(dados.rua)
      if(dados.numero) setNumero(dados.numero)
      setCep(dados.cep||'')
      setAvisoEndereco(dados.cepAviso||'GPS capturado. Confira o endereço antes de salvar.')
    }catch{
      setAvisoEndereco('Localização salva. Não foi possível preencher o endereço automaticamente; você pode completar manualmente.')
    }
  }

  function capturarLocalizacao(){
    if(!navigator.geolocation){setErro('Este aparelho não disponibiliza localização.');return}
    setCapturando(true);setErro('');setAvisoEndereco('')
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude
      const lon=pos.coords.longitude
      setLatitude(lat);setLongitude(lon);setPrecisao(pos.coords.accuracy)
      await preencherEndereco(lat,lon)
      setCapturando(false)
    },()=>{setErro('Não foi possível obter a localização. Autorize o GPS e tente novamente.');setCapturando(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }

  async function salvar(e:React.FormEvent){
    e.preventDefault();setErro('')
    const inicio=faixaDe.trim()?Number(faixaDe):null
    const fim=faixaAte.trim()?Number(faixaAte):null
    if((inicio!==null&&(!Number.isInteger(inicio)||inicio<1))||
       (fim!==null&&(!Number.isInteger(fim)||inicio===null||fim<inicio))){
      setErro('Confira a faixa de números: informe um número inicial válido e o final igual ou maior.');return
    }
    const escolha=RESULTADOS.find(r=>r.id===resultado) || RESULTADOS[0]
    const identificacao=[endereco.trim(),numero.trim()].filter(Boolean).join(', ') || `Obra ${numero.trim()||'identificada em campo'}`
    setSalvando(true)
    const r=await criarProspeccao({nome_cliente:identificacao,nome_obra:identificacao,cidade,bairro,cep,numero_inicial:inicio,numero_final:fim,endereco:[endereco.trim(),numero.trim()].filter(Boolean).join(', '),latitude,longitude,precisao_m:precisao,observacoes,proxima_acao:escolha.proxima})
    if(!r.ok||!r.id){setSalvando(false);setErro(r.error||'Não foi possível salvar.');return}
    const dados=await buscarProspeccao(r.id)
    if(dados.prospeccao){
      await registrarInteracao(dados.prospeccao,{tipo:'visita',descricao:`Resultado da passagem: ${escolha.titulo}.${observacoes.trim()?` ${observacoes.trim()}`:''}`,status_novo:escolha.status,proxima_acao:escolha.proxima})
    }
    if(fotos.length){
      try {await anexarFotosProspeccao(r.id,fotos)}
      catch(e){alert('Prospecção salva, mas as fotos não foram enviadas: '+(e instanceof Error?e.message:'erro desconhecido')+'. Abra a ficha para anexá-las novamente.')}
    }
    setSalvando(false);router.push(`/prospeccao/${r.id}`)
  }

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3"><Link href="/prospeccao" className="rounded-xl border p-2 text-slate-600"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Prospecção em campo</p><h1 className="font-bold text-slate-900">Registrar obra aqui</h1></div></div></header>
    <form onSubmit={salvar} className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-32">
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MapPin size={18} className="text-blue-600"/><div><h2 className="font-bold">Local da obra</h2><p className="text-xs text-slate-500">Use o GPS para preencher o endereço e complete só o que faltar.</p></div></div><button type="button" onClick={capturarLocalizacao} disabled={capturando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-60"><LocateFixed size={15}/>{capturando?'Localizando...':'Usar localização'}</button></div>{latitude!=null&&longitude!=null&&<p className="mb-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Check size={14}/>Localização capturada · precisão aproximada de {Math.round(precisao||0)} m</p>}{avisoEndereco&&<p className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">{avisoEndereco}</p>}<div className="grid gap-3 sm:grid-cols-2"><input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade" className="rounded-xl border px-3 py-3 text-sm"/><input value={uf} onChange={e=>setUf(e.target.value.toUpperCase().slice(0,2))} maxLength={2} placeholder="UF (SP)" className="rounded-xl border px-3 py-3 text-sm"/><input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Bairro" className="rounded-xl border px-3 py-3 text-sm"/><input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Rua / referência" className="rounded-xl border px-3 py-3 text-sm"/><input value={numero} onChange={e=>setNumero(e.target.value)} inputMode="numeric" placeholder="Número do imóvel" className="rounded-xl border px-3 py-3 text-sm"/><input value={cep} onChange={e=>setCep(e.target.value)} inputMode="numeric" maxLength={9} placeholder="CEP (00000-000)" aria-label="CEP da obra" className="rounded-xl border px-3 py-3 text-sm sm:col-span-2"/><button type="button" disabled={consultandoCep||cep.replace(/\D/g,'').length!==8} onClick={()=>void buscarPeloCep()} className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 disabled:opacity-40 sm:col-span-2">{consultandoCep?'Consultando CEP...':'Consultar CEP e preencher endereço'}</button><button type="button" onClick={()=>void buscarCEPsRua()} disabled={consultandoRua||uf.length!==2||cidade.trim().length<3||endereco.trim().length<3} className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-2.5 text-xs font-bold text-teal-700 disabled:opacity-40 sm:col-span-2">{consultandoRua?'Procurando...':'Buscar CEPs desta rua'}</button></div>
      {cepsRua.length>0&&<div className="mt-3 space-y-2 rounded-xl border p-3"><p className="text-xs font-bold">CEPs encontrados nesta rua (escolha conforme o trecho)</p>{cepsRua.map(item=><button key={item.cep+'-'+item.bairro+'-'+item.trecho} type="button" onClick={()=>{setCep(item.cep);if(item.bairro)setBairro(item.bairro);setEndereco(item.rua);setCepsRua([]);setAvisoEndereco('CEP selecionado. Confirme o número exato ou a faixa observada na visita.')}} className="block w-full rounded-lg border p-2 text-left text-xs hover:bg-blue-50"><b>{item.cep}</b> · {item.bairro||'Bairro não informado'}{item.trecho&&<span className="block text-slate-500">Trecho postal informado: {item.trecho}</span>}</button>)}</div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Faixa de números observada · de<input value={faixaDe} onChange={e=>setFaixaDe(e.target.value)} inputMode="numeric" type="number" min="1" placeholder="Ex.: 100" className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"/></label>
        <label className="text-xs font-semibold text-slate-700">Até<input value={faixaAte} onChange={e=>setFaixaAte(e.target.value)} inputMode="numeric" type="number" min="1" placeholder="Ex.: 250" className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"/></label>
      </div>
      <p className="mt-2 text-xs text-slate-500">A numeração da rua é registrada conforme sua visita; CEP e GPS não garantem a faixa exata.</p>
      <div className="mt-3 rounded-xl border border-dashed p-3"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-blue-700"><Camera size={17}/>Adicionar fotos do local<input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" className="sr-only" onChange={e=>setFotos(Array.from(e.target.files||[]))}/></label>{fotos.length>0&&<p className="mt-2 text-xs text-slate-600">{fotos.length} foto(s) selecionada(s). Cada arquivo até 6 MB.</p>}</div>
      <textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={3} placeholder="Observação rápida (opcional)" className="mt-3 w-full rounded-xl border px-3 py-3 text-sm"/></section>
      <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-bold">Resultado da passagem</h2><p className="mb-3 text-xs text-slate-500">Isso diferencia obra encontrada de visita ou contato realizado.</p><div className="space-y-2">{RESULTADOS.map(item=><button type="button" key={item.id} onClick={()=>setResultado(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${resultado===item.id?'border-blue-600 bg-blue-50 ring-1 ring-blue-600':'bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{item.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{item.descricao}</p></div><span className={`mt-1 h-4 w-4 rounded-full border ${resultado===item.id?'border-[5px] border-blue-600':'border-slate-300'}`}/></div></button>)}</div></section>
      {erro&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}
      <div className="fixed inset-x-0 bottom-[calc(4.3rem+env(safe-area-inset-bottom))] z-40 border-t bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0"><button disabled={salvando||capturando} className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"><Check size={17}/>{salvando?'Salvando...':'Salvar registro'}</button></div>
    </form>
  </div>
}
