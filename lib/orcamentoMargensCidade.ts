import { supabase } from '@/lib/supabase'

export function normalizarCidadeMargemCliente(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export async function resolverMargemOrcamentoCliente(cidade: unknown) {
  const cidadeChave = normalizarCidadeMargemCliente(cidade)
  const [padraoResp, regrasResp] = await Promise.all([
    supabase
      .from('configuracoes_precificacao')
      .select('valor')
      .eq('chave', 'margem_padrao_orcamento')
      .maybeSingle(),
    cidadeChave
      ? supabase
          .from('orcamento_margens_cidade')
          .select('id,cidade,uf,margem_pct')
          .eq('cidade_chave', cidadeChave)
          .eq('vigente', true)
          .limit(5)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  const padraoValor = Number(padraoResp.data?.valor)
  const padrao = Number.isFinite(padraoValor) && padraoValor >= 0 ? padraoValor : 40
  const regras = regrasResp.data || []
  const regra = regras.length === 1 ? regras[0] : null

  if (!regra) {
    return { margem: padrao, origem: 'sistema' as const, regraId: null as string | null }
  }
  return {
    margem: Number(regra.margem_pct) || 0,
    origem: 'cidade' as const,
    regraId: String(regra.id),
  }
}