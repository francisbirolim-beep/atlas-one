import { lerAcessoConfigServer } from '@/lib/acessoUsuarioServer'

export type PainelConsolidado = 'visao-geral-projetos' | 'relatorios-instalacoes'

const CHAVES: Record<PainelConsolidado,string> = {
  'visao-geral-projetos': 'painel_visao_geral_projetos',
  'relatorios-instalacoes': 'painel_relatorio_instalacoes',
}

// Sem herança de permissões de outros módulos: é uma autorização explícita do Master.
// Falhas ao ler ACL nunca liberam dados; são propagadas aos handlers.
export async function podeConsultarPainelGeral(
  usuario: { id:string; role:string; empresa_id:string },
  painel: PainelConsolidado,
): Promise<boolean> {
  if (usuario.role === 'master') return true
  const config = await lerAcessoConfigServer(usuario.id,usuario.empresa_id)
  const nivel = config?.acoes?.[CHAVES[painel]]
  return nivel === 'consulta' || nivel === 'edicao'
}
