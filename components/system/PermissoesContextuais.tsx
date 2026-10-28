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
import { nivelEfetivoAcao } from '@/lib/producaoPermissoes'
import { acaoAutorizadaNoModulo, acaoExigeEdicao, nivelModuloSobSetor, opcoesSetorMaster } from '@/lib/permissoesModeloMaster'
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
    config: { ...entrada.config, acoes: { ...entrada.config.acoes }, modulos: { ...entrada.config.modulos }, cliente360: { ...entrada.config.cliente360 } },
  }
}

function nivelResumo(entrada: Edicao, modulo: ItemPermissaoBloco | undefined, recurso?: RecursoCliente360, acoesDaPagina?: ItemPermissaoBloco['acoes']): NivelPermissao {
  if (recurso) return nivelCliente360({ role: 'funcionario', setores: entrada.setores, acoes: entrada.config.acoes, modulos:entrada.config.modulos, cliente360: entrada.config.cliente360 }, recurso)
  if (!modulo) return 'oculto'
  const setor = entrada.setores[modulo.setorId] || 'oculto'
  if (setor === 'oculto') return 'oculto'
  const permitidas = (acoesDaPagina || modulo.acoes).map(acao => nivelEfetivoAcao(
    'funcionario',entrada.setores,entrada.config,modulo.setorId,acao.id))
  if (!permitidas.some(nivel => nivel !== 'oculto')) return 'oculto'
  if (permitidas.some(nivel => nivel === 'edicao')) return 'edicao'
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
  // O atalho contextual nunca oferece módulos de outras telas. O catálogo
  // completo continua disponível apenas em Configurações > Usuários.
  // No Kanban comercial o módulo correspondente é Fazer orçamento.
  const modulosDaTela = useMemo(() => {
    const ids = pathname === '/kanban/comercial' ? ['fazer-orcamento'] : contexto.moduloIds
    return ids.map(id => modulos.find(modulo => modulo.id === id))
      .filter((modulo): modulo is ItemPermissaoBloco => Boolean(modulo))
  }, [pathname, contexto, modulos])
  const moduloAtual = modulosDaTela.find(modulo => modulo.id === moduloId)
  // Retirada/restauração são as únicas autorizações específicas de cards
  // nesta tela. Edição de preço, PDFs etc. pertencem ao módulo completo.
  const acoesDaTela = moduloAtual
    ? pathname === '/kanban/comercial'
      ? moduloAtual.acoes.filter(acao => acao.id === 'comercial.orcamento.retirar_card' || acao.id === 'comercial.orcamento.restaurar_card')
      : moduloAtual.acoes
    : []
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

  // O atalho do Kanban abre exatamente as ações do módulo Fazer orçamento,
  // sem autorizar ninguém automaticamente e sem mexer em outros módulos.
  useEffect(() => {
    if (pathname !== '/kanban/comercial' || !master) return
    const abrirKanban = () => {
      setModuloId('fazer-orcamento')
      setAberto(true)
      void carregar()
    }
    window.addEventListener('atlas:permissoes-kanban-comercial', abrirKanban)
    return () => window.removeEventListener('atlas:permissoes-kanban-comercial', abrirKanban)
  }, [pathname, master])

  useEffect(() => {
    if (!aberto) return
    const primeiro = modulosDaTela[0]?.id
    setModuloId(primeiro || '')
  }, [aberto, modulosDaTela])

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

  // Os três níveis são independentes. Não abrir outros módulos ao editar uma
  // única ação. Um setor ou módulo oculto não é reaberto por ação interna.
  function alterarSetorContextual(nivel: NivelPermissao) {
    if (!moduloAtual) return
    setRascunho(atual => {
      if (!atual) return atual
      const anterior=atual.setores[moduloAtual.setorId]||'oculto'
      const modulos={...atual.config.modulos}
      const acoes={...atual.config.acoes}
      if((anterior==='oculto'&&nivel!=='oculto')||(anterior==='consulta'&&nivel==='edicao')){
        for(const item of modulosDaTela.filter(item=>item.setorId===moduloAtual.setorId)){
          modulos[item.id]=anterior==='consulta'?'consulta':'oculto'
          if(anterior==='consulta')for(const acao of (pathname === '/kanban/comercial' && item.id === 'fazer-orcamento' ? acoesDaTela : item.acoes)){
            if(!(acao.id in acoes))acoes[acao.id]='consulta'
          }
        }
      }
      return { ...atual, setores:{...atual.setores,[moduloAtual.setorId]:nivel},
        config:{...atual.config,modulos,acoes} }
    })
    setMensagem('')
  }

  function alterarModuloContextual(nivel: NivelPermissao) {
    if (!moduloAtual || moduloAtual.id==='configuracoes') return
    if((rascunho?.setores[moduloAtual.setorId]||'oculto')==='consulta'&&nivel==='edicao')return
    setRascunho(atual => {
      if(!atual)return atual
      const anterior=atual.config.modulos?.[moduloAtual.id]||atual.setores[moduloAtual.setorId]||'oculto'
      const acoes={...atual.config.acoes}
      if(anterior==='oculto'&&nivel!=='oculto')for(const acao of acoesDaTela)acoes[acao.id]='oculto'
      else if(anterior==='consulta'&&nivel==='edicao')for(const acao of acoesDaTela){
        if(!(acao.id in acoes))acoes[acao.id]='consulta'
      }
      return {...atual,config:{...atual.config,
        modulos:{...atual.config.modulos,[moduloAtual.id]:nivel},acoes}}
    })
    setMensagem('')
  }

  function alterarAcao(idAcao: string, permitido: boolean) {
    if(!moduloAtual || moduloAtual.id==='configuracoes')return
    setRascunho(atual => {
      if(!atual || (atual.setores[moduloAtual.setorId]||'oculto')==='oculto')return atual
      if((atual.config.modulos?.[moduloAtual.id]||atual.setores[moduloAtual.setorId])==='oculto')return atual
      return {...atual,config:{...atual.config,acoes:{...atual.config.acoes,[idAcao]:permitido?'edicao':'oculto'}}}
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
        <ShieldCheck size={16} /> {pathname === '/kanban/comercial' ? 'Autorizar cards' : 'Permissões'}
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
                    <div className="min-w-0 text-xs font-semibold text-slate-600">
                      Permissões relacionadas à tela atual
                      {modulosDaTela.length === 1 ? (
                        <div className="mt-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-900">
                          {contexto.titulo} <span className="font-normal">· {moduloAtual?.label}</span>
                        </div>
                      ) : modulosDaTela.length > 1 ? (
                        <select aria-label="Escolher módulo desta tela" value={moduloId} onChange={evento => { setModuloId(evento.target.value); setMensagem('') }} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                          {modulosDaTela.map(modulo => <option key={modulo.id} value={modulo.id}>{modulo.label}</option>)}
                        </select>
                      ) : (
                        <p className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-normal text-amber-900">Esta tela ainda não possui permissões próprias cadastradas.</p>
                      )}
                    </div>
                    <Link href="/configuracoes/usuarios" onClick={() => setAberto(false)} className="self-end rounded-xl border border-indigo-200 px-3 py-2.5 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Gerenciar todos os setores ↗</Link>
                  </div>
                  {pathname === '/kanban/comercial' && moduloAtual?.id === 'fazer-orcamento' && (
                    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
                      <strong>Autorizar retirada de cards do Kanban comercial</strong>
                      <p className="mt-1">1. Selecione o funcionário. 2. Confirme que Setor e Módulo estão em <strong>Consulta e edição</strong>. 3. Marque <strong>Retirar card duplicado/incorreto</strong> e, se desejar, <strong>Restaurar card retirado</strong>. 4. Toque em <strong>Salvar permissões desta área</strong>.</p>
                      <p className="mt-1 text-xs">Essa autorização não libera exclusão de colunas nem apaga orçamentos, vendas ou histórico.</p>
                    </div>
                  )}
                  {contexto.recursoCliente360 && <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">Cliente 360: a permissão da aba é independente das ações do setor. Para liberar uma aba bloqueada pelo setor, libere também a ação de consulta correspondente abaixo.</p>}
                  {!moduloAtual && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">Para autorizações que não pertencem a esta tela, use Gerenciar todos os setores. Nenhum acesso de outro módulo será alterado aqui.</p>}
                  <div className="grid gap-4 md:grid-cols-[minmax(185px,0.95fr)_minmax(0,1.7fr)]">
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Quem tem acesso</h3>
                      <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                        {usuarios.map(entrada => {
                          const selecionado = entrada.usuario.id === usuarioId
                          const nivel = entrada.usuario.role === 'master' ? 'edicao' : nivelResumo(entrada, moduloAtual, contexto.recursoCliente360, acoesDaTela)
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
                              <span className="mt-2 block font-normal">Acesso efetivo: {NIVEIS.find(n => n.valor === nivelResumo(rascunho, moduloAtual, contexto.recursoCliente360, acoesDaTela))?.label}. A regra do setor pode limitar a aba.</span>
                            </label>
                          )}
                          {moduloAtual ? (
                            <div className="rounded-xl border border-slate-200">
                              <div className="space-y-3 border-b bg-slate-50 px-3 py-3">
                                <p className="text-sm font-semibold">{moduloAtual.label}</p>
                                <p className="text-xs text-slate-500">1. O Master libera o setor. 2. Escolhe consulta ou consulta e edição em cada módulo. 3. Autoriza ou bloqueia cada ação individualmente.</p>
                                <label className="block text-xs font-semibold">1. Setor
                                  <select value={rascunho.setores[moduloAtual.setorId]||'oculto'}
                                    onChange={e=>alterarSetorContextual(e.target.value as NivelPermissao)}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">
                                    {opcoesSetorMaster(rascunho.setores[moduloAtual.setorId]||'oculto').map(n=><option key={n.valor} value={n.valor}>{n.label}</option>)}
                                  </select>
                                </label>
                                <label className="block text-xs font-semibold">2. Módulo / etapa
                                  <select disabled={moduloAtual.id==='configuracoes'||(rascunho.setores[moduloAtual.setorId]||'oculto')==='oculto'}
                                    value={moduloAtual.id==='configuracoes'?'oculto':nivelModuloSobSetor(
                                      rascunho.setores[moduloAtual.setorId]||'oculto',
                                      rascunho.config.modulos?.[moduloAtual.id]||rascunho.setores[moduloAtual.setorId]||'oculto'
                                    )}
                                    onChange={e=>alterarModuloContextual(e.target.value as NivelPermissao)}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs disabled:opacity-50">
                                    <option value="oculto">Sem acesso</option>
                                    <option value="consulta">Somente consulta</option>
                                    <option value="edicao" disabled={(rascunho.setores[moduloAtual.setorId]||'oculto')==='consulta'}>Consulta e edição</option>
                                  </select>
                                </label>
                              </div>
                              {moduloAtual.id==='configuracoes'&&<p className="px-3 py-3 text-xs font-semibold text-violet-800">Exclusivo do Master. Não é possível liberar configurações do Atlas para funcionários.</p>}
                              {pathname === '/kanban/comercial' && <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600">Apenas as autorizações de cards desta tela aparecem abaixo. Para preços, PDF e outros módulos, use o gerenciamento completo.</p>}
                              {acoesDaTela.map(acao => (
                                <label key={acao.id} className={`flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${pathname === '/kanban/comercial' && acao.id.endsWith('_card') ? 'bg-indigo-50/60' : ''}`}>
                                  <span className="min-w-0"><span className="block text-sm font-medium">{acao.label}</span><span className="mt-0.5 block text-xs text-slate-500">{acao.descricao}</span></span>
                                  <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
                                    <input type="checkbox" aria-label={'Liberar ação '+acao.label}
                                      disabled={moduloAtual.id==='configuracoes'||(rascunho.setores[moduloAtual.setorId]||'oculto')==='oculto'||(rascunho.config.modulos?.[moduloAtual.id]||rascunho.setores[moduloAtual.setorId]||'oculto')==='oculto'||((rascunho.config.modulos?.[moduloAtual.id]||rascunho.setores[moduloAtual.setorId])==='consulta'&&acaoExigeEdicao(acao))}
                                      checked={acaoAutorizadaNoModulo(acao,nivelEfetivoAcao('funcionario',rascunho.setores,rascunho.config,moduloAtual.setorId,acao.id))}
                                      onChange={evento => alterarAcao(acao.id,evento.target.checked)}
                                      className="h-4 w-4 accent-indigo-700 disabled:opacity-40" />
                                    {acaoAutorizadaNoModulo(acao,nivelEfetivoAcao('funcionario',rascunho.setores,rascunho.config,moduloAtual.setorId,acao.id))?'Liberada':'Bloqueada'}
                                  </label>
                                </label>
                              ))}
                            </div>
                          ) : <p className="text-sm text-slate-500">Escolha a área acima para editar as ações.</p>}
                          <p className="text-xs text-slate-500">Um setor oculto bloqueia todos os módulos, mesmo se uma ação interna indicar edição. Ativar apenas uma etapa não habilita as outras.</p>
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
