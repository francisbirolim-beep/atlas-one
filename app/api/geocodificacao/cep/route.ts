import { NextRequest, NextResponse } from 'next/server'
import { formatarCep, type CepEnderecoViaCep } from '@/lib/geocodificacaoCep'

export const dynamic = 'force-dynamic'

type BrasilApiCep = {
  cep?: string; state?: string; city?: string; neighborhood?: string; street?: string
}

export async function GET(request: NextRequest) {
  const cep = formatarCep(request.nextUrl.searchParams.get('cep') || '')
  if (!cep) return NextResponse.json({ error: 'Informe um CEP com oito dígitos.' }, { status: 400 })
  const digitos = cep.replace(/\D/g, '')

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
      next: { revalidate: 3600 },
    })
    if (resposta.ok) {
      const dados = await resposta.json() as CepEnderecoViaCep
      if (dados.erro || !formatarCep(dados.cep || '')) {
        // CEP declarado inexistente pelo ViaCEP: não aceitar um registro genérico
        // de outro fornecedor como se fosse o CEP exato da rua.
        return NextResponse.json({ error: 'CEP não encontrado na base postal. Confira os oito dígitos.' }, { status: 404 })
      }
      return NextResponse.json({
        cep: formatarCep(dados.cep || ''), rua: dados.logradouro || '',
        bairro: dados.bairro || '', cidade: dados.localidade || '',
        uf: dados.uf || '', origem: 'viacep',
      })
    }
    if (resposta.status === 400 || resposta.status === 404) {
      return NextResponse.json({ error: 'CEP não encontrado na base postal.' }, { status: 404 })
    }
  } catch { /* apenas indisponibilidade da base principal permite contingência */ }

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v1/${digitos}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
      next: { revalidate: 3600 },
    })
    if (resposta.ok) {
      const dados = await resposta.json() as BrasilApiCep
      if (formatarCep(dados.cep || '')) {
        return NextResponse.json({
          cep: formatarCep(dados.cep || ''), rua: dados.street || '',
          bairro: dados.neighborhood || '', cidade: dados.city || '',
          uf: dados.state || '', origem: 'brasilapi',
        })
      }
    }
  } catch { /* serviço indisponível */ }

  return NextResponse.json({
    error: 'CEP não encontrado nas bases consultadas. Confira os oito dígitos.',
  }, { status: 404 })
}
