import { NextRequest, NextResponse } from 'next/server'
import { formatarCep, normalizarRua, normalizarTextoEndereco, type CepEnderecoViaCep } from '@/lib/geocodificacaoCep'

export const dynamic = 'force-dynamic'

/** Lista candidatos postais existentes da mesma rua, sem adivinhar números ou faixas. */
export async function GET(request: NextRequest) {
  const uf = (request.nextUrl.searchParams.get('uf') || '').trim().toUpperCase()
  const cidade = (request.nextUrl.searchParams.get('cidade') || '').trim()
  const rua = (request.nextUrl.searchParams.get('rua') || '').trim()
  if (!/^[A-Z]{2}$/.test(uf) || cidade.length < 3 || rua.length < 3) {
    return NextResponse.json({ error: 'Informe UF, cidade e rua para consultar os CEPs.' }, { status: 400 })
  }
  try {
    const url = 'https://viacep.com.br/ws/' + [uf, cidade, rua].map(encodeURIComponent).join('/') + '/json/'
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 3600 },
    })
    if (!response.ok) throw Error('A base postal não respondeu.')
    const dados: unknown = await response.json()
    if (!Array.isArray(dados)) return NextResponse.json({ itens: [] })
    const vistos = new Set<string>()
    const itens = (dados as CepEnderecoViaCep[]).flatMap(item => {
      const cep = formatarCep(item.cep || '')
      if (!cep || item.erro ||
        normalizarTextoEndereco(item.localidade || '') !== normalizarTextoEndereco(cidade) ||
        normalizarTextoEndereco(item.uf || '') !== normalizarTextoEndereco(uf) ||
        normalizarRua(item.logradouro || '') !== normalizarRua(rua)) return []
      const bairro = (item.bairro || '').trim()
      const trecho = (item.complemento || '').trim()
      const chave = cep + '|' + bairro + '|' + trecho
      if (vistos.has(chave)) return []
      vistos.add(chave)
      return [{ cep, rua: item.logradouro || rua, bairro, trecho }]
    })
    return NextResponse.json({
      itens,
      aviso: dados.length >= 50 ? 'A pesquisa pode estar incompleta: refine a rua para conferir todos os CEPs.' : '',
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar os CEPs da rua agora.' }, { status: 502 })
  }
}
