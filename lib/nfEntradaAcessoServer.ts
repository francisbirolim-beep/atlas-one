// Acesso operacional à NF: respeita o setor e a ação configurados pelo Master.
// Não concede role Master nem altera outras permissões do Atlas.
import { usuarioPodeAcaoServer } from './acessoUsuarioServer'

type UsuarioNF = { id: string; role?: string | null; empresa_id: string }

export function podeConsultarNF(usuario: UsuarioNF) {
  return usuarioPodeAcaoServer({
    usuarioId: usuario.id, role: usuario.role || 'funcionario', empresaId: usuario.empresa_id,
    setorId: 'compras', acaoId: 'compras.notas.consultar', minimo: 'consulta',
  })
}

export function podeLancarNF(usuario: UsuarioNF) {
  return usuarioPodeAcaoServer({
    usuarioId: usuario.id, role: usuario.role || 'funcionario', empresaId: usuario.empresa_id,
    setorId: 'compras', acaoId: 'compras.notas.lancar', minimo: 'edicao',
  })
}
