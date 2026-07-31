import { supabase } from './supabase'
import { OrigemCliente } from './tipos'

interface DadosCliente {
  nome: string
  whatsapp?: string
  cidade?: string
  origem?: OrigemCliente
}

/**
 * Busca um cliente existente pelo WhatsApp. Se não existir, cria um novo.
 * Se existir, atualiza nome/cidade com os dados mais recentes informados.
 * Retorna o id do cliente (ou null se não houver WhatsApp nem nome pra identificar).
 */
export async function obterOuCriarCliente(dados: DadosCliente): Promise<string | null> {
  const whatsapp = dados.whatsapp?.trim() || undefined

  if (whatsapp) {
    const { data: existente } = await supabase
      .from('clientes')
      .select('id')
      .eq('whatsapp', whatsapp)
      .maybeSingle()

    if (existente) {
      await supabase
        .from('clientes')
        .update({
          nome: dados.nome,
          cidade: dados.cidade || undefined,
        })
        .eq('id', existente.id)
      return existente.id
    }
  }

  if (!dados.nome.trim()) return null

  const { data: novo, error } = await supabase
    .from('clientes')
    .insert({
      nome: dados.nome,
      whatsapp,
      cidade: dados.cidade || null,
      origem: dados.origem || 'outros',
    })
    .select('id')
    .single()

  if (error || !novo) {
    console.error('Erro ao criar cliente:', error)
    return null
  }

  return novo.id
}
