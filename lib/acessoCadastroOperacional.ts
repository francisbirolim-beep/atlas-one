import type { Usuario, NivelPermissao } from './tipos'
import { listarPermissoesUsuario } from './setores'
import { lerCadastrosUsuarioConfig, temPermissaoCadastro360, type CadastrosUsuarioConfig, type Cadastro360Id, type Cadastro360Acao } from './cadastrosUsuario'

type UsuarioCadastro = Pick<Usuario, 'id' | 'role'>
export type ContextoCadastro = {
  usuario: UsuarioCadastro | null
  nivel: NivelPermissao
  config: CadastrosUsuarioConfig | null
}

export async function carregarAcessoCadastro(usuario: UsuarioCadastro | null): Promise<ContextoCadastro> {
  if (!usuario) return { usuario: null, nivel: 'oculto', config: null }
  if (usuario.role === 'master') return { usuario, nivel: 'edicao', config: null }
  // O setor Cadastro controla o acesso operacional. A matriz 360 restringe cada card/ação.
  // Não converter uma permissão genérica em privilégios de administrador.
  try {
    const [setores, config] = await Promise.all([
      listarPermissoesUsuario(usuario.id),
      lerCadastrosUsuarioConfig(usuario),
    ])
    return { usuario, nivel: setores.cadastro || 'oculto', config }
  } catch {
    return { usuario, nivel: 'oculto', config: null }
  }
}

export function podeAcaoCadastro(contexto: ContextoCadastro, id: Cadastro360Id, acao: Cadastro360Acao = 'ver'): boolean {
  if (!contexto.usuario) return false
  if (contexto.usuario.role === 'master') return true
  // Cadastro legado contém usuários, backups e administração: reservado ao Master.
  if (id === 'avancados' || id === 'historico' || id === 'campos' || contexto.nivel === 'oculto') return false
  if (acao !== 'ver' && contexto.nivel !== 'edicao') return false
  return temPermissaoCadastro360(contexto.usuario, contexto.config, id, acao)
}
