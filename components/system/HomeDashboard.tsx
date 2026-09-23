'use client'

import { useEffect, useState } from 'react'
import { usuarioAtual } from '@/lib/auth'
import { DASHBOARDS, lerHomeUsuarioConfig, temModulo, type DashboardId, type HomeUsuarioConfig } from '@/lib/homeUsuario'
import HomeExecutiveHero from '@/components/system/HomeExecutiveHero'
import HomeRecentQuotes from '@/components/system/HomeRecentQuotes'
import HomeManagementOverview from '@/components/system/HomeManagementOverview'
import HomeKanbanBlock from '@/components/system/HomeKanbanBlock'
import HomeAssistenciasBlock from '@/components/system/HomeAssistenciasBlock'
import HomeTasksBlock from '@/components/system/HomeTasksBlock'
import HomeCalendarBlock from '@/components/system/HomeCalendarBlock'
import HomeAlertsBlock from '@/components/system/HomeAlertsBlock'
import HomeSectorOverview from '@/components/system/HomeSectorOverview'
import HomeQuotesOverview from '@/components/system/HomeQuotesOverview'

export default function HomeDashboard() {
  const [config, setConfig] = useState<HomeUsuarioConfig | null>(null)
  const [dashboard, setDashboard] = useState<DashboardId | null>(null)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async usuario => {
      if (!usuario) return
      const carregada = await lerHomeUsuarioConfig(usuario)
      if (ativo) {
        setConfig(carregada)
        setDashboard(carregada.dashboards?.includes('pessoal') ? 'pessoal' : (carregada.dashboardPrincipal || carregada.dashboards?.[0] || 'geral'))
      }
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

  const atual = dashboard || (config.dashboards?.includes('pessoal') ? 'pessoal' : config.dashboardPrincipal) || 'geral'
  const permitidos = config.dashboards?.length ? config.dashboards : ['geral'] as DashboardId[]
  const mostrarComercial = atual === 'geral' || atual === 'comercial' || atual === 'orcamentos'
  const mostrarAssistencias = atual === 'geral' || atual === 'assistencias'
  const mostrarOperacional = ['engenharia', 'producao', 'instalacao', 'financeiro'].includes(atual)
  const mostrarPessoal = atual === 'geral' || atual === 'pessoal'
  const mostrarNegocio = (mostrarComercial && temModulo(config, 'kanban')) || (mostrarAssistencias && temModulo(config, 'assistencias'))

  return (
    <div className="atlas-home-dashboard w-full max-w-full overflow-x-hidden">
      <HomeExecutiveHero modulos={config.modulos} />

      {permitidos.length > 1 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <span className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Dashboard</span>
            {DASHBOARDS.filter(item => permitidos.includes(item.id)).map(item => (
              <button key={item.id} type="button" onClick={() => setDashboard(item.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${atual === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.label}</button>
            ))}
          </div>
        </section>
      )}

      {(atual === 'geral' || atual === 'comercial') && temModulo(config, 'indicadores') && <HomeManagementOverview />}

      {atual === 'orcamentos' && <HomeQuotesOverview />}

      {mostrarOperacional && <HomeSectorOverview dashboard={atual as DashboardId} />}

      {mostrarComercial && temModulo(config, 'orcamentos') && <HomeRecentQuotes />}

      {mostrarOperacional && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dashboard do setor</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{DASHBOARDS.find(item => item.id === atual)?.label}</h2>
            <p className="mt-1 text-sm text-slate-500">Acompanhamento objetivo das pendências e do volume atual deste setor.</p>
          </div>
        </section>
      )}

      {mostrarNegocio && (
        <section className="atlas-home-mobile-full mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
          <div className="grid w-full min-w-0 gap-4 xl:grid-cols-2">
            {mostrarComercial && temModulo(config, 'kanban') && <HomeKanbanBlock />}
            {mostrarAssistencias && temModulo(config, 'assistencias') && <HomeAssistenciasBlock escopo={config.assistenciasEscopo} />}
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
