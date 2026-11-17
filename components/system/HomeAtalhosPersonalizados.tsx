'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, RotateCcw, X } from 'lucide-react'
import type { Usuario } from '@/lib/tipos'
import type { HomeUsuarioConfig } from '@/lib/homeUsuario'
import {
  HOME_ATALHOS, HOME_ATALHOS_MAX, HOME_ATALHOS_PADRAO,
  atalhosInicioEfetivos, type HomeAtalho,
} from '@/lib/homeAtalhos'
import { listarPermissoesUsuario, listarSetores } from '@/lib/setores'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { podeAcessarRotaCatalogada } from '@/lib/permissoesRota'
import { carregarAcessoCadastro, podeAcaoCadastro } from '@/lib/acessoCadastroOperacional'

type Props = {
  usuario: Usuario | null
  config: HomeUsuarioConfig
  pronto: boolean
  onSalvar: (rotas: string[]) => Promise<boolean>
}

const PADRAO = [...HOME_ATALHOS_PADRAO]
const BOTAO = 'group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500'
const ICONE = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg'
const TITULO = 'min-w-0 truncate text-xs font-bold text-slate-900 sm:text-[13px]'

function cartao(atalho: HomeAtalho) {
  const Icon = atalho.icon
  return (
    <Link key={atalho.href} href={atalho.href} className={BOTAO}>
      <span className={ICONE + ' ' + atalho.cor}><Icon size={19} /></span>
      <span className={TITULO}>{atalho.label}</span>
    </Link>
  )
}

