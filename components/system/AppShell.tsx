'use client'

import type { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import AppTopbar from '@/components/system/AppTopbar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">
        <AppTopbar />
        <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  )
}
