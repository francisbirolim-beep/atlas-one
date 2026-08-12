'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, Star, ChevronUp, ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import { Usuario, Setor, NivelPermissao } from '@/lib/tipos'
import { GUIAS, lerOcultos, alternarOculto, EVENTO_OCULTOS_MUDOU, guiasFavoritos, lerOrdem, ordenarPorPreferencia, moverGuia, EVENTO_ORDEM_MUDOU } from '@/lib/guias'
import { listarSetores, listarPermissoesUsuario, nivelEfetivo, agruparSetores, listarGruposComItens } from '@/lib/setores'
import { lerFavoritosSetores, alternarFavoritoSetor, EVENTO_FAVORITOS_SETORES_MUDOU } from '@/lib/favoritosSetores'

// Mesma regra usada na pagina /setores e nos atalhos da Inicio: se o setor ja
// tem funcionalidade programada (ativo + rota), vai direto pra ela; senao cai
// numa pagina de detalhe generica do setor.
function hrefDoSetor(s: Setor) {
  return s.ativo && s.rota ? s.rota : `/setor/${s.id}`
}

// Cada categoria do menu (Mais, Comercial, Tecnico, Sistema...) comeca
// fechada. Clicar no titulo abre so aquela categoria; clicar de novo fecha.
// A preferencia fica salva no navegador para lembrar o que a pessoa deixou
// aberto da ultima vez.
const CHAVE_CATEGORIAS_ABERTAS = 'atlas_sidebar_categorias_abertas'

