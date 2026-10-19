import type { ItemEsquadria } from './tipos'
import { diferencasItemWVetro, statusItemWVetro } from './wvetroValidacaoItem'

// Salvar uma ficha incompleta não é o mesmo que validar a receita técnica.
// Só alterações técnicas deshomologam a configuração; as validações antigas
// e o payload original permanecem registrados para auditoria.
const CAMPOS_TECNICOS = new Set([
  'tipo_esquadria', 'tipo_outro_texto', 'linha_nome', 'configuracao_nome',
  'variaveis', 'folhas', 'largura_mm', 'altura_mm', 'largura_baixo_mm',
  'largura_meio_mm', 'largura_cima_mm', 'altura_direita_mm',
  'altura_meio_mm', 'altura_esquerda_mm',
])

export function prepararRascunhoWVetro(
  originais: ItemEsquadria[],
  editados: ItemEsquadria[],
  fluxo: Record<string, any>,
) {
  const porId = new Map(originais.map(item => [item.id, item]))
  const itens = editados.map(item => {
    const anterior = porId.get(item.id)
    if (!anterior) return item
    const mudancas = diferencasItemWVetro(anterior, item)
    if (!Object.keys(mudancas).some(campo => CAMPOS_TECNICOS.has(campo))) return item
    return {
      ...item,
      configuracao_preset_id: null,
      configuracao_validada: false,
      configuracao_status: 'pendente' as const,
      ...(mudancas.linha_nome ? { linha_id: null } : {}),
    }
  })

  const todosValidados = itens.length > 0 &&
    itens.every(item => statusItemWVetro(item, fluxo) !== 'pendente')
  return {
    itens,
    fluxo: fluxo.validacao_por_item
      ? { ...fluxo, validacao_status: todosValidados ? 'validado' : 'aguardando' }
      : fluxo,
  }
}
