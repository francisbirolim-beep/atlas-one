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
import MedicaoExternalAccessPanel from '@/components/system/MedicaoExternalAccessPanel'
import MedicaoVistaInternaAviso from '@/components/system/MedicaoVistaInternaAviso'
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
  const medicaoFinalId = medicaoIdDaRota(pathname)

  return (
    <div className="atlas-app-shell min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 md:flex">
      <div className="atlas-sidebar-shell contents md:block [&>nav]:hidden md:[&>nav]:flex">
        <Sidebar />
        <SidebarQuickSearch />
      </div>
      <MobileNavigationControls />
      <div className="atlas-app-content min-w-0 w-full max-w-full flex-1 overflow-x-hidden bg-slate-50 md:h-screen md:overflow-y-auto">
        <AppTopbar />
        <main className={`atlas-app-main atlas-main-surface min-h-[calc(100vh-68px)] w-full max-w-full overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] pb-24 md:pb-0 ${ehHome ? 'atlas-home-v2' : ''}`}>
          {ehHome && <HomeDashboard />}
          <MobileFavorites mostrarAcessoRapido={ehHome} />
          {ehProducao && <ProducaoEtapasBar />}

          {medicaoFinalId && (
            <div key={medicaoFinalId} className="atlas-medicao-tools">
              <MedicaoVistaInternaAviso medicaoId={medicaoFinalId} />
              <MedicaoIdentificationBar medicaoId={medicaoFinalId} />
              <div className="mx-auto grid w-full max-w-6xl gap-3 px-3 pt-3 md:grid-cols-[1.05fr_0.95fr] md:px-4">
                <MedicaoFinalFieldSummary medicaoId={medicaoFinalId} embedded />
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