export default function HomeAtalhosPersonalizados({ usuario, config, pronto, onSalvar }: Props) {
  const [permitidas, setPermitidas] = useState<string[]>(PADRAO)
  const [checando, setChecando] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState<string[]>(PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let ativo = true
    setPermitidas(PADRAO)
    setChecando(true)
    if (!usuario) return () => { ativo = false }

    if (usuario.role === 'master') {
      setPermitidas(HOME_ATALHOS.map(item => item.href))
      setChecando(false)
      return () => { ativo = false }
    }

    void (async () => {
      try {
        const [catalogo, permissoes, acesso, cadastro] = await Promise.all([
          listarSetores(),
          listarPermissoesUsuario(usuario.id),
          lerAcessoUsuarioConfig(usuario),
          carregarAcessoCadastro(usuario),
        ])
        if (!catalogo.length) throw new Error('Catálogo de módulos indisponível')
        const podeVerCadastros = cadastro.nivel !== 'oculto'
          && (['clientes', 'produtos', 'linhas', 'materiais', 'fornecedores', 'catalogo_tecnico', 'historico', 'precificacao'] as const)
            .some(id => podeAcaoCadastro(cadastro, id))
        const rotas = HOME_ATALHOS.filter(item => {
          if (item.masterOnly) return false
          if (PADRAO.includes(item.href as typeof PADRAO[number])) return true
          if (item.href === '/cadastros' && !podeVerCadastros) return false
          return podeAcessarRotaCatalogada(item.href, usuario.role, permissoes, acesso, catalogo) !== false
        }).map(item => item.href)
        if (ativo) setPermitidas(rotas)
      } catch {
        // Falha ao consultar permissões: conserva apenas a faixa já aprovada.
        if (ativo) setPermitidas(PADRAO)
      } finally {
        if (ativo) setChecando(false)
      }
    })()
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

  useEffect(() => {
    if (!aberto) return
    function tecla(event: KeyboardEvent) {
      if (event.key === 'Escape' && !salvando) setAberto(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, salvando])

  const disponiveis = useMemo(
    () => HOME_ATALHOS.filter(atalho => permitidas.includes(atalho.href)),
    [permitidas],
  )
  const escolhidos = atalhosInicioEfetivos(config.atalhosInicio)
  const cards = escolhidos
    .filter(href => permitidas.includes(href))
    .map(href => HOME_ATALHOS.find(item => item.href === href))
    .filter((item): item is HomeAtalho => Boolean(item))

  function abrirEdicao() {
    if (!usuario || !pronto || checando) return
    setRascunho(escolhidos.filter(href => permitidas.includes(href)))
    setErro('')
    setMensagem('')
    setAberto(true)
  }

  function alternar(href: string) {
    setErro('')
    setRascunho(atuais => {
      if (atuais.includes(href)) return atuais.filter(atual => atual !== href)
      return atuais.length >= HOME_ATALHOS_MAX ? atuais : [...atuais, href]
    })
  }

  function mover(indice: number, deslocamento: number) {
    setRascunho(atuais => {
      const destino = indice + deslocamento
      if (destino < 0 || destino >= atuais.length) return atuais
      const proximo = [...atuais]
      ;[proximo[indice], proximo[destino]] = [proximo[destino], proximo[indice]]
      return proximo
    })
  }

  async function salvar() {
    if (!usuario || salvando) return
    setSalvando(true)
    setErro('')
    try {
      const ok = await onSalvar(rascunho)
      if (!ok) throw new Error('Não foi possível salvar. Confira a conexão e tente novamente.')
      setMensagem('Seus atalhos foram salvos.')
      setAberto(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar os atalhos.')
    } finally {
      setSalvando(false)
    }
  }

  const selecionados = rascunho
    .map(href => disponiveis.find(item => item.href === href))
    .filter((item): item is HomeAtalho => Boolean(item))

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8" aria-label="Acessos rápidos">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Meus atalhos</p>
        <button
          type="button"
          onClick={abrirEdicao}
          disabled={!pronto || !usuario || checando}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil size={14} /> Personalizar atalhos
        </button>
      </div>
      {mensagem && <p role="status" className="mb-2 text-xs font-medium text-emerald-700">{mensagem}</p>}
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {cards.map(cartao)}
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirEdicao}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-medium text-slate-600 disabled:opacity-50"
          disabled={!pronto || checando}
        >
          Nenhum atalho selecionado. Clique para escolher seus favoritos.
        </button>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
          onMouseDown={event => { if (event.target === event.currentTarget && !salvando) setAberto(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-atalhos-home"
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <h2 id="titulo-atalhos-home" className="text-base font-bold text-slate-900 sm:text-lg">Personalizar minha tela inicial</h2>
                <p className="mt-1 text-xs text-slate-500">Escolha e ordene até {HOME_ATALHOS_MAX} atalhos. A mudança vale só para seu usuário.</p>
              </div>
              <button type="button" aria-label="Fechar personalização" disabled={salvando} onClick={() => setAberto(false)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">Meus favoritos ({rascunho.length}/{HOME_ATALHOS_MAX})</h3>
                  <button
                    type="button"
                    onClick={() => setRascunho([...HOME_ATALHOS_PADRAO])}
                    disabled={salvando}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 disabled:opacity-50"
                  ><RotateCcw size={14} /> Restaurar padrão</button>
                </div>
                {selecionados.length ? (
                  <div className="space-y-2">
                    {selecionados.map((atalho, indice) => {
                      const Icon = atalho.icon
                      return (
                        <div key={atalho.href} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <Icon size={17} className="shrink-0 text-slate-600" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{atalho.label}</span>
                          <button type="button" aria-label={'Mover ' + atalho.label + ' para cima'} disabled={indice === 0 || salvando} onClick={() => mover(indice, -1)} className="rounded-lg p-2 text-slate-600 hover:bg-white disabled:opacity-30"><ArrowUp size={17} /></button>
                          <button type="button" aria-label={'Mover ' + atalho.label + ' para baixo'} disabled={indice === selecionados.length - 1 || salvando} onClick={() => mover(indice, 1)} className="rounded-lg p-2 text-slate-600 hover:bg-white disabled:opacity-30"><ArrowDown size={17} /></button>
                          <button type="button" aria-label={'Remover ' + atalho.label} disabled={salvando} onClick={() => alternar(atalho.href)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"><X size={17} /></button>
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Você ainda não escolheu atalhos.</p>}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Adicionar atalhos disponíveis</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {disponiveis.map(atalho => {
                    const marcado = rascunho.includes(atalho.href)
                    const Icon = atalho.icon
                    return (
                      <button
                        type="button"
                        key={atalho.href}
                        onClick={() => alternar(atalho.href)}
                        disabled={salvando || (!marcado && rascunho.length >= HOME_ATALHOS_MAX)}
                        aria-pressed={marcado}
                        className={'flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition disabled:opacity-40 ' + (marcado ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300')}
                      >
                        <Icon size={18} className="shrink-0 text-slate-600" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{atalho.label}</span><span className="block truncate text-[11px] text-slate-500">{atalho.grupo}</span></span>
                        {marcado ? <Check size={18} className="shrink-0 text-blue-700" /> : <span aria-hidden="true" className="text-lg text-slate-400">+</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              {erro && <p role="alert" className="text-xs font-semibold text-red-600">{erro}</p>}
              <div className="flex items-center justify-end gap-2">
                <button type="button" disabled={salvando} onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Cancelar</button>
                <button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {salvando ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                  {salvando ? 'Salvando...' : 'Salvar meus atalhos'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
