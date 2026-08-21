'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, CheckCircle2, Loader2, MapPin, Phone, Send, ShieldCheck, Wrench } from 'lucide-react'
import SignaturePad from '@/components/system/SignaturePad'

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
    atendimento_concluido_em: string | null
  }
  empresa: Record<string, unknown> | null
  etapa: string
}

function hojeLocal() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function AssistenciaAcessoTecnicoPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token || ''
  const [dados, setDados] = useState<DadosExternos | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [tecnicoNome, setTecnicoNome] = useState('')
  const [dataAtendimento, setDataAtendimento] = useState(hojeLocal())
  const [servicoRealizado, setServicoRealizado] = useState('')
  const [materiaisUtilizados, setMateriaisUtilizados] = useState('')
  const [observacoesAtendimento, setObservacoesAtendimento] = useState('')
  const [assinaturaTecnico, setAssinaturaTecnico] = useState('')
  const [assinaturaCliente, setAssinaturaCliente] = useState('')

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

  async function salvar() {
    if (!tecnicoNome.trim()) {
      setErro('Informe o nome do técnico.')
      return
    }
    if (!assinaturaTecnico || !assinaturaCliente) {
      setErro('Colete a assinatura do técnico e a assinatura do cliente antes de concluir.')
      return
    }

    setSalvando(true)
    setErro('')
    const resp = await fetch(`/api/assistencia/acesso/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tecnicoNome,
        dataAtendimento,
        servicoRealizado,
        materiaisUtilizados,
        observacoesAtendimento,
        assinaturaTecnico,
        assinaturaCliente,
      }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)

    if (!resp.ok) {
      setErro(json.error || 'Não foi possível salvar o atendimento.')
      return
    }
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
          <h1 className="mt-3 text-xl font-bold text-slate-950">Atendimento salvo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Os dados e as duas assinaturas já voltaram para a assistência no Atlas One e passam a aparecer na Ordem de Serviço.</p>
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
            <p className="text-xs text-slate-500">Assistência técnica · preenchimento em campo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Chamado</p>
              <h1 className="mt-1 text-xl font-bold text-slate-950">{dados.assistencia.cliente_nome}</h1>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{dados.etapa || dados.assistencia.status}</span>
          </div>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600">
            {dados.assistencia.cliente_whatsapp && <p className="flex items-center gap-2"><Phone size={15} className="text-slate-400"/> {dados.assistencia.cliente_whatsapp}</p>}
            {endereco && <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400"/> {endereco}</p>}
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
          {salvando ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>} {salvando ? 'Salvando...' : 'Concluir e enviar para o Atlas'}
        </button>
        <p className="text-center text-[11px] leading-5 text-slate-400">Este link dá acesso somente a esta assistência. As assinaturas ficam vinculadas à Ordem de Serviço.</p>
      </main>
    </div>
  )
}
