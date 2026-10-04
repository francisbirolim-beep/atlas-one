import { supabaseAdmin } from '@/lib/supabaseAdmin'

export function normalizarCidadeMargem(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export async function margemPadraoEmpresa(empresaId: string) {
  const { data, error } = await supabaseAdmin
    .from('configuracoes_precificacao')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('chave', 'margem_padrao_orcamento')
    .maybeSingle()
  if (error) throw error
  const valor = Number(data?.valor)
  return Number.isFinite(valor) && valor >= 0 ? valor : 40
}

export async function resolverMargemOrcamentoPorCidade(
  empresaId: string,
  cidade: unknown,
  uf?: unknown,
) {
  const padrao = await margemPadraoEmpresa(empresaId)
  const cidadeChave = normalizarCidadeMargem(cidade)
  if (!cidadeChave) {
    return { margem: padrao, origem: 'sistema' as const, regraId: null as string | null, cidade: null, uf: null }
  }

  let query = supabaseAdmin
    .from('orcamento_margens_cidade')
    .select('id,cidade,cidade_chave,uf,margem_pct,versao')
    .eq('empresa_id', empresaId)
    .eq('cidade_chave', cidadeChave)
    .eq('vigente', true)
    .order('versao', { ascending: false })

  const ufNormalizada = String(uf ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(ufNormalizada)) query = query.eq('uf', ufNormalizada)

  const { data, error } = await query.limit(5)
  if (error) throw error

  const regras = data || []
  // Sem UF no dado de origem, só aplica automaticamente se a cidade tiver uma única regra vigente.
  const regra = ufNormalizada ? regras[0] : (regras.length === 1 ? regras[0] : null)
  if (!regra) {
    return { margem: padrao, origem: 'sistema' as const, regraId: null as string | null, cidade: cidadeChave, uf: null }
  }

  return {
    margem: Number(regra.margem_pct) || 0,
    origem: 'cidade' as const,
    regraId: String(regra.id),
    cidade: String(regra.cidade),
    uf: String(regra.uf),
  }
}