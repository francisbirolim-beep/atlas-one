'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import AppTopbar from '@/components/system/AppTopbar'
import HomeManagementOverview from '@/components/system/HomeManagementOverview'
import HomeOperationalAttention from '@/components/system/HomeOperationalAttention'
import MedicaoFinalFieldSummary from '@/components/system/MedicaoFinalFieldSummary'
import MedicaoChecklistV2Panel from '@/components/system/MedicaoChecklistV2Panel'

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const ehHome = pathname === '/'
  const ehMedicaoFinal = pathname.startsWith('/producao/medicao-final')
  const ehQuadroMedicaoFinal = pathname === '/producao/medicao-final'
  const medicaoFinalId = ehMedicaoFinal && !ehQuadroMedicaoFinal
    ? pathname.replace('/producao/medicao-final/', '').split('/')[0]
    : ''

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">
        <AppTopbar />
        <main
          className={`min-h-[calc(100vh-4rem)] bg-slate-50/80 pb-20 md:pb-0 ${
            ehHome
              ? '[&>div>header]:hidden [&>div]:mx-auto [&>div]:max-w-7xl [&>div]:!min-h-0 [&>div]:px-4 [&>div]:pb-8 [&>div]:[background-image:none] md:[&>div]:px-6'
              : ''
          }`}
        >
          {ehHome && <HomeManagementOverview />}
          {ehHome && <HomeOperationalAttention />}
          {ehHome && (
            <section className="mx-auto w-full max-w-7xl px-4 pt-7 md:px-6 md:pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Organização pessoal</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Agenda e produtividade</h2>
              <p className="mt-1 text-sm text-slate-500">Tarefas, compromissos e atalhos do seu dia em um único lugar.</p>
            </section>
          )}
          {medicaoFinalId && <MedicaoFinalFieldSummary medicaoId={medicaoFinalId} />}
          {medicaoFinalId && <MedicaoChecklistV2Panel medicaoId={medicaoFinalId} />}
          <div
            className={
              ehMedicaoFinal
                ? ehQuadroMedicaoFinal
                  ? 'atlas-medicao-final atlas-medicao-final-board'
                  : 'atlas-medicao-final atlas-medicao-final-detail'
                : undefined
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
