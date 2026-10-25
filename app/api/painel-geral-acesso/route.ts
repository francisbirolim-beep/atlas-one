import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { podeConsultarPainelGeral } from '@/lib/painelGeralAcessoServer'

export const dynamic = 'force-dynamic'

export async function GET(req:NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ erro:'Sessão inválida' },{ status:401 })
    const [visaoGeral,relatorioInstalacoes] = await Promise.all([
      podeConsultarPainelGeral(usuario,'visao-geral-projetos'),
      podeConsultarPainelGeral(usuario,'relatorios-instalacoes'),
    ])
    return NextResponse.json({ visaoGeral,relatorioInstalacoes },{ headers:{'Cache-Control':'no-store'} })
  } catch {
    return NextResponse.json({ erro:'Não foi possível conferir o acesso.' },{ status:503 })
  }
}
