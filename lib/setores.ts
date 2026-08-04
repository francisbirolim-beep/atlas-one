import { supabase } from './supabase'
import { Setor, Permissao, NivelPermissao, Usuario } from './tipos'

export const GRUPOS_ORDEM = [
  'Comercial',
  'Técnico',
  'Operações',
  'Administrativo',
  'Relacionamento',
  'Conhecimento',
  'Sistema',
] as const

export async function listarSetores(): Promise<Setor[]> {
  const { data } = await supabase.from('setores').select('*').order('grupo').order('ordem')
  return (data as Setor[]) || []
}

export async function listarPermissoesUsuario(usuarioId: string): Promise<Record<string, NivelPermissao>> {
  const { data } = await supabase
    .from('permissoes')
    .select('setor_id, nivel')
    .eq('usuario_id', usuarioId)
  const mapa: Record<string, NivelPermissao> = {}
  ;(data as Permissao[] | null)?.forEach(p => {
    mapa[p.setor_id] = p.nivel
  })
  return mapa
}

export async function salvarPermissoesUsuario(usuarioId: string, permissoes: Record<string, NivelPermissao>) {
  const linhas = Object.entries(permissoes).map(([setor_id, nivel]) => ({
    usuario_id: usuarioId,
    setor_id,
    nivel,
    updated_at: new Date().toISOString(),
  }))
  if (linhas.length === 0) return { error: null }
  return supabase.from('permissoes').upsert(linhas, { onConflict: 'usuario_id,setor_id' })
}

// Master sempre tem acesso total. Funcionário depende do mapa de permissões
// (setor sem registro = oculto, por padrão).
export function nivelEfetivo(
  usuario: Usuario | null,
  setorId: string,
  permissoes: Record<string, NivelPermissao>
): NivelPermissao {
  if (usuario?.role === 'master') return 'edicao'
  return permissoes[setorId] || 'oculto'
}

export function agruparSetores(setores: Setor[]): Record<string, Setor[]> {
  const grupos: Record<string, Setor[]> = {}
  setores.forEach(s => {
    if (!grupos[s.grupo]) grupos[s.grupo] = []
    grupos[s.grupo].push(s)
  })
  return grupos
}

export function listarGruposComItens(setores: Setor[]): string[] {
  const grupos = agruparSetores(setores)
  const nomes = Object.keys(grupos).filter(g => grupos[g].length > 0)
  const conhecidos = GRUPOS_ORDEM.filter(g => nomes.includes(g))
  const novos = nomes.filter(g => !(GRUPOS_ORDEM as readonly string[]).includes(g)).sort((a, b) => a.localeCompare(b))
  return [...conhecidos, ...novos]
}

// Edita so os campos de dados do setor (nome, grupo, ordem, descricao).
// Nao mexe em "ativo" nem "rota": esses dois so fazem sentido quando a
// funcionalidade real do setor ja foi programada e ligada.
export async function atualizarSetor(
  id: string,
  dados: { nome: string; grupo: string; ordem: number; descricao: string | null }
) {
  return supabase.from('setores').update(dados).eq('id', id)
}

// Cria um novo setor "pendente de desenvolvimento": so nome, grupo, ordem e
// descricao. Fica marcado como nao ativo (sem rota) ate a funcionalidade
// real ser programada e ligada por um desenvolvedor.
export async function criarSetor(
  nome: string,
  grupo: string,
  ordem: number,
  descricao: string | null
) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const id = `${slug || 'setor'}-${Date.now().toString(36)}`
  return supabase.from('setores').insert({
    id,
    nome,
    grupo,
    ordem,
    ativo: false,
    rota: null,
    descricao,
  })
}


// Exclui um setor definitivamente. Remove tambem as permissoes cadastradas
// para esse setor (senao ficam registros orfaos apontando pra um setor que
// nao existe mais).
export async function excluirSetor(id: string) {
  await supabase.from('permissoes').delete().eq('setor_id', id)
  return supabase.from('setores').delete().eq('id', id)
}
