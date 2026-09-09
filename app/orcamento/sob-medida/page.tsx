'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrcamentoSobMedidaBuilderV2 from '@/components/orcamento/OrcamentoSobMedidaBuilderV2'
import { tokenAtual } from '@/lib/auth'

export default function OrcamentoSobMedidaPage() {
  const router = useRouter()
  const [criando, setCriando] = useState(false)

  async function continuarParaCustos(event: React.MouseEvent<HTMLDivElement>) {
    if (criando) return
    const alvo = event.target as HTMLElement
    const botao = alvo.closest('button')
    if (!botao || !botao.textContent?.includes('Avançar para configurar tipologias')) return

    window.setTimeout(async () => {
      const bruto = sessionStorage.getItem('atlas_orcamento_sob_medida_builder_v1')
      if (!bruto) return

      setCriando(true)
      try {
        const dados = JSON.parse(bruto)
        const token = await tokenAtual()
        if (!token) {
          window.alert('Sua sessão expirou. Entre novamente no Atlas.')
          return
        }

        const resposta = await fetch('/api/orcamento/sob-medida/criar', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dados),
        })
        const json = await resposta.json()
        if (!resposta.ok || !json.orcamentoId) {
          window.alert(json.error || 'Não foi possível iniciar a conferência de custos.')
          return
        }

        sessionStorage.removeItem('atlas_orcamento_sob_medida_builder_v1')
        router.push(`/orcamento/${json.orcamentoId}/custos`)
      } catch {
        window.alert('Não foi possível iniciar a conferência de custos.')
      } finally {
        setCriando(false)
      }
    }, 0)
  }

  return <div onClick={continuarParaCustos}><OrcamentoSobMedidaBuilderV2 /></div>
}
