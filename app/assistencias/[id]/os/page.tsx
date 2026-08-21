'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Printer, ShieldAlert, Wrench } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, type IdentidadeEmpresa } from '@/lib/configGeral'
import { lerHomeUsuarioConfig } from '@/lib/homeUsuario'
import { supabase } from '@/lib/supabase'
import type { Assistencia, DadosEmpresa } from '@/lib/tipos'

type EmpresaOS = DadosEmpresa & IdentidadeEmpresa

export default function OrdemServicoAssistenciaPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [assistencia, setAssistencia] = useState<Assistencia | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaOS | null>(null)
  const [etapa, setEtapa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [negado, setNegado] = useState(false)

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
      const chamada = data as Assistencia | null
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

  if (carregando) return <div className="min-h-[70vh] grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>

  if (negado) {
    return <div className="min-h-[70vh] grid place-items-center px-4"><div className="max-w-md text-center"><ShieldAlert size={44} className="mx-auto mb-3 text-red-300"/><h1 className="font-semibold text-slate-800">Acesso não permitido</h1><p className="mt-2 text-sm text-slate-500">Este usuário não tem permissão para gerar a ordem de serviço deste chamado.</p><Link href="/assistencias" className="mt-4 inline-block text-sm text-brand-navy hover:underline">Voltar às assistências</Link></div></div>
  }

  if (!assistencia) return <div className="min-h-[70vh] grid place-items-center text-slate-500">Assistência não encontrada.</div>

  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Esquadrifácio'
  const endereco = [assistencia.endereco, assistencia.numero, assistencia.bairro, assistencia.cidade].filter(Boolean).join(', ')
  const numeroOS = assistencia.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <div className="os-assistencia min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .atlas-sidebar-shell, header.sticky, .print-hide, [class*="MobileNavigationControls"], [class*="mobile-navigation"] { display: none !important; }
          body, main { background: #fff !important; }
          .os-assistencia { padding: 0 !important; }
          .os-folha { box-shadow: none !important; border: 0 !important; max-width: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="print-hide mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <Link href="/assistencias" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"><ArrowLeft size={16}/> Voltar</Link>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-navyDark"><Printer size={16}/> Imprimir / Salvar PDF</button>
      </div>

      <article className="os-folha mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm print:rounded-none print:p-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
          <div className="flex min-w-0 items-center gap-4">
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt={nomeEmpresa} className="h-16 w-32 object-contain object-left" />
            ) : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white"><Wrench size={24}/></div>}
            <div className="min-w-0"><h1 className="text-xl font-bold text-slate-950">{nomeEmpresa}</h1><p className="mt-1 text-xs text-slate-500">{[empresa?.cidadeUf, empresa?.tel, empresa?.email].filter(Boolean).join(' · ')}</p></div>
          </div>
          <div className="text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ordem de Serviço</p><p className="mt-1 text-2xl font-bold text-slate-950">OS {numeroOS}</p><p className="mt-1 text-xs text-slate-500">Assistência técnica</p></div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Abertura</p><p className="mt-1 text-sm font-medium text-slate-800">{new Date(assistencia.created_at).toLocaleString('pt-BR')}</p></div>
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Etapa</p><p className="mt-1 text-sm font-medium text-slate-800">{etapa || assistencia.status || 'Aberto'}</p></div>
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Aberto por</p><p className="mt-1 text-sm font-medium text-slate-800">{assistencia.criado_por_nome || 'Não informado'}</p></div>
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contato</p><p className="mt-1 text-sm font-medium text-slate-800">{assistencia.cliente_whatsapp || 'Não informado'}</p></div>
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente</h2>
          <p className="mt-2 text-lg font-bold text-slate-950">{assistencia.cliente_nome}</p>
          <p className="mt-1 text-sm text-slate-600">{endereco || 'Endereço não informado'}</p>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Problema relatado</h2>
          <p className="mt-2 min-h-16 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assistencia.descricao_problema || 'Sem descrição informada.'}</p>
        </section>

        {assistencia.fotos_urls && assistencia.fotos_urls.length > 0 && (
          <section className="mt-4 rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Fotos do chamado</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">{assistencia.fotos_urls.slice(0, 6).map((url, i) => <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" /></div>)}</div>
          </section>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 print:break-inside-avoid">
          <div className="rounded-xl border border-slate-300 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Técnico responsável</p><div className="mt-8 border-b border-slate-400" /></div>
          <div className="rounded-xl border border-slate-300 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Data do atendimento</p><div className="mt-8 border-b border-slate-400" /></div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-300 p-4 print:break-inside-avoid"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Serviço realizado</p><div className="mt-3 h-28 rounded-lg border border-dashed border-slate-300" /></section>
        <section className="mt-4 rounded-xl border border-slate-300 p-4 print:break-inside-avoid"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Materiais / peças utilizados</p><div className="mt-3 h-20 rounded-lg border border-dashed border-slate-300" /></section>
        <section className="mt-4 rounded-xl border border-slate-300 p-4 print:break-inside-avoid"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Observações</p><div className="mt-3 h-20 rounded-lg border border-dashed border-slate-300" /></section>

        <section className="mt-10 grid gap-8 sm:grid-cols-2 print:break-inside-avoid">
          <div className="pt-10 text-center"><div className="border-t border-slate-500" /><p className="mt-2 text-xs text-slate-500">Assinatura do cliente</p></div>
          <div className="pt-10 text-center"><div className="border-t border-slate-500" /><p className="mt-2 text-xs text-slate-500">Assinatura do técnico</p></div>
        </section>
      </article>
    </div>
  )
}
