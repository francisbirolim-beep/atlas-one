'use client'

import { useEffect, useState } from 'react'
import { usuarioAtual } from '@/lib/auth'
import { lerHomeUsuarioConfig, temModulo, type HomeUsuarioConfig } from '@/lib/homeUsuario'
import HomeExecutiveHero from '@/components/system/HomeExecutiveHero'
import HomeRecentQuotes from '@/components/system/HomeRecentQuotes'
import HomeManagementOverview from '@/components/system/HomeManagementOverview'
import HomeKanbanBlock from '@/components/system/HomeKanbanBlock'
import HomeAssistenciasBlock from '@/components/system/HomeAssistenciasBlock'
import HomeTasksBlock from '@/components/system/HomeTasksBlock'
import HomeCalendarBlock from '@/components/system/HomeCalendarBlock'
import HomeAlertsBlock from '@/components/system/HomeAlertsBlock'

export default function HomeDashboard() {
  const [config, setConfig] = useState<HomeUsuarioConfig | null>(null)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async usuario => {
      if (!usuario) return
      const carregada = await lerHomeUsuarioConfig(usuario)
      if (ativo) setConfig(carregada)
    })
    return () => { ativo = false }
  }, [])

  if (!config) {
    return (
      <div className="atlas-home-dashboard w-full max-w-full overflow-x-hidden">
        <HomeExecutiveHero modulos={[]} />
        <section className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400 shadow-sm">Carregando a tela configurada para este usuário...</div>
        </section>
      </div>
    )
  }

  const mostrarNegocio = temModulo(config, 'kanban') || temModulo(config, 'assistencias')
  const mostrarPessoal = temModulo(config, 'tarefas') || temModulo(config, 'calendario') || temModulo(config, 'notificacoes')

  return (
    <div className="atlas-home-dashboard w-full max-w-full overflow-x-hidden">
      <HomeExecutiveHero modulos={config.modulos} />

      {temModulo(config, 'indicadores') && <HomeManagementOverview />}

      {temModulo(config, 'orcamentos') && <HomeRecentQuotes />}

      {mostrarNegocio && (
        <section className="atlas-home-mobile-full mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <div className="grid w-full min-w-0 gap-4 xl:grid-cols-2">
            {temModulo(config, 'kanban') && <HomeKanbanBlock />}
            {temModulo(config, 'assistencias') && <HomeAssistenciasBlock escopo={config.assistenciasEscopo} />}
          </div>
        </section>
      )}

      {mostrarPessoal && (
        <section className="atlas-home-mobile-full mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <div className="grid w-full min-w-0 gap-4 xl:grid-cols-2">
            {temModulo(config, 'tarefas') && <HomeTasksBlock />}
            {temModulo(config, 'calendario') && <HomeCalendarBlock />}
            {temModulo(config, 'notificacoes') && (
              <div className={temModulo(config, 'tarefas') && temModulo(config, 'calendario') ? 'xl:col-span-2' : ''}>
                <HomeAlertsBlock />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
