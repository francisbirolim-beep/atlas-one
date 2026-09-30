import type { MedicaoItem } from './tipos'
import type { CampoChecklistV2, RespostaChecklistV2 } from './medicaoChecklistV2'

export function normalizarChecklist(valor: unknown) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ').trim()
}
export function respostaDoCampo(item: MedicaoItem, campo: CampoChecklistV2, respostas: RespostaChecklistV2[]): unknown {
  const resposta = [...respostas].reverse().find(r => r.item_id === item.id && r.campo_chave === campo.chave)
  return resposta?.valor ?? item.campos_extras?.[campo.chave]
}
export function referenciaDaTipologia(item: MedicaoItem) {
  return /mosquiteiro|portinhola|alcapao/.test(normalizarChecklist(`${item.tipo_esquadria} ${item.descricao}`)) ? 'externa' : 'interna'
}
export function camposAplicaveis(campos: CampoChecklistV2[], item: MedicaoItem, respostas: RespostaChecklistV2[] = []): CampoChecklistV2[] {
  const tipo = normalizarChecklist(`${item.tipo_esquadria} ${item.descricao || ''} ${item.tipo_outro_texto || ''}`)
  const base: CampoChecklistV2[] = []
  const add = (chave: string, nome: string, tipo_valor: CampoChecklistV2['tipo_valor'] = 'texto', opcoes: string[] = [], obrigatorio = true) => {
    base.push({ id: '', tipo_esquadria: item.tipo_esquadria, chave, nome, tipo_valor, opcoes, obrigatorio, ordem: base.length, secao: 'Conferência em campo', regra_condicional: {}, exigir_foto_quando: [], ativo: true })
  }
  const simNao = ['sim', 'nao']
  add('foto_vao', 'Foto do vão / local', 'foto')
  add('observacao_medicao', 'Observações', 'texto', [], false)
  if (/correr/.test(tipo)) {
    add('padrao_contramarco', 'Contramarco', 'texto', simNao)
    add('padrao_cadeirinha', 'Cadeirinha', 'texto', simNao)
    const contramarco = respostaDoCampo(item, base.find(c => c.chave === 'padrao_contramarco')!, respostas)
    if (normalizarChecklist(contramarco) === 'sim' && /janela/.test(tipo)) add('guarnicao', 'Guarnição obrigatória', 'texto', ['sim'])
    if (/porta/.test(tipo)) { add('trilho', 'Trilho', 'texto', ['Convencional', 'Embutido']); add('pedra_riscada', 'Pedra riscada', 'texto', simNao) }
  }
  if (/giro|pivotante|porta abrir|porta de abrir|lambril|laminada/.test(tipo)) { add('abertura', 'Abre para', 'texto', ['Dentro', 'Fora']); add('lado_fechadura', 'Lado da fechadura (vista interna)', 'texto', ['Direita', 'Esquerda']) }
  if (/janela|veneziana|basculante|persiana.*fita/.test(tipo)) add('peitoril_mm', 'Altura do peitoril (mm)', 'numero')
  if (/basculante/.test(tipo)) add('corrente_mm', 'Comprimento da corrente (mm)', 'numero')
  if (/persiana/.test(tipo) && /automat|motor/.test(tipo)) { add('tensao_motor', 'Tensão do motor', 'texto', ['110 V', '220 V']); add('ponto_energia', 'Ponto de energia', 'texto', simNao); add('lado_motor', 'Lado do motor (vista interna)', 'texto', ['Direita', 'Esquerda']) }
  if (/domus|claraboia/.test(tipo)) add('ventilacao', 'Ventilação', 'texto', simNao)
  if (/ripado/.test(tipo)) add('fixacao', 'Fixação', 'texto', ['Alvenaria', 'Estrutura', 'Perfil'])
  if (/pele de vidro|fachada/.test(tipo)) { add('colunas', 'Número de colunas', 'numero'); add('divisoes', 'Número de divisões', 'numero') }
  if (/kit.*porta|porta pronta/.test(tipo)) add('parede_guarnicao_mm', 'Largura da parede / guarnição (mm)', 'numero')
  if (/portinhola|alcapao/.test(tipo)) { add('tipo_portinhola', 'Tipo', 'texto', ['Alçapão', 'Casa de máquina']); add('abertura', 'Abre para', 'texto', ['Dentro', 'Fora']); add('fechadura_tranqueta', 'Fechamento', 'texto', ['Fechadura', 'Tranqueta']) }
  const configurados = campos.filter(c => c.ativo && (c.tipo_esquadria == null || c.tipo_esquadria === item.tipo_esquadria) && (!c.regra_condicional.item_id || c.regra_condicional.item_id === item.id))
  const unicos = new Map(base.map(c => [c.chave, c]))
  for (const campo of configurados) unicos.set(campo.chave, { ...campo, obrigatorio: campo.obrigatorio || base.some(b => b.chave === campo.chave && b.obrigatorio) })
  return [...unicos.values()].filter(c => {
    const regra = c.regra_condicional
    if (typeof regra.campo !== 'string') return true
    const alvo = [...unicos.values()].find(f => f.chave === regra.campo)
    return alvo ? normalizarChecklist(respostaDoCampo(item, alvo, respostas)) === normalizarChecklist(regra.valor) : false
  }).sort((a,b) => a.ordem - b.ordem)
}

export function valorValidoChecklist(campo: CampoChecklistV2, valor: unknown) {
  if (valor == null || String(valor).trim() === '') return false
  if (campo.chave === 'guarnicao') return normalizarChecklist(valor) === 'sim'
  if (campo.tipo_valor === 'numero') return Number.isFinite(Number(valor)) && Number(valor) >= 0
  if (campo.tipo_valor === 'foto') return typeof valor === 'string' && /^https?:\/\//.test(valor)
  return !Array.isArray(valor) || valor.length > 0
}
