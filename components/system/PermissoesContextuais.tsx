'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, Save, ShieldCheck, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { lerAcessoUsuarioConfig, salvarAcessoUsuarioConfig, type AcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { listarPermissoesUsuario, listarSetores, salvarPermissoesUsuario } from '@/lib/setores'
import { montarBlocosPermissao, type ItemPermissaoBloco } from '@/lib/permissoesBlocos'
import { nivelCliente360, type RecursoCliente360 } from '@/lib/cliente360Permissoes'
import { resolverContextoPermissoes } from '@/lib/permissoesContextuais'
import type { NivelPermissao, Setor, Usuario } from '@/lib/tipos'

type AcessoPorUsuario = {
  usuario: Usuario
  setores: Record<string, NivelPermissao>
  config: AcessoUsuarioConfig
}
type Edicao = Pick<AcessoPorUsuario, 'setores' | 'config'>
const NIVEIS: { valor: NivelPermissao; label: string }[] = [
  { valor: 'oculto', label: 'Sem acesso' },
  { valor: 'consulta', label: 'Visualizar' },
  { valor: 'edicao', label: 'Visualizar e editar' },
]
const peso: Record<NivelPermissao, number> = { oculto: 0, consulta: 1, edicao: 2 }

function copiarEdicao(entrada: AcessoPorUsuario): Edicao {
  return {
    setores: { ...entrada.setores },
    config: { ...entrada.config, acoes: { ...entrada.config.acoes }, cliente360: { ...entrada.config.cliente360 } },
  }
}

function nivelResumo(entrada: Edicao, modulo: ItemPermissaoBloco | undefined, recurso?: RecursoCliente360): NivelPermissao {
  if (recurso) return nivelCliente360({ role: 'funcionario', setores: entrada.setores, acoes: entrada.config.acoes, cliente360: entrada.config.cliente360 }, recurso)
  if (!modulo) return 'oculto'
  const setor = entrada.setores[modulo.setorId] || 'oculto'
  if (setor === 'oculto') return 'oculto'
  const permitidas = modulo.acoes.map(acao => entrada.config.acoes[acao.id] || setor)
  if (!permitidas.some(nivel => nivel !== 'oculto')) return 'oculto'
  if (setor === 'edicao' && permitidas.some(nivel => nivel === 'edicao')) return 'edicao'
  return 'consulta'
}

