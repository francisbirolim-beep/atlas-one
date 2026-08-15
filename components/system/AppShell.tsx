'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SidebarQuickSearch from '@/components/system/SidebarQuickSearch'
import AppTopbar from '@/components/system/AppTopbar'
import HomeExecutiveHero from '@/components/system/HomeExecutiveHero'
import HomeManagementOverview from '@/components/system/HomeManagementOverview'
import MobileFavorites from '@/components/system/MobileFavorites'
import MobileNavigationControls from '@/components/system/MobileNavigationControls'
import MedicaoIdentificationBar from '@/components/system/MedicaoIdentificationBar'
import MedicaoFinalFieldSummary from '@/components/system/MedicaoFinalFieldSummary'
import MedicaoChecklistV2Panel from '@/components/system/MedicaoChecklistV2Panel'
import MedicaoExternalAccessPanel from '@/components/system/MedicaoExternalAccessPanel'
import MedicaoVistaInternaAviso from '@/components/system/MedicaoVistaInternaAviso'
import MedicaoParcialPanel from '@/components/system/MedicaoParcialPanel'
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
  const medicaoFinalId = ehMedicaoFinal && !ehQuadroMedicaoFinal
    ? pathname.replace('/producao/medicao-final/', '').split('/')[0]
    : ''

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <div className="atlas-sidebar-shell contents md:block [&>nav]:hidden md:[&>nav]:flex">
        <Sidebar />
        <SidebarQuickSearch />
      </div>
      <MobileNavigationControls />
      <div className="min-w-0 flex-1 bg-slate-50 md:h-screen md:overflow-y-auto">
        <AppTopbar />
        <main className="min-h-[calc(100vh-68px)] bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] pb-24 md:pb-0">
          {ehHome && <HomeExecutiveHero />}
          <MobileFavorites mostrarAcessoRapido={ehHome} />
          {ehHome && <HomeManagementOverview />}
          {ehProducao && <ProducaoEtapasBar />}

          {medicaoFinalId && (
            <div className="atlas-medicao-tools">
              <MedicaoVistaInternaAviso medicaoId={medicaoFinalId} />
              <MedicaoIdentificationBar medicaoId={medicaoFinalId} />
              <MedicaoFinalFieldSummary medicaoId={medicaoFinalId} />
              <MedicaoParcialPanel medicaoId={medicaoFinalId} />
              <MedicaoExternalAccessPanel medicaoId={medicaoFinalId} />
              <MedicaoChecklistV2Panel medicaoId={medicaoFinalId} />
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
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