function lerCategoriasAbertas(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const bruto = window.localStorage.getItem(CHAVE_CATEGORIAS_ABERTAS)
    if (!bruto) return []
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function salvarCategoriasAbertas(lista: string[]) {
  try {
    window.localStorage.setItem(CHAVE_CATEGORIAS_ABERTAS, JSON.stringify(lista))
  } catch {}
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [ordem, setOrdem] = useState<string[]>([])
  const [abrirMais, setAbrirMais] = useState(false)
  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoes, setPermissoes] = useState<Record<string, NivelPermissao>>({})
  const [favoritosSetores, setFavoritosSetores] = useState<string[]>([])
  const [categoriasAbertas, setCategoriasAbertas] = useState<string[]>([])

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    setOcultos(lerOcultos())
    setOrdem(lerOrdem())
    setFavoritosSetores(lerFavoritosSetores())
    setCategoriasAbertas(lerCategoriasAbertas())
    function sync() {
      setOcultos(lerOcultos())
    }
    function syncOrdem() {
      setOrdem(lerOrdem())
    }
    function syncFavoritosSetores() {
      setFavoritosSetores(lerFavoritosSetores())
    }
    window.addEventListener(EVENTO_OCULTOS_MUDOU, sync)
    window.addEventListener(EVENTO_ORDEM_MUDOU, syncOrdem)
    window.addEventListener(EVENTO_FAVORITOS_SETORES_MUDOU, syncFavoritosSetores)
    return () => {
      window.removeEventListener(EVENTO_OCULTOS_MUDOU, sync)
      window.removeEventListener(EVENTO_ORDEM_MUDOU, syncOrdem)
      window.removeEventListener(EVENTO_FAVORITOS_SETORES_MUDOU, syncFavoritosSetores)
    }
  }, [])

  // Alem dos guias fixos de sempre, o menu lateral agora tambem lista todos os
  // setores cadastrados (respeitando a permissao de cada usuario), do mesmo
  // jeito que a pagina /setores. Isso e so um acrescimo: nenhum item fixo foi
  // removido, entao ninguem perde acesso a nada que ja usava por aqui.
  useEffect(() => {
    if (!usuario) return
    const usuarioLogado = usuario
    async function carregar() {
      const lista = await listarSetores()
      const mapa = usuarioLogado.role === 'master' ? {} : await listarPermissoesUsuario(usuarioLogado.id)
      setPermissoes(mapa)
      setSetores(lista)
    }
    carregar()
  }, [usuario])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  const isMaster = usuario?.role === 'master'
  const favoritos = guiasFavoritos(ocultos, isMaster)
  const resto = GUIAS.filter((g) => !g.masterOnly || isMaster).filter((g) => ocultos.includes(g.href))
  const restoOrdenado = ordenarPorPreferencia(resto, ordem)

  const setoresVisiveis = usuario
    ? setores.filter((s) => nivelEfetivo(usuario, s.id, permissoes) !== 'oculto')
    : []
  const setoresFavoritados = setoresVisiveis.filter((s) => favoritosSetores.includes(s.id))
  const setoresRestantes = setoresVisiveis.filter((s) => !favoritosSetores.includes(s.id))
  const gruposRestantes = listarGruposComItens(setoresRestantes)
  const setoresRestantesPorGrupo = agruparSetores(setoresRestantes)

  const totalResto = restoOrdenado.length + setoresRestantes.length

  function mover(href: string, direcao: 'cima' | 'baixo') {
    moverGuia(restoOrdenado, href, direcao)
  }

  function favoritar(href: string) {
    setOcultos(alternarOculto(href))
  }

  function favoritarSetor(id: string) {
    setFavoritosSetores(alternarFavoritoSetor(id))
  }

  function categoriaAberta(nome: string) {
    return categoriasAbertas.includes(nome)
  }

  function alternarCategoria(nome: string) {
    setCategoriasAbertas((atual) => {
      const novo = atual.includes(nome) ? atual.filter((c) => c !== nome) : [...atual, nome]
      salvarCategoriasAbertas(novo)
      return novo
    })
  }

  // Titulo clicavel de cada categoria do menu ("Mais", "Comercial", "Tecnico"...).
  // Clicar expande ou contrai a lista de links logo abaixo dele.
  function TituloCategoria({ nome, tamanho = 'sm' }: { nome: string; tamanho?: 'sm' | 'md' }) {
    const aberta = categoriaAberta(nome)
    return (
      <button
        type="button"
        onClick={() => alternarCategoria(nome)}
        aria-expanded={aberta}
        className={`mb-1 flex w-full items-center justify-between rounded-lg px-1 text-slate-400 transition hover:text-slate-600
                    ${tamanho === 'sm' ? 'py-1 text-[10px]' : 'py-2 text-xs'} font-semibold uppercase tracking-wide`}
      >
        <span>{nome}</span>
        <ChevronRight size={tamanho === 'sm' ? 12 : 14} className={`flex-shrink-0 transition-transform ${aberta ? 'rotate-90' : ''}`} />
      </button>
    )
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-start gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]
                   md:static md:h-screen md:w-56 md:flex-col md:items-stretch md:justify-start md:gap-0 md:overflow-visible md:border-r md:border-t-0 md:py-5"
      >
        <div className="hidden md:flex md:flex-col md:px-3">
          <span className="mb-3 px-1 text-base font-bold tracking-tight text-brand-navy">Atlas One</span>

          {(favoritos.length > 0 || setoresFavoritados.length > 0) && (
            <div className="mb-4 space-y-0.5 px-1">
              {favoritos.map((g) => {
                const Icon = g.icon
                const ativo = pathname === g.href
                return (
                  <div key={g.href} className="group relative flex items-center">
                    <Link
                      href={g.href}
                      title={g.label}
                      className={`flex flex-1 items-center gap-2 truncate rounded-lg px-2 py-1.5 text-xs transition
                                  ${ativo ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <Icon size={15} className="flex-shrink-0" />
                      <span className="truncate">{g.label}</span>
                    </Link>
                  </div>
                )
              })}
              {setoresFavoritados.map((s) => {
                const href = hrefDoSetor(s)
                const ativo = pathname === href
                return (
                  <div key={s.id} className="group relative flex items-center">
                    <Link
                      href={href}
                      title={s.nome}
                      className={`flex flex-1 items-center gap-2 truncate rounded-lg px-2 py-1.5 text-xs transition
                                  ${ativo ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <LayoutGrid size={15} className="flex-shrink-0" />
                      <span className="truncate">{s.nome}</span>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {totalResto > 0 && (
          <div className="hidden md:block md:flex-1 md:overflow-y-auto md:px-3">
            <TituloCategoria nome="Mais" />
            {categoriaAberta('Mais') && restoOrdenado.length > 0 && (
              <div className="mb-1 space-y-0.5">
                {restoOrdenado.map((g, i) => {
                  const ativo = pathname === g.href
                  return (
                    <div key={g.href} className="group flex items-center">
                      <Link
                        href={g.href}
                        className={`flex-1 truncate rounded-lg px-2 py-1.5 text-xs transition
                                    ${ativo ? 'bg-slate-100 font-medium text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                      >
                        {g.label}
                      </Link>
                      {i > 0 && (
                        <button
                          onClick={() => mover(g.href, 'cima')}
                          title="Mover para cima"
                          className="p-1 text-slate-300 opacity-0 hover:text-brand-navy group-hover:opacity-100"
                        >
                          <ChevronUp size={12} />
                        </button>
                      )}
                      {i < restoOrdenado.length - 1 && (
                        <button
                          onClick={() => mover(g.href, 'baixo')}
                          title="Mover para baixo"
                          className="p-1 text-slate-300 opacity-0 hover:text-brand-navy group-hover:opacity-100"
                        >
                          <ChevronDown size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => favoritar(g.href)}
                        title="Colocar no guia rápido"
                        className="p-1 text-slate-300 opacity-0 hover:text-amber-400 group-hover:opacity-100"
                      >
                        <Star size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {gruposRestantes.map((grupo) => (
              <div key={grupo} className="mt-3">
                <TituloCategoria nome={grupo} />
                {categoriaAberta(grupo) && (
                  <div className="space-y-0.5">
                    {(setoresRestantesPorGrupo[grupo] || []).map((s) => {
                      const href = hrefDoSetor(s)
                      const ativo = pathname === href
                      return (
                        <div key={s.id} className="group flex items-center">
                          <Link
                            href={href}
                            className={`flex-1 truncate rounded-lg px-2 py-1.5 text-xs transition
                                        ${ativo ? 'bg-slate-100 font-medium text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                          >
                            {s.nome}
                          </Link>
                          <button
                            onClick={() => favoritarSetor(s.id)}
                            title="Colocar no guia rápido"
                            className="p-1 text-slate-300 opacity-0 hover:text-amber-400 group-hover:opacity-100"
                          >
                            <Star size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="hidden md:mt-auto md:block md:px-2 md:pt-4">
          <button
            onClick={sair}
            title="Sair"
            className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
          >
            <LogOut size={20} />
            <span className="text-[10px] leading-none">Sair</span>
          </button>
        </div>

        {favoritos.map((g) => {
          const Icon = g.icon
          const ativo = pathname === g.href
          return (
            <div key={g.href} className="group relative md:hidden">
              <Link
                href={g.href}
                title={g.label}
                className={`flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition
                            ${ativo ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon size={20} />
                <span className="text-[10px] leading-none">{g.label}</span>
              </Link>
            </div>
          )
        })}

        {setoresFavoritados.map((s) => {
          const href = hrefDoSetor(s)
          const ativo = pathname === href
          return (
            <div key={s.id} className="group relative md:hidden">
              <Link
                href={href}
                title={s.nome}
                className={`flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition
                            ${ativo ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <LayoutGrid size={20} />
                <span className="max-w-full truncate px-0.5 text-[10px] leading-none">{s.nome}</span>
              </Link>
            </div>
          )
        })}

        {totalResto > 0 && (
          <button
            onClick={() => setAbrirMais(true)}
            title="Mais"
            className="flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 md:hidden"
          >
            <Menu size={20} />
            <span className="text-[10px] leading-none">Mais</span>
          </button>
        )}

        <button
          onClick={sair}
          title="Sair"
          className="flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-red-500 md:hidden"
        >
          <LogOut size={20} />
          <span className="text-[10px] leading-none">Sair</span>
        </button>
      </nav>

      {abrirMais && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" onClick={() => setAbrirMais(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Mais guias</p>
              <button onClick={() => setAbrirMais(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>

            {restoOrdenado.length > 0 && (
              <div className="mb-2">
                <TituloCategoria nome="Mais" tamanho="md" />
                {categoriaAberta('Mais') && (
                  <div className="space-y-1">
                    {restoOrdenado.map((g, i) => (
                      <div key={g.href} className="flex items-center">
                        <Link
                          href={g.href}
                          onClick={() => setAbrirMais(false)}
                          className="flex-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          {g.label}
                        </Link>
                        <button
                          onClick={() => mover(g.href, 'cima')}
                          disabled={i === 0}
                          className="p-2 text-slate-300 disabled:opacity-30"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => mover(g.href, 'baixo')}
                          disabled={i === restoOrdenado.length - 1}
                          className="p-2 text-slate-300 disabled:opacity-30"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button onClick={() => favoritar(g.href)} className="p-2 text-slate-300 hover:text-amber-400">
                          <Star size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {gruposRestantes.map((grupo) => (
              <div key={grupo} className="mt-4">
                <TituloCategoria nome={grupo} tamanho="md" />
                {categoriaAberta(grupo) && (
                  <div className="space-y-1">
                    {(setoresRestantesPorGrupo[grupo] || []).map((s) => {
                      const href = hrefDoSetor(s)
                      return (
                        <div key={s.id} className="flex items-center">
                          <Link
                            href={href}
                            onClick={() => setAbrirMais(false)}
                            className="flex-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            {s.nome}
                          </Link>
                          <button onClick={() => favoritarSetor(s.id)} className="p-2 text-slate-300 hover:text-amber-400">
                            <Star size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
