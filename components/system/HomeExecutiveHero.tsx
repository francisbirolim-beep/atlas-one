'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Columns3,
  ImageIcon,
  MapPinned,
  Search,
  UserPlus,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, type IdentidadeEmpresa } from '@/lib/configGeral'
import type { HomeModuloId } from '@/lib/homeUsuario'
import type { DadosEmpresa, Usuario } from '@/lib/tipos'

const COR_PADRAO = '#059669'
const MODULOS_PADRAO: HomeModuloId[] = ['orcamentos', 'clientes', 'tarefas', 'calendario']

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(nome?: string | null) {
  return (nome || '').trim().split(/\s+/)[0] || 'equipe'
}

function corSegura(cor?: string | null) {
  return cor && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : COR_PADRAO
}

type DadosEmpresaHome = DadosEmpresa & IdentidadeEmpresa

export default function HomeExecutiveHero({ modulos = MODULOS_PADRAO }: { modulos?: HomeModuloId[] }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [empresa, setEmpresa] = useState<DadosEmpresaHome | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([usuarioAtual(), lerDadosEmpresa()]).then(([u, dadosEmpresa]) => {
      if (!ativo) return
      setUsuario(u)
      setEmpresa(dadosEmpresa)
    })
    return () => { ativo = false }
  }, [])

  const hoje = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  }).format(new Date()), [])

  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Esquadrifácio'
  const corPrincipal = corSegura(empresa?.corPrincipal)
  const tem = (modulo: HomeModuloId) => modulos.includes(modulo)

  function novaTarefa() {
    window.dispatchEvent(new Event('atlas:nova-tarefa'))
  }

  function novoCompromisso() {
    window.dispatchEvent(new Event('atlas:novo-compromisso'))
  }

  const classeAtalho = 'group flex min-h-14 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md sm:min-h-16 sm:gap-2.5 sm:px-3 sm:py-2.5'
  const classeIcone = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 sm:h-9 sm:w-9'
  const classeTextoAtalho = 'block text-xs leading-4 text-slate-900 sm:text-[13px] sm:leading-5'
  const classeSubtituloAtalho = 'mt-0.5 hidden text-[11px] text-slate-500 xl:block'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8">
      <div className="atlas-home-hero overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
        <div className="h-1 w-full" style={{ backgroundColor: corPrincipal }} />
        <div className="grid gap-2 px-4 py-3 sm:px-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Visão geral</p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{saudacao()}, {primeiroNome(usuario?.nome)}.</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500 sm:text-[13px]">Seu centro de trabalho: tarefas, agenda e acessos rápidos do dia.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Building2 size={13} className="text-blue-600" /> {nomeEmpresa}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-blue-600" /> {hoje}</span>
            </div>
          </div>

          <div className={empresa?.logoUrl
            ? 'hidden items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:flex sm:min-w-32'
            : 'hidden'}>
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt={`Logo ${nomeEmpresa}`} className="max-h-8 max-w-28 object-contain" />
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon size={24} className="mx-auto mb-2" />
                <p className="text-sm font-semibold">Logo da empresa</p>
                <p className="mt-1 text-[11px]">Configure em Empresa e Identidade</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {modulos.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {(tem('orcamentos') || tem('clientes')) && (
            <Link href="/clientes/identificar" onClick={(e) => { if (!navigator.onLine) { e.preventDefault(); window.location.assign('/orcamento-rapido?offline=1') } }} className={classeAtalho}>
              <span className={classeIcone}><UserPlus size={19} /></span>
              <span className="min-w-0 flex-1"><strong className={classeTextoAtalho}>Cliente 360</strong><span className={classeSubtituloAtalho}>Buscar ou cadastrar cliente</span></span><ArrowRight size={14} className="hidden text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600 sm:block" />
            </Link>
          )}
          {(tem('orcamentos') || tem('clientes')) && (
            <Link href="/prospeccao/nova" className={classeAtalho}>
              <span className={classeIcone}><MapPinned size={19} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Nova prospecção</strong><span className={classeSubtituloAtalho}>Registrar obra em campo</span></span>
            </Link>
          )}
          {tem('kanban') && (
            <Link href="/kanban" className={classeAtalho}>
              <span className={classeIcone}><Columns3 size={19} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Kanban</strong><span className={classeSubtituloAtalho}>Abrir comercial</span></span>
            </Link>
          )}
          {(tem('orcamentos') || tem('clientes')) && (
            <Link href="/balcao/consulta-preco" className={classeAtalho}>
              <span className={classeIcone}><Search size={18} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Consulta de preço</strong><span className={classeSubtituloAtalho}>Produtos e valores</span></span>
            </Link>
          )}
          {tem('tarefas') && (
            <button type="button" onClick={novaTarefa} className={classeAtalho}>
              <span className={classeIcone}><CheckSquare size={19} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Nova tarefa</strong><span className={classeSubtituloAtalho}>Adicionar tarefa</span></span>
            </button>
          )}
          {tem('calendario') && (
            <button type="button" onClick={novoCompromisso} className={classeAtalho}>
              <span className={classeIcone}><CalendarPlus size={19} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Novo compromisso</strong><span className={classeSubtituloAtalho}>Agendar</span></span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
