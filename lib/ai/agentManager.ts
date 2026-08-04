// Atlas AI Core - carrega a configuracao do agente de IA (provider/modelo/limites)
// Busca em agentes_ia (tabela nova). Se nao existir configuracao cadastrada (ou o
// agente encontrado estiver inativo), cai no agente padrao do sistema - que e
// Ollama local, custo zero. Anthropic (pago) so e usado quando alguem cadastra
// explicitamente um agente com provider: 'anthropic' em Configuracoes. Nunca ha
// fallback automatico de Ollama para um provider pago.

import { supabaseAdmin } from '../supabaseAdmin'
import { ProviderNome } from './providerManager'

export interface ConfigAgente {
  id: string | null
  nome: string
  provider: ProviderNome
  modelo: string
  maxTokens: number
  temperatura: number
}

function padrao(escopo: 'setor' | 'master'): ConfigAgente {
  return {
    id: null,
    nome: escopo === 'master' ? 'Agente padrao (master)' : 'Agente padrao (setor)',
    provider: 'ollama',
    modelo: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1',
    maxTokens: escopo === 'master' ? 16000 : 1024,
    temperatura: 1,
  }
}

export async function carregarConfigAgente(setorId: string | null, escopo: 'setor' | 'master'): Promise<ConfigAgente> {
  try {
    let query = supabaseAdmin.from('agentes_ia').select('*').eq('ativo', true).eq('escopo', escopo)
    if (escopo === 'setor' && setorId) {
      query = query.eq('setor_id', setorId)
    }
    const { data } = await query.limit(1).maybeSingle()
    if (data) {
      return {
        id: data.id,
        nome: data.nome,
        provider: (data.provider || 'anthropic') as ProviderNome,
        modelo: data.modelo || 'claude-sonnet-5',
        maxTokens: escopo === 'master' ? 16000 : 1024,
        temperatura: data.temperatura ?? 1,
      }
    }
  } catch {
    // se a tabela ainda nao existir ou der qualquer erro, usa o padrao
  }
  return padrao(escopo)
}
