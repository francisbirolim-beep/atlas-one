import { supabase } from './supabase'
import { OrigemCliente } from './tipos'

interface DadosCliente {
  nome: string
  whatsapp?: string
  cidade?: string
  origem?: OrigemCliente
  // Campos opcionais extras (usados pelo Orçamento Balcão) — só nome é
  // obrigatório, o resto só é gravado se vier preenchido.
  endereco?: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  bairro?: string
  cep?: string
}

/**
 * Busca um cliente existente pelo WhatsApp. Se não existir, cria um novo.
 * Se existir, atualiza nome/cidade (e os campos extras informados) com os
 * dados mais recentes. Retorna o id do cliente (ou null se não houver
 * WhatsApp nem nome pra identificar).
 */
export async function obterOuCriarCliente(dados: DadosCliente): Promise<string | null> {
  const whatsapp = dados.whatsapp?.trim() || undefined

  const extras: Record<string, string> = {}
  if (dados.endereco?.trim()) extras.endereco = dados.endereco.trim()
  if (dados.cpf_cnpj?.trim()) extras.cpf_cnpj = dados.cpf_cnpj.trim()
  if (dados.email?.trim()) extras.email = dados.email.trim()
  if (dados.telefone?.trim()) extras.telefone = dados.telefone.trim()
  if (dados.bairro?.trim()) extras.bairro = dados.bairro.trim()
  if (dados.cep?.trim()) extras.cep = dados.cep.trim()

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
          ...extras,
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
      ...extras,
    })
    .select('id')
    .single()

  if (error || !novo) {
    console.error('Erro ao criar cliente:', error)
    return null
  }

  return novo.id
}
