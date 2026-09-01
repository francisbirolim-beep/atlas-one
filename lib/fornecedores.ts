import { supabase } from './supabase'
import { Fornecedor } from './tipos'

export async function listarFornecedores(somenteAtivos = false): Promise<Fornecedor[]> {
  let query = supabase.from('fornecedores').select('*').order('nome')
  if (somenteAtivos) query = query.eq('ativo', true)
  const { data } = await query
  return (data as Fornecedor[]) || []
}

export async function criarFornecedor(dados: {
  nome: string
  cnpj_cpf?: string | null
  contato?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
  observacoes?: string | null
  pedido_minimo?: number | null
  prazo_entrega_dias?: number | null
  criado_por_id?: string | null
  criado_por_nome?: string | null
}) {
  return supabase.from('fornecedores').insert({ ...dados, ativo: true })
}

export async function atualizarFornecedor(
  id: string,
  dados: Partial<{
    nome: string
    cnpj_cpf: string | null
    contato: string | null
    telefone: string | null
    email: string | null
    endereco: string | null
    cidade: string | null
    observacoes: string | null
    pedido_minimo: number | null
    prazo_entrega_dias: number | null
    ativo: boolean
  }>
) {
  return supabase.from('fornecedores').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function alternarAtivoFornecedor(id: string, ativo: boolean) {
  return supabase.from('fornecedores').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function excluirFornecedor(id: string) {
  return supabase.from('fornecedores').delete().eq('id', id)
}
