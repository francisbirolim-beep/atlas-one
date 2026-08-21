'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  PlayCircle,
  Send,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react'
import SignaturePad from '@/components/system/SignaturePad'

type GpsPayload = {
  latitude: number
  longitude: number
  precisao: number | null
}

type DadosExternos = {
  acesso: {
    id: string
    nome_tecnico: string | null
    telefone_tecnico: string | null
    expira_em: string | null
  }
  assistencia: {
    id: string
    created_at: string
    cliente_nome: string
    cliente_whatsapp: string | null
    cidade: string | null
    endereco: string | null
    numero: string | null
    bairro: string | null
    descricao_problema: string | null
    fotos_urls: string[] | null
    status: string
    criado_por_nome: string | null
    tecnico_nome: string | null
    data_atendimento: string | null
    servico_realizado: string | null
    materiais_utilizados: string | null
    observacoes_atendimento: string | null
    assinatura_tecnico: string | null
    assinatura_cliente: string | null
    atendimento_iniciado_em: string | null
    atendimento_concluido_em: string | null
    duracao_atendimento_segundos: number | null
    gps_inicio_latitude: number | null
    gps_inicio_longitude: number | null
    gps_inicio_precisao_m: number | null
    gps_inicio_capturado_em: string | null
    gps_fim_latitude: number | null
    gps_fim_longitude: number | null
    gps_fim_precisao_m: number | null
    gps_fim_capturado_em: string | null
  }
  empresa: Record<string, unknown> | null
  etapa: string
}

function hojeLocal() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function somenteNumeros(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '')
}

