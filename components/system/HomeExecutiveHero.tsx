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
  FilePlus2,
  ImageIcon,
  UserPlus,
  Wrench,
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

  const classeAtalho = 'group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
  const classeIcone = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 pt-6 md:px-8 md:pt-9">
      <div className="atlas-home-hero overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 w-full" style={{ backgroundColor: corPrincipal }} />
        <div className="grid gap-6 px-5 py-6 md:px-7 md:py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Visão geral</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{saudacao()}, {primeiroNome(usuario?.nome)}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Acompanhe o que precisa de atenção e acesse rapidamente as operações do seu dia.</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Building2 size={13} className="text-blue-600" /> {nomeEmpresa}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-blue-600" /> {hoje}</span>
            </div>
          </div>

          <div className="flex min-h-24 min-w-52 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4">
            {empresa?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt={`Logo ${nomeEmpresa}`} className="max-h-16 max-w-48 object-contain" />
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
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {tem('orcamentos') && (
            <Link href="/orcamento-rapido" className={classeAtalho}>
              <span className={classeIcone}><FilePlus2 size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">Novo orçamento</strong><span className="mt-0.5 block text-xs text-slate-400">Criar orçamento</span></span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
            </Link>
          )}
          {tem('clientes') && (
            <Link href="/clientes/novo" className={classeAtalho}>
              <span className={classeIcone}><UserPlus size={19} /></span>
              <span><strong className="block text-sm text-slate-900">Novo cliente</strong><span className="mt-0.5 block text-xs text-slate-400">Cadastrar cliente</span></span>
            </Link>
          )}
          {tem('kanban') && (
            <Link href="/kanban" className={classeAtalho}>
              <span className={classeIcone}><Columns3 size={19} /></span>
              <span><strong className="block text-sm text-slate-900">Kanban</strong><span className="mt-0.5 block text-xs text-slate-400">Abrir comercial</span></span>
            </Link>
          )}
          {tem('assistencias') && (
            <Link href="/assistencia" className={classeAtalho}>
              <span className={classeIcone}><Wrench size={19} /></span>
              <span><strong className="block text-sm text-slate-900">Nova assistência</strong><span className="mt-0.5 block text-xs text-slate-400">Abrir chamado</span></span>
            </Link>
          )}
          {tem('tarefas') && (
            <button type="button" onClick={novaTarefa} className={classeAtalho}>
              <span className={classeIcone}><CheckSquare size={19} /></span>
              <span><strong className="block text-sm text-slate-900">Nova tarefa</strong><span className="mt-0.5 block text-xs text-slate-400">Adicionar tarefa</span></span>
            </button>
          )}
          {tem('calendario') && (
            <button type="button" onClick={novoCompromisso} className={classeAtalho}>
              <span className={classeIcone}><CalendarPlus size={19} /></span>
              <span><strong className="block text-sm text-slate-900">Novo compromisso</strong><span className="mt-0.5 block text-xs text-slate-400">Agendar</span></span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
