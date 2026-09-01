import type { ReactNode } from 'react'
import ConfiguracoesNav from '@/components/configuracoes/ConfiguracoesNav'

export default function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ConfiguracoesNav />
      {children}
    </>
  )
}