function telefoneWhatsApp(valor: string | null | undefined) {
  const digitos = somenteNumeros(valor)
  if (!digitos) return ''
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

function formatarTempo(segundos: number) {
  const total = Math.max(0, Math.floor(segundos))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

async function capturarGps(): Promise<{ gps: GpsPayload | null; mensagem: string }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { gps: null, mensagem: 'GPS não disponível neste aparelho. O atendimento continuará sem localização.' }
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      posicao => resolve({
        gps: {
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisao: Number.isFinite(posicao.coords.accuracy) ? posicao.coords.accuracy : null,
        },
        mensagem: `Localização registrada${Number.isFinite(posicao.coords.accuracy) ? ` com precisão aproximada de ${Math.round(posicao.coords.accuracy)} m` : ''}.`,
      }),
      () => resolve({
        gps: null,
        mensagem: 'Localização não autorizada ou indisponível. O atendimento continuará sem GPS.',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export default function AssistenciaAcessoTecnicoPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token || ''
  const [dados, setDados] = useState<DadosExternos | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [tecnicoNome, setTecnicoNome] = useState('')
  const [dataAtendimento, setDataAtendimento] = useState(hojeLocal())
  const [servicoRealizado, setServicoRealizado] = useState('')
  const [materiaisUtilizados, setMateriaisUtilizados] = useState('')
  const [observacoesAtendimento, setObservacoesAtendimento] = useState('')
  const [assinaturaTecnico, setAssinaturaTecnico] = useState('')
  const [assinaturaCliente, setAssinaturaCliente] = useState('')
  const [mensagemGps, setMensagemGps] = useState('')
  const [mensagemEndereco, setMensagemEndereco] = useState('')
  const [relogio, setRelogio] = useState(Date.now())

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      const resp = await fetch(`/api/assistencia/acesso/${token}`, { cache: 'no-store' })
      const json = await resp.json().catch(() => ({}))
      if (!ativo) return
      if (!resp.ok) {
        setErro(json.error || 'Não foi possível abrir esta assistência.')
        setCarregando(false)
        return
      }

      const recebidos = json as DadosExternos
      setDados(recebidos)
      setTecnicoNome(recebidos.assistencia.tecnico_nome || recebidos.acesso.nome_tecnico || '')
      setDataAtendimento(recebidos.assistencia.data_atendimento || hojeLocal())
      setServicoRealizado(recebidos.assistencia.servico_realizado || '')
      setMateriaisUtilizados(recebidos.assistencia.materiais_utilizados || '')
      setObservacoesAtendimento(recebidos.assistencia.observacoes_atendimento || '')
      setAssinaturaTecnico(recebidos.assistencia.assinatura_tecnico || '')
      setAssinaturaCliente(recebidos.assistencia.assinatura_cliente || '')
      setCarregando(false)
    }
    if (token) void carregar()
    return () => { ativo = false }
  }, [token])

  useEffect(() => {
    if (!dados?.assistencia.atendimento_iniciado_em || dados.assistencia.atendimento_concluido_em) return
    const timer = window.setInterval(() => setRelogio(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [dados?.assistencia.atendimento_iniciado_em, dados?.assistencia.atendimento_concluido_em])

  const nomeEmpresa = useMemo(() => {
    const empresa = dados?.empresa
    const nomeFantasia = typeof empresa?.nomeFantasia === 'string' ? empresa.nomeFantasia.trim() : ''
    const nome = typeof empresa?.nome === 'string' ? empresa.nome.trim() : ''
    return nomeFantasia || nome || 'Atlas One'
  }, [dados])

  const logoUrl = typeof dados?.empresa?.logoUrl === 'string' ? dados.empresa.logoUrl : ''
  const endereco = dados
    ? [dados.assistencia.endereco, dados.assistencia.numero, dados.assistencia.bairro, dados.assistencia.cidade].filter(Boolean).join(', ')
    : ''
  const mapaEndereco = endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : ''
  const telefoneCliente = somenteNumeros(dados?.assistencia.cliente_whatsapp)
  const whatsappCliente = telefoneWhatsApp(dados?.assistencia.cliente_whatsapp)
  const iniciou = Boolean(dados?.assistencia.atendimento_iniciado_em)
  const terminou = Boolean(dados?.assistencia.atendimento_concluido_em)
  const segundosDecorridos = dados?.assistencia.duracao_atendimento_segundos ?? (
    dados?.assistencia.atendimento_iniciado_em
      ? Math.max(0, Math.round(((dados.assistencia.atendimento_concluido_em ? new Date(dados.assistencia.atendimento_concluido_em).getTime() : relogio) - new Date(dados.assistencia.atendimento_iniciado_em).getTime()) / 1000))
      : 0
  )

  async function copiarEndereco() {
    if (!endereco) return
    try {
      await navigator.clipboard.writeText(endereco)
      setMensagemEndereco('Endereço copiado.')
    } catch {
      setMensagemEndereco('Não foi possível copiar automaticamente. Selecione o endereço acima.')
    }
  }

  async function iniciarAssistencia() {
    if (!tecnicoNome.trim()) {
      setErro('Informe o nome do técnico antes de iniciar.')
      return
    }

    setIniciando(true)
    setErro('')
    setMensagemGps('Solicitando localização do aparelho...')
    const localizacao = await capturarGps()

    const resp = await fetch(`/api/assistencia/acesso/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'iniciar',
        tecnicoNome,
        dataAtendimento,
        gps: localizacao.gps,
      }),
    })
    const json = await resp.json().catch(() => ({}))
    setIniciando(false)

    if (!resp.ok) {
      setErro(json.error || 'Não foi possível iniciar a assistência.')
      setMensagemGps('')
      return
    }

    setMensagemGps(localizacao.mensagem)
    setRelogio(Date.now())
    setDados(prev => prev ? {
      ...prev,
      etapa: json.etapa || 'Em atendimento',
      assistencia: {
        ...prev.assistencia,
        status: 'em_atendimento',
        atendimento_iniciado_em: json.iniciadoEm || prev.assistencia.atendimento_iniciado_em || new Date().toISOString(),
        gps_inicio_latitude: localizacao.gps?.latitude ?? prev.assistencia.gps_inicio_latitude,
        gps_inicio_longitude: localizacao.gps?.longitude ?? prev.assistencia.gps_inicio_longitude,
        gps_inicio_precisao_m: localizacao.gps?.precisao ?? prev.assistencia.gps_inicio_precisao_m,
        gps_inicio_capturado_em: localizacao.gps ? new Date().toISOString() : prev.assistencia.gps_inicio_capturado_em,
      },
    } : prev)
  }

  async function salvar() {
    if (!tecnicoNome.trim()) {
      setErro('Informe o nome do técnico.')
      return
    }
    if (!iniciou) {
      setErro('Clique em “Iniciar assistência” quando chegar ao local antes de concluir.')
      return
    }
    if (!assinaturaTecnico || !assinaturaCliente) {
      setErro('Colete a assinatura do técnico e a assinatura do cliente antes de concluir.')
      return
    }

    setSalvando(true)
    setErro('')
    setMensagemGps('Registrando localização de conclusão...')
    const localizacao = await capturarGps()

    const resp = await fetch(`/api/assistencia/acesso/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'concluir',
        tecnicoNome,
        dataAtendimento,
        servicoRealizado,
        materiaisUtilizados,
        observacoesAtendimento,
        assinaturaTecnico,
        assinaturaCliente,
        gps: localizacao.gps,
      }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)

    if (!resp.ok) {
      setErro(json.error || 'Não foi possível salvar o atendimento.')
      setMensagemGps('')
      return
    }

    setMensagemGps(localizacao.mensagem)
    setDados(prev => prev ? {
      ...prev,
      etapa: json.etapa || 'Resolvido',
      assistencia: {
        ...prev.assistencia,
        status: 'resolvido',
        atendimento_concluido_em: json.concluidoEm || new Date().toISOString(),
        duracao_atendimento_segundos: json.duracaoSegundos ?? prev.assistencia.duracao_atendimento_segundos,
        gps_fim_latitude: localizacao.gps?.latitude ?? prev.assistencia.gps_fim_latitude,
        gps_fim_longitude: localizacao.gps?.longitude ?? prev.assistencia.gps_fim_longitude,
        gps_fim_precisao_m: localizacao.gps?.precisao ?? prev.assistencia.gps_fim_precisao_m,
        gps_fim_capturado_em: localizacao.gps ? new Date().toISOString() : prev.assistencia.gps_fim_capturado_em,
      },
    } : prev)
    setConcluido(true)
  }

  if (carregando) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-400"><Loader2 className="animate-spin" /></div>
  }

  if (erro && !dados) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <ShieldCheck size={38} className="mx-auto text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Acesso indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{erro}</p>
        </div>
      </div>
    )
  }

  if (!dados) return null

  if (concluido) {
    return (
      <div className="grid min-h-screen place-items-center bg-emerald-50 px-4">
        <div className="max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <CheckCircle2 size={52} className="mx-auto text-emerald-600" />
          <h1 className="mt-3 text-xl font-bold text-slate-950">Assistência concluída</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">O atendimento foi enviado ao Atlas, movido para a etapa de resolvido e ficou registrado com duração de <strong>{formatarTempo(jsonSafeNumber(dados.assistencia.duracao_atendimento_segundos))}</strong>.</p>
          {mensagemGps && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{mensagemGps}</p>}
          <button type="button" onClick={() => setConcluido(false)} className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Revisar atendimento</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={nomeEmpresa} className="h-11 w-24 object-contain object-left" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white"><Wrench size={20}/></div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-950">{nomeEmpresa}</p>
            <p className="text-xs text-slate-500">Assistência técnica · atendimento em campo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Cliente</p>
              <h1 className="mt-1 text-xl font-bold text-slate-950">{dados.assistencia.cliente_nome}</h1>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{dados.etapa || dados.assistencia.status}</span>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {dados.assistencia.cliente_whatsapp && (
              <div className="flex flex-wrap items-center gap-2">
                <Phone size={15} className="text-slate-400"/>
                <a href={telefoneCliente ? `tel:${telefoneCliente}` : undefined} className="font-medium text-slate-700 underline-offset-2 hover:underline">{dados.assistencia.cliente_whatsapp}</a>
                {whatsappCliente && <a href={`https://wa.me/${whatsappCliente}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"><MessageCircle size={12}/> WhatsApp</a>}
              </div>
            )}

            {endereco && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="flex items-start gap-2 text-sm font-medium text-slate-700"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400"/> {endereco}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={mapaEndereco} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Navigation size={13}/> Abrir no Google Maps</a>
                  <button type="button" onClick={() => void copiarEndereco()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><Copy size={13}/> Copiar endereço</button>
                </div>
                {mensagemEndereco && <p className="mt-2 text-[11px] text-slate-500">{mensagemEndereco}</p>}
              </div>
            )}

            <p className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-400"/> Aberta em {new Date(dados.assistencia.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Problema relatado</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{dados.assistencia.descricao_problema || 'Sem descrição informada.'}</p>
          {dados.assistencia.fotos_urls && dados.assistencia.fotos_urls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {dados.assistencia.fotos_urls.slice(0, 6).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="aspect-[4/3] h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 shadow-sm ${iniciou ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
          {!iniciou ? (
            <>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"><MapPin size={19}/></div>
                <div>
                  <h2 className="font-bold text-slate-900">Chegou ao cliente?</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Ao iniciar, o aparelho pedirá sua permissão para registrar a localização deste momento. O GPS não fica rastreando você em segundo plano.</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Técnico responsável *</label>
                  <input value={tecnicoNome} onChange={e => setTecnicoNome(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Data do atendimento *</label>
                  <input type="date" value={dataAtendimento} onChange={e => setDataAtendimento(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                </div>
              </div>
              <button type="button" onClick={() => void iniciarAssistencia()} disabled={iniciando} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                {iniciando ? <Loader2 size={18} className="animate-spin"/> : <PlayCircle size={18}/>} {iniciando ? 'Iniciando...' : 'Iniciar assistência'}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Atendimento em campo</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">Iniciado às {new Date(dados.assistencia.atendimento_iniciado_em as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                {mensagemGps && <p className="mt-1 text-xs text-emerald-700">{mensagemGps}</p>}
              </div>
              <div className="rounded-xl bg-slate-950 px-4 py-2.5 text-center text-white">
                <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-slate-300"><Timer size={12}/> Tempo</p>
                <p className="mt-0.5 font-mono text-lg font-bold">{formatarTempo(segundosDecorridos)}</p>
              </div>
            </div>
          )}
        </section>

        {iniciou && !terminou && (
          <>
            <section className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Técnico responsável *</label>
                  <input value={tecnicoNome} onChange={e => setTecnicoNome(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Data do atendimento *</label>
                  <input type="date" value={dataAtendimento} onChange={e => setDataAtendimento(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Serviço realizado</label>
                <textarea value={servicoRealizado} onChange={e => setServicoRealizado(e.target.value)} rows={4} placeholder="Descreva o que foi executado..." className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Materiais / peças utilizados</label>
                <textarea value={materiaisUtilizados} onChange={e => setMateriaisUtilizados(e.target.value)} rows={3} placeholder="Ex.: roldana, borracha, silicone..." className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Observações</label>
                <textarea value={observacoesAtendimento} onChange={e => setObservacoesAtendimento(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm" />
              </div>
            </section>

            <SignaturePad label="Assinatura do técnico" value={assinaturaTecnico} onChange={setAssinaturaTecnico} />
            <SignaturePad label="Assinatura do cliente" value={assinaturaCliente} onChange={setAssinaturaCliente} />

            {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{erro}</p>}

            <button type="button" onClick={() => void salvar()} disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">
              {salvando ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>} {salvando ? 'Concluindo...' : 'Concluir assistência e enviar ao Atlas'}
            </button>
          </>
        )}

        {terminou && !concluido && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-4 text-center shadow-sm">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
            <h2 className="mt-2 font-bold text-slate-900">Atendimento já concluído</h2>
            <p className="mt-1 text-sm text-slate-500">Tempo registrado: {formatarTempo(segundosDecorridos)}. Os dados já estão no Atlas e na Ordem de Serviço.</p>
          </section>
        )}

        <p className="flex items-center justify-center gap-1 text-center text-[11px] leading-5 text-slate-400"><Clipboard size={12}/> O GPS é solicitado somente no início e na conclusão. Não há rastreamento contínuo em segundo plano.</p>
      </main>
    </div>
  )
}

function jsonSafeNumber(valor: number | null | undefined) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
}
