import { supabase } from './supabase'

export type TipoFotoMedicao = 'larguras' | 'alturas'

export async function salvarFotoMedicaoItem(
  itemId: string,
  tipo: TipoFotoMedicao,
  url: string
): Promise<boolean> {
  const campo = tipo === 'larguras' ? 'foto_larguras_url' : 'foto_alturas_url'
  const { error } = await supabase
    .from('medicao_itens')
    .update({ [campo]: url })
    .eq('id', itemId)

  if (error) {
    console.error('Erro ao salvar foto da medição:', error)
    return false
  }
  return true
}

export async function salvarFotoCampoExtraMedicao(
  itemId: string,
  camposExtras: Record<string, string | number>,
): Promise<boolean> {
  const { error } = await supabase
    .from('medicao_itens')
    .update({ campos_extras: camposExtras })
    .eq('id', itemId)

  if (error) {
    console.error('Erro ao salvar foto de checklist da medição:', error)
    return false
  }
  return true
}
