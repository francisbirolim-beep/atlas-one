// Atlas AI Core - carrega a configuracao do agente de IA (provider/modelo/limites)
// Busca em agentes_ia (tabela nova). Se nao existir configuracao cadastrada,
// cai no comportamento padrao que o sistema sempre teve (100% compativel).

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
    provider: 'anthropic',
    modelo: 'claude-sonnet-5',
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
