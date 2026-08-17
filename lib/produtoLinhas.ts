import { supabase } from './supabase'
import { Linha } from './tipos'

// CRUD do vinculo N:N produto <-> linha (tabela produto_linhas).
// produtos.linha_id (FK simples, usada hoje no formulario de Cadastro > Produtos)
// continua funcionando sem alteracao -- este arquivo e' aditivo, para o caso
// de um perfil/acessorio pertencer a mais de uma linha (ex.: RPCS100 usado em
// Suprema e em Gold). A UI de gestao ainda nao usa isto (ver NEXT_TASK.md).

export interface ProdutoLinha {
  id: string
  produto_id: string
  linha_id: string
  principal: boolean
  origem: string | null
  created_at: string
}

export async function listarLinhasDoProduto(produtoId: string): Promise<(ProdutoLinha & { linha: Linha | null })[]> {
  const { data } = await supabase
    .from('produto_linhas')
    .select('*, linha:linhas(*)')
    .eq('produto_id', produtoId)
    .order('principal', { ascending: false })
  return (data as any) || []
}

export async function vincularLinha(produtoId: string, linhaId: string, opcoes?: { principal?: boolean; origem?: string }) {
  return supabase.from('produto_linhas').insert({
    produto_id: produtoId,
    linha_id: linhaId,
    principal: opcoes?.principal ?? false,
    origem: opcoes?.origem ?? 'manual',
  })
}

export async function desvincularLinha(produtoId: string, linhaId: string) {
  return supabase.from('produto_linhas').delete().eq('produto_id', produtoId).eq('linha_id', linhaId)
}

export async function marcarLinhaPrincipal(produtoId: string, linhaId: string) {
  await supabase.from('produto_linhas').update({ principal: false }).eq('produto_id', produtoId)
  return supabase.from('produto_linhas').update({ principal: true }).eq('produto_id', produtoId).eq('linha_id', linhaId)
}
