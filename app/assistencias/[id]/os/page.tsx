'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, Printer, ShieldAlert, Wrench } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, type IdentidadeEmpresa } from '@/lib/configGeral'
import { lerHomeUsuarioConfig } from '@/lib/homeUsuario'
import { supabase } from '@/lib/supabase'
import { salvarPdfOSAssistencia } from '@/lib/assistenciaPdf'
import type { Assistencia, DadosEmpresa } from '@/lib/tipos'

type EmpresaOS = DadosEmpresa & IdentidadeEmpresa

type AssistenciaAtendimento = Assistencia & {
  tecnico_nome?: string | null
  data_atendimento?: string | null
  servico_realizado?: string | null
  materiais_utilizados?: string | null
  observacoes_atendimento?: string | null
  assinatura_tecnico?: string | null
  assinatura_cliente?: string | null
  atendimento_concluido_em?: string | null
}

export default function OrdemServicoAssistenciaPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params?.id
  const [assistencia, setAssistencia] = useState<AssistenciaAtendimento | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaOS | null>(null)
  const [etapa, setEtapa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [negado, setNegado] = useState(false)
  const [salvandoPdf, setSalvandoPdf] = useState(false)
  const impressaoAutomaticaExecutada = useRef(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (!id) return
      const usuario = await usuarioAtual()
      if (!usuario) { if (ativo) { setNegado(true); setCarregando(false) }; return }

      const [{ data }, dadosEmpresa] = await Promise.all([
        supabase.from('assistencias').select('*').eq('id', id).maybeSingle(),
        lerDadosEmpresa(),
      ])
      if (!ativo) return
      const chamada = data as AssistenciaAtendimento | null
      if (!chamada) { setCarregando(false); return }

      const config = await lerHomeUsuarioConfig(usuario)
      const podeVerTudo = usuario.role === 'master' || config.assistenciasEscopo === 'todas'
      if (!podeVerTudo && chamada.criado_por_id !== usuario.id) {
        setNegado(true)
        setCarregando(false)
        return
      }

      setAssistencia(chamada)
      setEmpresa(dadosEmpresa as EmpresaOS | null)
      if (chamada.coluna_id) {
        const { data: coluna } = await supabase.from('assistencia_colunas').select('nome').eq('id', chamada.coluna_id).maybeSingle()
        if (ativo) setEtapa(coluna?.nome || '')
      }
      setCarregando(false)
    }
    void carregar()
    return () => { ativo = false }
  }, [id])

  useEffect(() => {
    if (carregando || !assistencia || negado) return
    if (searchParams.get('print') !== '1' || impressaoAutomaticaExecutada.current) return

    impressaoAutomaticaExecutada.current = true
    const timer = window.setTimeout(() => window.print(), 650)
    return () => window.clearTimeout(timer)
  }, [assistencia, carregando, negado, searchParams])

  async function salvarPdf() {
    if (!assistencia) return
    setSalvandoPdf(true)
    try {
      await salvarPdfOSAssistencia({ assistencia, empresa, etapa })
    } finally {
      setSalvandoPdf(false)
    }
  }

  if (carregando) return <div className="min-h-[70vh] grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>

  if (negado) {
    return <div className="min-h-[70vh] grid place-items-center px-4"><div className="max-w-md text-center"><ShieldAlert size={44} className="mx-auto mb-3 text-red-300"/><h1 className="font-semibold text-slate-800">Acesso não permitido</h1><p className="mt-2 text-sm text-slate-500">Este usuário não tem permissão para gerar a ordem de serviço deste chamado.</p><Link href="/assistencias" className="mt-4 inline-block text-sm text-brand-navy hover:underline">Voltar às assistências</Link></div></div>
  }

  if (!assistencia) return <div className="min-h-[70vh] grid place-items-center text-slate-500">Assistência não encontrada.</div>

  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Esquadrifácio'
  const endereco = [assistencia.endereco, assistencia.numero, assistencia.bairro, assistencia.cidade].filter(Boolean).join(', ')
  const numeroOS = assistencia.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const dadosEmpresaCabecalho = [empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : null, empresa?.cidadeUf, empresa?.tel, empresa?.email].filter(Boolean).join(' · ')
  const dataAtendimento = assistencia.data_atendimento
    ? new Date(`${assistencia.data_atendimento}T12:00:00`).toLocaleDateString('pt-BR')
    : ''

  return (
    <div className="os-assistencia min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .atlas-sidebar-shell, header.sticky, .print-hide, .fixed { display: none !important; }
          html, body { width: 210mm; min-height: 297mm; background: #fff !important; }
          body, main { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .os-assistencia { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .os-folha {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #0f172a !important;
          }
          .os-folha, .os-folha * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          .os-header { gap: 4mm !important; padding-bottom: 2.5mm !important; }
          .os-header-logo { width: 28mm !important; height: 12mm !important; }
          .os-header-fallback { width: 12mm !important; height: 12mm !important; border-radius: 2mm !important; }
          .os-header-title { font-size: 13pt !important; line-height: 1.1 !important; }
          .os-header-meta { margin-top: 0.8mm !important; font-size: 7pt !important; line-height: 1.3 !important; }
          .os-number-label { font-size: 6.5pt !important; }
          .os-number { margin-top: 0.5mm !important; font-size: 16pt !important; line-height: 1 !important; }
          .os-summary { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 1.5mm !important; margin-top: 2.5mm !important; }
          .os-box, .os-section { border: 1.45px solid #334155 !important; border-radius: 2mm !important; }
          .os-box { padding: 2mm !important; }
          .os-section { margin-top: 2.2mm !important; padding: 2.2mm !important; break-inside: avoid !important; }
          .os-label, .os-section-title { font-size: 6.8pt !important; line-height: 1.05 !important; }
          .os-value { margin-top: 0.8mm !important; font-size: 8.5pt !important; line-height: 1.15 !important; }
          .os-client-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 4mm !important; row-gap: 1.5mm !important; margin-top: 1.8mm !important; }
          .os-client-name { font-size: 10pt !important; }
          .os-problema { min-height: 10mm !important; max-height: 18mm !important; overflow: hidden !important; margin-top: 1.5mm !important; font-size: 8.3pt !important; line-height: 1.25 !important; }
          .os-fotos-grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 1mm !important; margin-top: 1.5mm !important; }
          .os-foto { height: 17mm !important; aspect-ratio: auto !important; border: 1.2px solid #475569 !important; border-radius: 1.5mm !important; }
          .os-two-col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 2mm !important; margin-top: 2.2mm !important; }
          .os-line-field { margin-top: 2mm !important; min-height: 4mm !important; border-color: #475569 !important; }
          .os-write-area { margin-top: 1.5mm !important; border: 1.2px dashed #475569 !important; border-radius: 1.5mm !important; overflow: hidden !important; font-size: 7.5pt !important; line-height: 1.2 !important; }
          .os-write-service { height: 17mm !important; }
          .os-write-small { height: 12mm !important; }
          .os-signatures { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10mm !important; margin-top: 3mm !important; }
          .os-signature { min-height: 18mm !important; padding-top: 0 !important; }
          .os-signature-image { height: 12mm !important; max-width: 55mm !important; object-fit: contain !important; margin: 0 auto 1mm !important; }
          .os-signature-line { border-color: #334155 !important; }
          .os-signature-label { margin-top: 1mm !important; font-size: 7pt !important; }
          @page { size: A4 portrait; margin: 6mm; }
        }
      `}</style>

      <div className="print-hide mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link href="/assistencias" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"><ArrowLeft size={16}/> Voltar ao Kanban</Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void salvarPdf()} disabled={salvandoPdf} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
            {salvandoPdf ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} {salvandoPdf ? 'Gerando PDF...' : 'Salvar PDF'}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-navyDark"><Printer size={16}/> Imprimir</button>
        </div>
      </div>

      <article className="os-folha mx-auto max-w-[210mm] rounded-2xl border border-slate-300 bg-white p-6 shadow-sm print:rounded-none print:p-0">
        <header className="os-header flex items-start justify-between gap-5 border-b-2 border-slate-900 pb-4">
          <div className="flex min-w-0 items-center gap-4">
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt={nomeEmpresa} className="os-header-logo h-14 w-28 object-contain object-left" />
            ) : <div className="os-header-fallback flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"><Wrench size={22}/></div>}
            <div className="min-w-0">
              <h1 className="os-header-title text-xl font-bold text-slate-950">{nomeEmpresa}</h1>
              <p className="os-header-meta mt-1 max-w-md text-xs leading-5 text-slate-500">{dadosEmpresaCabecalho || 'Assistência técnica'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="os-number-label text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordem de Serviço</p>
            <p className="os-number mt-1 text-2xl font-bold text-slate-950">OS {numeroOS}</p>
            <p className="os-header-meta mt-1 text-xs text-slate-500">Assistência técnica</p>
          </div>
        </header>

        <section className="os-summary mt-4 grid gap-2 sm:grid-cols-4">
          <div className="os-box rounded-xl border border-slate-600 p-2.5"><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Abertura</p><p className="os-value mt-1 text-xs font-semibold text-slate-900">{new Date(assistencia.created_at).toLocaleString('pt-BR')}</p></div>
          <div className="os-box rounded-xl border border-slate-600 p-2.5"><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Etapa</p><p className="os-value mt-1 text-xs font-semibold text-slate-900">{etapa || assistencia.status || 'Aberto'}</p></div>
          <div className="os-box rounded-xl border border-slate-600 p-2.5"><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aberto por</p><p className="os-value mt-1 text-xs font-semibold text-slate-900">{assistencia.criado_por_nome || 'Não informado'}</p></div>
          <div className="os-box rounded-xl border border-slate-600 p-2.5"><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contato</p><p className="os-value mt-1 text-xs font-semibold text-slate-900">{assistencia.cliente_whatsapp || 'Não informado'}</p></div>
        </section>

        <section className="os-section mt-3 rounded-xl border border-slate-600 p-3">
          <h2 className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Dados do cliente</h2>
          <div className="os-client-grid mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
            <div><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nome</p><p className="os-client-name os-value mt-1 text-sm font-bold text-slate-950">{assistencia.cliente_nome}</p></div>
            <div><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Telefone / WhatsApp</p><p className="os-value mt-1 text-sm text-slate-800">{assistencia.cliente_whatsapp || 'Não informado'}</p></div>
            <div className="sm:col-span-2"><p className="os-label text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endereço</p><p className="os-value mt-1 text-sm text-slate-800">{endereco || 'Endereço não informado'}</p></div>
          </div>
        </section>

        <section className="os-section mt-3 rounded-xl border border-slate-600 p-3">
          <h2 className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Problema relatado</h2>
          <p className="os-problema mt-2 min-h-12 whitespace-pre-wrap text-sm leading-5 text-slate-800">{assistencia.descricao_problema || 'Sem descrição informada.'}</p>
        </section>

        {assistencia.fotos_urls && assistencia.fotos_urls.length > 0 && (
          <section className="os-section mt-3 rounded-xl border border-slate-600 p-3 print:break-inside-avoid">
            <h2 className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Fotos do chamado</h2>
            <div className="os-fotos-grid mt-2 grid grid-cols-3 gap-2">
              {assistencia.fotos_urls.slice(0, 6).map((url, i) => (
                <div key={i} className="os-foto aspect-[4/3] overflow-hidden rounded-lg border border-slate-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="os-two-col mt-3 grid gap-3 sm:grid-cols-2 print:break-inside-avoid">
          <div className="os-box rounded-xl border border-slate-600 p-3">
            <p className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Técnico responsável</p>
            <div className="os-line-field mt-3 min-h-6 border-b border-slate-600 text-sm font-medium text-slate-800">{assistencia.tecnico_nome || ''}</div>
          </div>
          <div className="os-box rounded-xl border border-slate-600 p-3">
            <p className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Data do atendimento</p>
            <div className="os-line-field mt-3 min-h-6 border-b border-slate-600 text-sm font-medium text-slate-800">{dataAtendimento}</div>
          </div>
        </section>

        <section className="os-section mt-3 rounded-xl border border-slate-600 p-3 print:break-inside-avoid">
          <p className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Serviço realizado</p>
          <div className="os-write-area os-write-service mt-2 h-20 whitespace-pre-wrap rounded-lg border border-dashed border-slate-600 p-2 text-sm leading-5 text-slate-700">{assistencia.servico_realizado || ''}</div>
        </section>
        <section className="os-section mt-3 rounded-xl border border-slate-600 p-3 print:break-inside-avoid">
          <p className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Materiais / peças utilizados</p>
          <div className="os-write-area os-write-small mt-2 h-14 whitespace-pre-wrap rounded-lg border border-dashed border-slate-600 p-2 text-sm leading-5 text-slate-700">{assistencia.materiais_utilizados || ''}</div>
        </section>
        <section className="os-section mt-3 rounded-xl border border-slate-600 p-3 print:break-inside-avoid">
          <p className="os-section-title text-xs font-bold uppercase tracking-wide text-slate-700">Observações</p>
          <div className="os-write-area os-write-small mt-2 h-14 whitespace-pre-wrap rounded-lg border border-dashed border-slate-600 p-2 text-sm leading-5 text-slate-700">{assistencia.observacoes_atendimento || ''}</div>
        </section>

        <section className="os-signatures mt-5 grid gap-8 sm:grid-cols-2 print:break-inside-avoid">
          <div className="os-signature min-h-24 text-center">
            {assistencia.assinatura_cliente && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assistencia.assinatura_cliente} alt="Assinatura do cliente" className="os-signature-image mx-auto h-16 max-w-full object-contain" />
            )}
            <div className="os-signature-line border-t border-slate-700" />
            <p className="os-signature-label mt-2 text-xs text-slate-600">Assinatura do cliente</p>
          </div>
          <div className="os-signature min-h-24 text-center">
            {assistencia.assinatura_tecnico && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assistencia.assinatura_tecnico} alt="Assinatura do técnico" className="os-signature-image mx-auto h-16 max-w-full object-contain" />
            )}
            <div className="os-signature-line border-t border-slate-700" />
            <p className="os-signature-label mt-2 text-xs text-slate-600">Assinatura do técnico</p>
          </div>
        </section>
      </article>
    </div>
  )
}
