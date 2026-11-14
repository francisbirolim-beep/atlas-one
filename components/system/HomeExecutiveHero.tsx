'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Sun,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Columns3,
  MapPinned,
  Search,
  UserPlus,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { HomeModuloId } from '@/lib/homeUsuario'
import type { Usuario } from '@/lib/tipos'

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

export default function HomeExecutiveHero({ modulos = MODULOS_PADRAO }: { modulos?: HomeModuloId[] }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(u => { if (ativo) setUsuario(u) })
    return () => { ativo = false }
  }, [])

  const hoje = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date()), [])

  const tem = (modulo: HomeModuloId) => modulos.includes(modulo)

  function novaTarefa() {
    window.dispatchEvent(new Event('atlas:tarefa-equipe-nova'))
  }

  function novoCompromisso() {
    window.dispatchEvent(new Event('atlas:novo-compromisso'))
  }

  const classeAtalho = 'group flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-sm sm:gap-2.5 sm:px-3'
  const classeIcone = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700'
  const classeTextoAtalho = 'block text-xs leading-4 text-slate-900 sm:text-[13px] sm:leading-5'
  const classeSubtituloAtalho = 'hidden text-[11px] text-slate-500'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8">
      <div className="flex flex-col gap-2 rounded-2xl bg-white px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
            <Sun size={27} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{saudacao()}, {primeiroNome(usuario?.nome)}!</h1>
            <p className="text-xs text-slate-500 sm:text-[13px]">Aqui está sua agenda e suas pendências de hoje.</p>
          </div>
        </div>
        <p className="flex shrink-0 items-center gap-2 text-xs font-medium capitalize text-slate-700 sm:text-[13px]">
          <CalendarDays size={18} className="text-slate-700" />{hoje}
        </p>
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
          {(tem('orcamentos') || tem('clientes')) && (
            <Link href="/balcao/consulta-preco" className={classeAtalho}>
              <span className={classeIcone}><Search size={18} /></span>
              <span className="min-w-0"><strong className={classeTextoAtalho}>Consulta de preço</strong><span className={classeSubtituloAtalho}>Produtos e valores</span></span>
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
