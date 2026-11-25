'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { precisaInstalarAtlasNoIOS, statusPushNesteDispositivo } from '@/lib/notificacoes'

export default function NotificacaoDispositivoAviso() {
  const [aviso, setAviso] = useState<'instalar' | 'ativar' | 'bloqueado' | null>(null)
  useEffect(() => {
    let ativo = true
    let consultando = false
    async function verificar() {
      if (!ativo || consultando) return
      consultando = true
      try {
        const usuario = await usuarioAtual()
        if (!usuario || !ativo) return
        if (precisaInstalarAtlasNoIOS()) { setAviso('instalar'); return }
        const status = await statusPushNesteDispositivo()
        if (!ativo) return
        setAviso(!status.suportado || status.inscrito ? null : status.permissao === 'denied' ? 'bloqueado' : 'ativar')
      } catch { /* A central de notificações permanece acessível. */ }
      finally { consultando = false }
    }
    void verificar()
    window.addEventListener('focus', verificar)
    return () => { ativo = false; window.removeEventListener('focus', verificar) }
  }, [])
  if (!aviso) return null
  return <section className="mx-3 mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-white p-3 text-slate-800 sm:mx-4" aria-label="Notificações deste dispositivo">
    <BellRing size={20} className="shrink-0 text-blue-700"/>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold">Receba tarefas e mensagens neste dispositivo</p>
      <p className="text-xs text-slate-600">{aviso === 'instalar' ? 'No Safari, adicione o Atlas à Tela de Início. Abra pelo ícone para habilitar avisos com som.' : aviso === 'bloqueado' ? 'Libere as notificações nas configurações do navegador ou do dispositivo.' : 'Ative os avisos com som para receber notificações mesmo fora do Atlas.'}</p>
    </div>
    <Link href="/configuracoes/notificacoes" className="shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Configurar avisos</Link>
  </section>
}
