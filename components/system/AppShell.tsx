'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { medicaoIdDaRota } from '@/lib/medicaoRota'
import Sidebar from '@/components/Sidebar'
import SidebarQuickSearch from '@/components/system/SidebarQuickSearch'
import AppTopbar from '@/components/system/AppTopbar'
import HomeDashboard from '@/components/system/HomeDashboard'
import MobileFavorites from '@/components/system/MobileFavorites'
import MobileNavigationControls from '@/components/system/MobileNavigationControls'
import MedicaoIdentificationBar from '@/components/system/MedicaoIdentificationBar'
import MedicaoFinalFieldSummary from '@/components/system/MedicaoFinalFieldSummary'
import MedicaoPecasPanel from '@/components/system/MedicaoPecasPanel'
import MedicaoParcialPanel from '@/components/system/MedicaoParcialPanel'
import MedicaoExternalAccessPanel from '@/components/system/MedicaoExternalAccessPanel'
import ProducaoEtapasBar from '@/components/system/ProducaoEtapasBar'

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const ehHome = pathname === '/'
  const ehKanbanComercial = pathname.startsWith('/kanban')
  const ehOrcamentos = pathname === '/orcamento' || pathname.startsWith('/orcamento/pesquisar')
  const ehProducao = pathname === '/producao'
  const ehPlanoCorte = pathname.startsWith('/producao/plano-corte')
  const ehEngenharia = pathname.startsWith('/engenharia')
  const ehSetorGenerico = pathname.startsWith('/setor/')
  const ehMedicaoFinal = pathname.startsWith('/producao/medicao-final')
  const ehQuadroMedicaoFinal = pathname === '/producao/medicao-final'
  const ehWhatsAppAtendimento = pathname === '/whatsapp'
  const medicaoFinalId = medicaoIdDaRota(pathname)

  return (
    <div className="atlas-app-shell min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 md:flex">
      {!ehWhatsAppAtendimento && (
        <div className="atlas-sidebar-shell contents md:block [&>nav]:hidden md:[&>nav]:flex">
          <Sidebar />
          <SidebarQuickSearch />
        </div>
      )}
      {!ehWhatsAppAtendimento && <MobileNavigationControls />}
      <div className={`atlas-app-content min-w-0 w-full max-w-full flex-1 overflow-x-hidden ${ehWhatsAppAtendimento ? 'h-screen bg-white overflow-hidden' : 'bg-slate-50 md:h-screen md:overflow-y-auto'}`}>
        {!ehWhatsAppAtendimento && <AppTopbar />}
        <main className={`atlas-app-main atlas-main-surface w-full max-w-full overflow-x-hidden ${ehWhatsAppAtendimento ? 'min-h-screen bg-white pb-0' : 'min-h-[calc(100vh-68px)] bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] pb-24 md:pb-0'} ${ehHome ? 'atlas-home-v2' : ''}`}>
          {ehHome && <HomeDashboard />}
          {!ehWhatsAppAtendimento && <MobileFavorites mostrarAcessoRapido={ehHome} />}
          {ehProducao && <ProducaoEtapasBar />}

          {medicaoFinalId && (
            <div key={medicaoFinalId} className="atlas-medicao-tools">
              <section className="mx-auto w-full max-w-6xl px-3 pt-4 md:px-4">
                <p className="text-xs font-medium text-slate-400">Produção <span className="px-1">›</span> Medição Final <span className="px-1">›</span> Obra</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Medição Final</h1>
              </section>
              <MedicaoIdentificationBar medicaoId={medicaoFinalId} />
              <div className="mx-auto grid w-full max-w-6xl atlas-medicao-overview gap-3 px-3 pt-3 lg:grid-cols-3 md:px-4">
                <MedicaoFinalFieldSummary medicaoId={medicaoFinalId} embedded />
                <MedicaoParcialPanel medicaoId={medicaoFinalId} modo="controle" embedded />
                <MedicaoExternalAccessPanel medicaoId={medicaoFinalId} embedded />
              </div>
              <MedicaoPecasPanel key={medicaoFinalId} medicaoId={medicaoFinalId} />
            </div>
          )}

          {!ehHome && (
            <div
              className={
                ehMedicaoFinal
                  ? ehQuadroMedicaoFinal
                    ? 'atlas-medicao-final atlas-medicao-final-board'
                    : 'atlas-medicao-final atlas-medicao-final-detail'
                  : ehKanbanComercial
                    ? 'atlas-kanban-commercial'
                    : ehOrcamentos
                      ? 'atlas-orcamentos-professional'
                      : ehProducao || ehPlanoCorte
                        ? 'atlas-producao-professional'
                        : ehEngenharia
                          ? 'atlas-engenharia-professional'
                          : ehSetorGenerico
                            ? 'atlas-setor-professional'
                            : undefined
              }
            >
              {medicaoFinalId ? null : children}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
