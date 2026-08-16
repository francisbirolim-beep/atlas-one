import { supabase } from './supabase'

export interface ConfiguracaoPrecificacao {
  id: string
  chave: string
  valor: number | null
  updated_at?: string
}

export async function lerConfiguracao(chave: string): Promise<number | null> {
  const { data } = await supabase
    .from('configuracoes_precificacao')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle()
  return data ? (data as { valor: number | null }).valor : null
}

export async function salvarConfiguracao(chave: string, valor: number) {
  return supabase
    .from('configuracoes_precificacao')
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
}

export async function lerPrecoKgAluminio(): Promise<number> {
  const valor = await lerConfiguracao('preco_kg_aluminio')
  return valor ?? 0
}

export async function salvarPrecoKgAluminio(valor: number) {
  return salvarConfiguracao('preco_kg_aluminio', valor)
}

export async function lerCustoPinturaKg(): Promise<number> {
  const valor = await lerConfiguracao('custo_pintura_kg')
  return valor ?? 0
}

export async function salvarCustoPinturaKg(valor: number) {
  return salvarConfiguracao('custo_pintura_kg', valor)
}
