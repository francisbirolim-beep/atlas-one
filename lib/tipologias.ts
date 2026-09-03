import { supabase } from './supabase'
import { CategoriaTipologia, Tipologia } from './tipos'
import { registrarEventoAprendizadoAtlas } from './ai/aprendizadoAtlas'

export type TipologiaTecnica = Tipologia & { ativo: boolean }

export async function listarTipologias(incluirInativas = false): Promise<TipologiaTecnica[]> {
  let query = supabase
    .from('tipologias')
    .select('*')
    .order('ordem', { ascending: true })

  if (!incluirInativas) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error || !data) return []
  return data as TipologiaTecnica[]
}

function slugTipologia(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function criarTipologia(label: string, categoria: CategoriaTipologia): Promise<TipologiaTecnica | null> {
  const chave = slugTipologia(label) || ('tipologia_' + Date.now())

  const { data: maiorOrdem } = await supabase
    .from('tipologias')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const ordem = (maiorOrdem?.ordem ?? 0) + 1

  const { data, error } = await supabase
    .from('tipologias')
    .insert({ chave, label: label.trim(), categoria, ordem, ativo: true })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar tipologia:', error)
    return null
  }

  registrarEventoAprendizadoAtlas({
    dominio: 'tipologia',
    tipo: 'tipologia_criada',
    entidade_tipo: 'tipologia',
    entidade_id: data.id,
    contexto: { categoria },
    dados: { chave, label: label.trim(), ordem },
    evidencia: 'observado',
  }).catch(() => {})

  return data as TipologiaTecnica
}

export async function alternarTipologiaTecnica(id: string, ativo: boolean) {
  const resposta = await supabase
    .from('tipologias')
    .update({ ativo })
    .eq('id', id)

  if (!resposta.error) {
    registrarEventoAprendizadoAtlas({
      dominio: 'tipologia',
      tipo: ativo ? 'tipologia_ativada' : 'tipologia_inativada',
      entidade_tipo: 'tipologia',
      entidade_id: id,
      contexto: { tipologia_id: id },
      dados: { ativo },
      evidencia: 'observado',
    }).catch(() => {})
  }

  return resposta
}