export default function PermissoesContextuais() {
  const pathname = usePathname()
  const [master, setMaster] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [abaCliente, setAbaCliente] = useState<RecursoCliente360>('visao')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [setores, setSetores] = useState<Setor[]>([])
  const [usuarios, setUsuarios] = useState<AcessoPorUsuario[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [rascunho, setRascunho] = useState<Edicao | null>(null)
  const [moduloId, setModuloId] = useState('')

  const contexto = useMemo(() => resolverContextoPermissoes(pathname, abaCliente), [pathname, abaCliente])
  const modulos = useMemo(() => montarBlocosPermissao(setores).flatMap(bloco => bloco.itens), [setores])
  const moduloAtual = modulos.find(modulo => modulo.id === moduloId)
  const usuarioSelecionado = usuarios.find(entrada => entrada.usuario.id === usuarioId)
  const alterado = Boolean(usuarioSelecionado && rascunho &&
    JSON.stringify(copiarEdicao(usuarioSelecionado)) !== JSON.stringify(rascunho))

  useEffect(() => {
    let ativo = true
    void usuarioAtual().then(usuario => { if (ativo) setMaster(usuario?.role === 'master') })
      .catch(() => { if (ativo) setMaster(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    setAberto(false)
    setAbaCliente((document.documentElement.dataset.atlasClienteAba as RecursoCliente360) || 'visao')
  }, [pathname])

  useEffect(() => {
    const atualizar = (evento: Event) => {
      if (!/^\/clientes\/[^/]+(?:\/|$)/.test(pathname)) return
      const aba = (evento as CustomEvent<{ aba?: RecursoCliente360 }>).detail?.aba
      if (aba) setAbaCliente(aba)
    }
    window.addEventListener('atlas:cliente360-aba', atualizar)
    return () => window.removeEventListener('atlas:cliente360-aba', atualizar)
  }, [pathname])

  useEffect(() => {
    if (!aberto) return
    const primeiro = contexto.moduloIds.find(id => modulos.some(m => m.id === id))
    setModuloId(primeiro || '')
  }, [aberto, contexto.titulo, modulos])

  useEffect(() => {
    if (!aberto) return
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !salvando) setAberto(false)
    }
    window.addEventListener('keydown', fecharEscape)
    return () => window.removeEventListener('keydown', fecharEscape)
  }, [aberto, salvando])

  async function carregar() {
    setCarregando(true)
    setErro('')
    setMensagem('')
    setUsuarios([])
    setUsuarioId('')
    setRascunho(null)
    try {
      const atual = await usuarioAtual()
      if (atual?.role !== 'master') throw new Error('Somente o Master pode gerenciar permissões.')
      const [resposta, listaSetores] = await Promise.all([
        supabase.from('usuarios').select('*').order('nome', { ascending: true }),
        listarSetores(),
      ])
      if (resposta.error) throw new Error('Não foi possível listar os usuários.')
      if (!listaSetores.length) throw new Error('Não foi possível carregar os setores de permissões.')
      const entradas = await Promise.all(((resposta.data || []) as Usuario[]).map(async usuario => {
        if (usuario.role === 'master') return { usuario, setores: {}, config: { crmEscopo: 'todos' as const, acoes: {} } }
        const [mapa, config] = await Promise.all([
          listarPermissoesUsuario(usuario.id),
          lerAcessoUsuarioConfig(usuario),
        ])
        return { usuario, setores: mapa, config }
      }))
      setSetores(listaSetores)
      setUsuarios(entradas)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível conferir os acessos.')
    } finally {
      setCarregando(false)
    }
  }

  function selecionar(entrada: AcessoPorUsuario) {
    if (salvando) return
    setUsuarioId(entrada.usuario.id)
    setRascunho(copiarEdicao(entrada))
    setMensagem('')
    setErro('')
  }

  // Ao aumentar o teto de um setor, mantém fixas as permissões anteriores das
  // outras ações: uma liberação contextual não pode liberar módulos vizinhos.
  function alterarAcao(idAcao: string, nivel: NivelPermissao) {
    if (!moduloAtual) return
    setRascunho(atual => {
      if (!atual) return atual
      const setorId = moduloAtual.setorId
      const nivelSetor = atual.setores[setorId] || 'oculto'
      const proximasAcoes = { ...atual.config.acoes }
      const proximosSetores = { ...atual.setores }
      if (peso[nivel] > peso[nivelSetor]) {
        for (const modulo of modulos.filter(item => item.setorId === setorId)) {
          for (const acao of modulo.acoes) {
            if (!(acao.id in proximasAcoes)) proximasAcoes[acao.id] = nivelSetor
          }
        }
        proximosSetores[setorId] = nivel
      }
      proximasAcoes[idAcao] = nivel
      return { setores: proximosSetores, config: { ...atual.config, acoes: proximasAcoes } }
    })
    setMensagem('')
  }

  function alterarAbaCliente(nivel: NivelPermissao) {
    const recurso = contexto.recursoCliente360
    if (!recurso) return
    setRascunho(atual => atual ? {
      ...atual,
      config: { ...atual.config, cliente360: { ...atual.config.cliente360, [recurso]: nivel } },
    } : atual)
    setMensagem('')
  }

  async function salvar() {
    if (!usuarioSelecionado || !rascunho || usuarioSelecionado.usuario.role === 'master' || salvando || !alterado) return
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      const ok = await salvarAcessoUsuarioConfig(usuarioSelecionado.usuario.id, rascunho.config)
      if (!ok) throw new Error('Não foi possível salvar as ações. Nenhum setor foi alterado.')
      const mudancasSetores = Object.fromEntries(
        Object.entries(rascunho.setores).filter(([id, nivel]) => usuarioSelecionado.setores[id] !== nivel),
      ) as Record<string, NivelPermissao>
      if (Object.keys(mudancasSetores).length) {
        const resultado = await salvarPermissoesUsuario(usuarioSelecionado.usuario.id, mudancasSetores)
        if (resultado.error) {
          setErro('As ações foram salvas, mas não foi possível atualizar o setor. Confira em Configurações > Usuários.')
          return
        }
      }
      setUsuarios(atuais => atuais.map(entrada =>
        entrada.usuario.id === usuarioSelecionado.usuario.id
          ? { ...entrada, setores: { ...rascunho.setores }, config: { ...rascunho.config } }
          : entrada))
      setMensagem('Permissões salvas para ' + usuarioSelecionado.usuario.nome + '.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar as permissões.')
    } finally {
      setSalvando(false)
    }
  }

  if (!master) return null

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); void carregar() }}
        className="fixed right-3 top-[73px] z-[42] flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white/95 px-3 py-2 text-xs font-bold text-indigo-800 shadow-md backdrop-blur-sm hover:bg-indigo-50 sm:right-5"
        aria-label="Gerenciar permissões desta tela"
        title="Atalho do Master: quem pode ver e editar esta tela"
      >
        <ShieldCheck size={16} /> Permissões
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-2 py-5 sm:items-center sm:px-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="atlas-permissoes-titulo" className="my-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl" style={{ maxHeight: 'min(94vh, 960px)' }}>
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h2 id="atlas-permissoes-titulo" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="text-indigo-700" size={21} /> Permissões desta tela</h2>
                <p className="mt-1 text-sm text-slate-600">{contexto.titulo} · Atalho exclusivo do Master</p>
              </div>
              <button type="button" disabled={salvando} onClick={() => setAberto(false)} aria-label="Fechar permissões" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {carregando ? (
                <p className="flex items-center gap-2 py-12 text-sm text-slate-600"><Loader2 className="animate-spin" size={18}/> Conferindo usuários e permissões...</p>
              ) : (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="text-xs font-semibold text-slate-600">
                      Área / módulo de permissões
                      <select value={moduloId} onChange={evento => { setModuloId(evento.target.value); setMensagem('') }} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                        <option value="">Selecione a área</option>
                        {modulos.map(modulo => <option key={modulo.id} value={modulo.id}>{modulo.label}</option>)}
                      </select>
                    </label>
                    <Link href="/configuracoes/usuarios" onClick={() => setAberto(false)} className="self-end rounded-xl border border-indigo-200 px-3 py-2.5 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Gerenciamento completo ↗</Link>
                  </div>
                  {contexto.recursoCliente360 && <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">Cliente 360: a permissão da aba é independente das ações do setor. Para liberar uma aba bloqueada pelo setor, libere também a ação de consulta correspondente abaixo.</p>}
                  {!moduloAtual && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">Selecione a área correspondente a esta tela para ver e ajustar suas ações. As permissões específicas do WhatsApp continuam no gerenciamento completo.</p>}
                  <div className="grid gap-4 md:grid-cols-[minmax(185px,0.95fr)_minmax(0,1.7fr)]">
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Quem tem acesso</h3>
                      <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                        {usuarios.map(entrada => {
                          const selecionado = entrada.usuario.id === usuarioId
                          const nivel = entrada.usuario.role === 'master' ? 'edicao' : nivelResumo(entrada, moduloAtual, contexto.recursoCliente360)
                          return (
                            <button type="button" key={entrada.usuario.id} onClick={() => selecionar(entrada)} className={'w-full rounded-lg px-3 py-2.5 text-left transition ' + (selecionado ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-50')}>
                              <span className="block truncate text-sm font-semibold">{entrada.usuario.nome}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">{entrada.usuario.role === 'master' ? 'Master · acesso total' : NIVEIS.find(n => n.valor === nivel)?.label}</span>
                            </button>
                          )
                        })}
                        {!usuarios.length && <p className="px-3 py-6 text-sm text-slate-500">Nenhum usuário encontrado.</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      {!usuarioSelecionado || !rascunho ? (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">Selecione um usuário à esquerda para conferir quem pode visualizar e o que pode executar nesta área.</div>
                      ) : usuarioSelecionado.usuario.role === 'master' ? (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-5 text-sm text-indigo-900">O Master tem acesso total. As permissões dele não podem ser restringidas aqui.</div>
                      ) : (
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold">Permissões de {usuarioSelecionado.usuario.nome}</h3>
                          {contexto.recursoCliente360 && (
                            <label className="block rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900">
                              Acesso à aba: {contexto.titulo}
                              <select value={rascunho.config.cliente360?.[contexto.recursoCliente360] || 'herdar'} onChange={evento => {
                                if (evento.target.value === 'herdar') {
                                  setRascunho(atual => { if (!atual) return atual; const matriz = { ...atual.config.cliente360 }; delete matriz[contexto.recursoCliente360!]; return { ...atual, config: { ...atual.config, cliente360: matriz } } })
                                } else alterarAbaCliente(evento.target.value as NivelPermissao)
                              }} className="mt-2 block w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm">
                                <option value="herdar">Herdar regra do setor</option>
                                {NIVEIS.map(nivel => <option key={nivel.valor} value={nivel.valor}>{nivel.label}</option>)}
                              </select>
                              <span className="mt-2 block font-normal">Acesso efetivo: {NIVEIS.find(n => n.valor === nivelResumo(rascunho, moduloAtual, contexto.recursoCliente360))?.label}. A regra do setor pode limitar a aba.</span>
                            </label>
                          )}
                          {moduloAtual ? (
                            <div className="rounded-xl border border-slate-200">
                              <div className="border-b bg-slate-50 px-3 py-3"><p className="text-sm font-semibold">{moduloAtual.label}</p><p className="mt-1 text-xs text-slate-500">Setor: {NIVEIS.find(n => n.valor === (rascunho.setores[moduloAtual.setorId] || 'oculto'))?.label}. As autorizações abaixo são individuais.</p></div>
                              {moduloAtual.acoes.map(acao => (
                                <label key={acao.id} className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="min-w-0"><span className="block text-sm font-medium">{acao.label}</span><span className="mt-0.5 block text-xs text-slate-500">{acao.descricao}</span></span>
                                  <select aria-label={acao.label} value={rascunho.config.acoes[acao.id] || rascunho.setores[moduloAtual.setorId] || 'oculto'} onChange={evento => alterarAcao(acao.id, evento.target.value as NivelPermissao)} className="w-full shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs sm:w-44">
                                    {NIVEIS.map(nivel => <option key={nivel.valor} value={nivel.valor}>{nivel.label}</option>)}
                                  </select>
                                </label>
                              ))}
                            </div>
                          ) : <p className="text-sm text-slate-500">Escolha a área acima para editar as ações.</p>}
                          <p className="text-xs text-slate-500">As permissões continuam obedecendo às verificações existentes em cada módulo. Aumentar o nível setorial não libera automaticamente outras ações já definidas.</p>
                          {mensagem && <p role="status" className="text-sm font-semibold text-emerald-700">{mensagem}</p>}
                          <button type="button" disabled={!alterado || salvando} onClick={() => void salvar()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40">
                            {salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            Salvar permissões desta área
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {erro && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
