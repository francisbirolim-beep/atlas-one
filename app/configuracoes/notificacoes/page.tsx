'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft, Bell, BellOff, CheckCircle2, Clock3, MessageCircle,
  Moon, Smartphone, Volume2, VolumeX, ListTodo, CalendarDays, Factory,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  PREFERENCIAS_PADRAO,
  ativarPushNesteDispositivo,
  carregarPreferenciasNotificacao,
  desativarPushNesteDispositivo,
  salvarPreferenciasNotificacao,
  statusPushNesteDispositivo,
  type StatusPushDispositivo,
} from '@/lib/notificacoes'
import type { NotificacaoPreferencias, Usuario } from '@/lib/tipos'

type ChaveCategoria = 'tarefas' | 'agenda' | 'chat' | 'operacao'

const categorias: Array<{
  chave: ChaveCategoria
  titulo: string
  descricao: string
  icon: typeof Bell
}> = [
  { chave: 'chat', titulo: 'WhatsApp e mensagens', descricao: 'Novas mensagens, fila e transferências de atendimento.', icon: MessageCircle },
  { chave: 'tarefas', titulo: 'Tarefas', descricao: 'Tarefas atribuídas, cobranças e lembretes.', icon: ListTodo },
  { chave: 'agenda', titulo: 'Agenda', descricao: 'Convites, compromissos e avisos da agenda.', icon: CalendarDays },
  { chave: 'operacao', titulo: 'Operação', descricao: 'Produção, medição, engenharia e demais avisos do ERP.', icon: Factory },
]

export default function ConfiguracoesNotificacoesPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [prefs, setPrefs] = useState<NotificacaoPreferencias | null>(null)
  const [push, setPush] = useState<StatusPushDispositivo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function recarregarPush() {
    const atual = await statusPushNesteDispositivo()
    setPush(atual)
  }

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const u = await usuarioAtual()
        if (!ativo || !u) return
        setUsuario(u)
        const [p] = await Promise.all([
          carregarPreferenciasNotificacao(u.id),
          recarregarPush(),
        ])
        if (!ativo) return
        setPrefs(p)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [])

  async function alterar(patch: Partial<Omit<NotificacaoPreferencias, 'usuario_id'>>) {
    if (!usuario || !prefs || salvando) return
    const anterior = prefs
    const otimista = { ...prefs, ...patch }
    setPrefs(otimista)
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      const salvo = await salvarPreferenciasNotificacao(usuario.id, patch)
      if (!salvo) throw new Error('Não foi possível salvar a preferência.')
      setPrefs(salvo)
    } catch (e) {
      setPrefs(anterior)
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function ativarNesteDispositivo() {
    setErro('')
    setMensagem('')
    const resultado = await ativarPushNesteDispositivo()
    if (!resultado.ok) {
      setErro(resultado.error || 'Não foi possível ativar as notificações.')
      await recarregarPush()
      return
    }
    if (usuario) {
      const salvo = await salvarPreferenciasNotificacao(usuario.id, { push_ativo: true })
      if (salvo) setPrefs(salvo)
    }
    await recarregarPush()
    setMensagem('Notificações ativadas neste dispositivo.')
  }

  async function desativarNesteDispositivo() {
    setErro('')
    setMensagem('')
    const resultado = await desativarPushNesteDispositivo()
    if (!resultado.ok) {
      setErro(resultado.error || 'Não foi possível desativar as notificações.')
      return
    }
    await recarregarPush()
    setMensagem('Este dispositivo não receberá mais notificações do Atlas.')
  }

  if (carregando || !prefs) {
    return <main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Carregando configurações...</main>
  }

  const bloqueado = push?.permissao === 'denied'

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/configuracoes" className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={18}/>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Central de Notificações</h1>
            <p className="mt-1 text-sm text-slate-500">Escolha o que chega, em quais dispositivos e se o aviso terá som.</p>
          </div>
        </div>

        {(erro || mensagem) && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${erro ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {erro || mensagem}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <section className="space-y-5">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Smartphone size={20}/></span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-slate-900">Este dispositivo</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    Quando ativado, o Atlas pode avisar no canto do computador ou na tela do celular mesmo com a página em segundo plano.
                  </p>
                </div>
              </div>

              {!push?.suportado ? (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Este navegador não oferece Web Push.</div>
              ) : bloqueado ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  As notificações estão bloqueadas nas permissões do navegador/sistema. Libere o Atlas nas configurações do dispositivo e volte aqui.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${push?.inscrito ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {push?.inscrito ? <CheckCircle2 size={14}/> : <BellOff size={14}/>}
                    {push?.inscrito ? 'Ativo neste dispositivo' : 'Ainda não ativado'}
                  </span>
                  {push?.inscrito ? (
                    <button onClick={()=>void desativarNesteDispositivo()} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      Desativar neste dispositivo
                    </button>
                  ) : (
                    <button onClick={()=>void ativarNesteDispositivo()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                      Ativar notificações
                    </button>
                  )}
                </div>
              )}
              {!!push?.dispositivosAtivos && (
                <p className="mt-3 text-[11px] text-slate-400">
                  {push.dispositivosAtivos} dispositivo{push.dispositivosAtivos === 1 ? '' : 's'} ativo{push.dispositivosAtivos === 1 ? '' : 's'} para sua conta.
                </p>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <Bell size={19} className="text-slate-700"/>
                <div><h2 className="font-bold text-slate-900">O que quero receber</h2><p className="text-xs text-slate-500">Configuração individual do usuário.</p></div>
              </div>
              <div className="divide-y">
                {categorias.map(item => {
                  const Icone = item.icon
                  const ligado = prefs[item.chave]
                  return (
                    <div key={item.chave} className="flex items-center gap-3 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icone size={17}/></span>
                      <div className="min-w-0 flex-1">
                        <b className="block text-sm text-slate-800">{item.titulo}</b>
                        <span className="block text-xs text-slate-500">{item.descricao}</span>
                      </div>
                      <button type="button" disabled={salvando} onClick={()=>void alterar({ [item.chave]: !ligado })}
                        className={`relative h-7 w-12 rounded-full transition ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${ligado ? 'left-6' : 'left-1'}`}/>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                {prefs.som_ativo ? <Volume2 size={20} className="text-emerald-600"/> : <VolumeX size={20} className="text-slate-400"/>}
                <div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900">Som</h2><p className="text-xs text-slate-500">A notificação pode chegar com som ou silenciosa.</p></div>
                <button type="button" disabled={salvando} onClick={()=>void alterar({ som_ativo: !prefs.som_ativo })}
                  className={`relative h-7 w-12 rounded-full transition ${prefs.som_ativo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${prefs.som_ativo ? 'left-6' : 'left-1'}`}/>
                </button>
              </div>
              <label className="block text-xs font-semibold text-slate-600">Volume dentro do Atlas</label>
              <input type="range" min="0.1" max="1" step="0.1" value={prefs.som_volume}
                onChange={e=>setPrefs({ ...prefs, som_volume: Number(e.target.value) })}
                onMouseUp={()=>void alterar({ som_volume: prefs.som_volume })}
                onTouchEnd={()=>void alterar({ som_volume: prefs.som_volume })}
                className="mt-3 w-full" disabled={!prefs.som_ativo}/>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Baixo</span><span>{Math.round(Number(prefs.som_volume)*100)}%</span><span>Alto</span></div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <Moon size={20} className="text-indigo-600"/>
                <div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900">Não perturbe</h2><p className="text-xs text-slate-500">Os avisos continuam chegando, mas sem som nesse período.</p></div>
                <button type="button" disabled={salvando} onClick={()=>void alterar({ nao_perturbe_ativo: !prefs.nao_perturbe_ativo })}
                  className={`relative h-7 w-12 rounded-full transition ${prefs.nao_perturbe_ativo ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${prefs.nao_perturbe_ativo ? 'left-6' : 'left-1'}`}/>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">De
                  <input type="time" value={prefs.nao_perturbe_inicio.slice(0,5)}
                    onChange={e=>void alterar({ nao_perturbe_inicio: e.target.value })}
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal"/>
                </label>
                <label className="text-xs font-semibold text-slate-600">Até
                  <input type="time" value={prefs.nao_perturbe_fim.slice(0,5)}
                    onChange={e=>void alterar({ nao_perturbe_fim: e.target.value })}
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal"/>
                </label>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock3 size={13}/> Horário local: São Paulo.</p>
            </div>

            <div className="rounded-2xl border bg-slate-900 p-5 text-white shadow-sm">
              <h3 className="font-bold">Como funciona</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Com o Atlas aberto, o sino atualiza em tempo real. Em segundo plano, minimizado ou instalado no celular, o Web Push usa a notificação do próprio sistema operacional.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
