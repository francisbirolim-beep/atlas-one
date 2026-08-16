'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, LayoutGrid, Settings, Star, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import {
  GUIAS,
  EVENTO_OCULTOS_MUDOU,
  alternarOculto,
  guiasFavoritos,
  lerOcultos,
} from '@/lib/guias'

export default function MobileFavorites({ mostrarAcessoRapido = false }: { mostrarAcessoRapido?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])

  useEffect(() => {
    setOcultos(lerOcultos())
    usuarioAtual().then(setUsuario)

    const atualizar = () => setOcultos(lerOcultos())
    window.addEventListener(EVENTO_OCULTOS_MUDOU, atualizar)
    return () => window.removeEventListener(EVENTO_OCULTOS_MUDOU, atualizar)
  }, [])

  const isMaster = usuario?.role === 'master'
  const guiasDisponiveis = useMemo(
    () => GUIAS.filter(guia => !guia.masterOnly || isMaster),
    [isMaster],
  )
  const favoritos = useMemo(
    () => guiasFavoritos(ocultos, Boolean(isMaster)),
    [ocultos, isMaster],
  )

  function alternarGuia(href: string) {
    setOcultos(alternarOculto(href))
  }

  return (
    <>
      {mostrarAcessoRapido && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Acesso rápido</p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Favoritos</h2>
              </div>
              <button
                type="button"
                onClick={() => setAberto(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <Star size={15} /> Editar
              </button>
            </div>

            {favoritos.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {favoritos.slice(0, 6).map(guia => {
                  const Icon = guia.icon
                  return (
                    <Link
                      key={guia.href}
                      href={guia.href}
                      className="flex min-h-16 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-navy shadow-sm">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 truncate">{guia.label}</span>
                    </Link>
                  )
                })}
                {favoritos.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setAberto(true)}
                    className="min-h-16 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500"
                  >
                    +{favoritos.length - 6} favorito
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAberto(true)}
                className="mt-3 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500"
              >
                Escolher meus atalhos favoritos
              </button>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 inline-flex h-14 items-center gap-2 rounded-2xl bg-brand-navy px-4 text-sm font-semibold text-white shadow-xl md:hidden"
        aria-label="Abrir favoritos"
      >
        <Star size={19} fill="currentColor" />
        Favoritos
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/45 md:hidden" onClick={() => setAberto(false)}>
          <div
            className="max-h-[82vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">Acesso rápido</p>
                <h2 className="text-lg font-bold text-slate-950">Meus favoritos</h2>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full bg-slate-100 p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-4">
              {favoritos.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Abrir favorito</p>
                  <div className="grid grid-cols-2 gap-2">
                    {favoritos.map(guia => {
                      const Icon = guia.icon
                      return (
                        <Link
                          key={guia.href}
                          href={guia.href}
                          onClick={() => setAberto(false)}
                          className="flex min-h-14 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          <Icon size={17} className="shrink-0 text-brand-navy" />
                          <span className="truncate">{guia.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Escolher atalhos</p>
                <p className="mb-3 text-xs leading-5 text-slate-500">Somente as áreas principais do Atlas aparecem aqui. Configurações e telas antigas ficam fora do uso diário.</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {guiasDisponiveis.map(guia => {
                    const favorito = !ocultos.includes(guia.href)
                    const Icon = guia.icon
                    return (
                      <button
                        key={guia.href}
                        type="button"
                        onClick={() => alternarGuia(guia.href)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                          <Icon size={17} className="shrink-0 text-slate-400" />
                          <span className="truncate">{guia.label}</span>
                        </span>
                        <Star size={18} className={favorito ? 'text-amber-500' : 'text-slate-300'} fill={favorito ? 'currentColor' : 'none'} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {isMaster && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Administração</p>
                  <div className="grid gap-2">
                    <Link href="/configuracoes" onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                      <Settings size={17} className="text-slate-400" /> Configurações
                    </Link>
                    <Link href="/configuracoes/orcamento" onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                      <FileText size={17} className="text-slate-400" /> Padrão do Orçamento
                    </Link>
                    <Link href="/setores" onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                      <LayoutGrid size={17} className="text-slate-400" /> Setores
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
