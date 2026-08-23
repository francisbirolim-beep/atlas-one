import type { NFeNormalizada } from '@/lib/nfeEntradaServer'
import { lerPdfDanfeV6 } from '@/lib/danfePdfParserV6'

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function cnpjDaChave(chave: string) {
  const d = somenteDigitos(chave)
  return d.length === 44 ? d.slice(6, 20) : ''
}

export async function lerPdfDanfeV7(buffer: Buffer): Promise<NFeNormalizada> {
  const nf = await lerPdfDanfeV6(buffer)
  const cnpjFiscal = cnpjDaChave(nf.chaveAcesso || '')
  return {
    ...nf,
    fornecedorCnpj: cnpjFiscal || nf.fornecedorCnpj,
    diagnostico: `${nf.diagnostico || ''}; parser v7 cnpjChave=${Boolean(cnpjFiscal)}`.replace(/^;\s*/, ''),
  }
}
