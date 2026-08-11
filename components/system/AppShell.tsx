'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import AppTopbar from '@/components/system/AppTopbar'
import HomeManagementOverview from '@/components/system/HomeManagementOverview'

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const ehHome = pathname === '/'

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">
        <AppTopbar />
        <main
          className={`min-h-[calc(100vh-4rem)] bg-slate-50/80 pb-20 md:pb-0 ${
            ehHome ? '[&>div>header]:hidden' : ''
          }`}
        >
          {ehHome && <HomeManagementOverview />}
          {children}
        </main>
      </div>
    </div>
  )
}
