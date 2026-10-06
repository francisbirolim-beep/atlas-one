import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type RuntimeGratisChave =
  | 'opencode_gateway'
  | 'whisper_gateway'
  | 'image_gateway'

const ENV_POR_CHAVE: Record<RuntimeGratisChave, string> = {
  opencode_gateway: 'OPENCODE_BASE_URL',
  whisper_gateway: 'WHISPER_BASE_URL',
  image_gateway: 'SD_WEBUI_BASE_URL',
}

export async function endpointRuntimeGratis(chave: RuntimeGratisChave) {
  const envNome = ENV_POR_CHAVE[chave]
  const envValor = String(process.env[envNome] || '').trim().replace(/\/$/, '')
  if (envValor) return { baseUrl: envValor, origem: 'env' as const }

  const { data, error } = await supabaseAdmin
    .from('ai_runtime_endpoints')
    .select('base_url,ativo,updated_at')
    .eq('chave', chave)
    .eq('ativo', true)
    .maybeSingle()

  if (error) return { baseUrl: '', origem: 'erro' as const, erro: error.message }
  return {
    baseUrl: String(data?.base_url || '').trim().replace(/\/$/, ''),
    origem: data?.base_url ? 'registry' as const : 'ausente' as const,
    updatedAt: data?.updated_at || null,
  }
}

export async function statusRuntimesGratis() {
  const [opencode, whisper, image] = await Promise.all([
    endpointRuntimeGratis('opencode_gateway'),
    endpointRuntimeGratis('whisper_gateway'),
    endpointRuntimeGratis('image_gateway'),
  ])

  return {
    politica: 'zero_cost',
    paidProvidersBloqueados: String(process.env.ATLAS_AI_FORCE_ZERO_COST || 'true').toLowerCase() !== 'false',
    runtimes: {
      opencode: { configurado: Boolean(opencode.baseUrl), origem: opencode.origem },
      whisper: { configurado: Boolean(whisper.baseUrl), origem: whisper.origem },
      imagem_local: { configurado: Boolean(image.baseUrl), origem: image.origem },
    },
  }
}
