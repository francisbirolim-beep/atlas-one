/** Motor declarativo do piloto. Não calcula materiais, custos ou limites técnicos. */
export const CHAVE_CONFIGURADOR = 'configurador_sob_medida_v1'
export const PILOTO = 'porta_correr_2f_v1'
export type Respostas = Record<string, string>
export type Condicao = { campo: string; operador: 'igual' | 'maior_igual' | 'menor_igual'; valor: string }
export type Nivel = 'Recomendação' | 'Alerta forte' | 'Obrigatória' | 'Análise técnica'
export type Regra = {
  id: string; nome: string; evidencia: string; ativa: boolean; nivel: Nivel
  quando: Condicao[]
  acao: 'recomendar_linha' | 'permitir_linha' | 'bloquear_linha' | 'exigir_valor' | 'avisar'
  alvo: string; valor: string
}
export type Pergunta = { chave: string; label: string; opcoes: { valor: string; label: string }[]; quando: Condicao[] }
export type CadastroConfigurador = {
  versao: 1; categorias: { valor: string; label: string }[]
  perguntas: Pergunta[]; regras: Regra[]
}
const igual = (campo: string, valor: string): Condicao => ({ campo, operador: 'igual', valor })
const simNao = [{ valor: 'sim', label: 'Sim' }, { valor: 'nao', label: 'Não' }]
const porta2f = [igual('produto', 'porta'), igual('abertura', 'correr'), igual('folhas', '2')]
export const CADASTRO_INICIAL: CadastroConfigurador = {
  versao: 1,
  categorias: [
    { valor: 'porta', label: 'Porta' }, { valor: 'janela', label: 'Janela' },
    { valor: 'veneziana', label: 'Veneziana' }, { valor: 'painel_ripado', label: 'Painel ripado' },
    { valor: 'modulo_fixo', label: 'Fixo' }, { valor: 'claraboia', label: 'Claraboia' },
    { valor: 'maxim_ar', label: 'Maxim-ar' },
  ],
  perguntas: [
    { chave: 'abertura', label: 'Abertura', quando: [igual('produto', 'porta')], opcoes: [
      { valor: 'correr', label: 'Correr' }, { valor: 'giro', label: 'Giro' }, { valor: 'pivotante', label: 'Pivotante' },
    ] },
    { chave: 'folhas', label: 'Folhas', quando: [igual('produto', 'porta'), igual('abertura', 'correr')], opcoes: [{ valor: '2', label: '2 folhas' }] },
    { chave: 'exposicao', label: 'Ambiente / exposição', quando: porta2f, opcoes: [
      { valor: 'interna', label: 'Interna' }, { valor: 'externa_protegida', label: 'Externa protegida' }, { valor: 'externa_exposta', label: 'Externa exposta' },
    ] },
    { chave: 'fechadura', label: 'Fechadura', quando: porta2f, opcoes: simNao },
    { chave: 'montante_lateral_movel', label: 'Montante lateral móvel', quando: porta2f, opcoes: [{ valor: 'estreito', label: 'Estreito' }, { valor: 'largo', label: 'Largo' }] },
    { chave: 'reforco_aba', label: 'Reforço de aba', quando: porta2f, opcoes: simNao },
    { chave: 'reforco_interno', label: 'Reforço interno', quando: porta2f, opcoes: simNao },
    { chave: 'reforco_externo', label: 'Reforço externo', quando: porta2f, opcoes: simNao },
  ],
  regras: [],
}
export const NIVEIS: Nivel[] = ['Recomendação', 'Alerta forte', 'Obrigatória', 'Análise técnica']
export function numero(valor: string | undefined): number {
  return valor?.trim() ? Number(valor.replace(',', '.')) : NaN
}
export function resumoPiloto(r: Respostas) {
  return CADASTRO_INICIAL.perguntas.map(p => {
    const opcao = p.opcoes.find(o => o.valor === r[p.chave])
    return opcao ? `${p.label}: ${opcao.label}` : ''
  }).filter(Boolean).join(' · ')
}
export function medidasValidas(r: Respostas) {
  return Number.isFinite(numero(r.largura)) && numero(r.largura) > 0 && Number.isFinite(numero(r.altura)) && numero(r.altura) > 0
    && Number.isSafeInteger(numero(r.quantidade)) && numero(r.quantidade) > 0
}
export function corresponde(condicoes: Condicao[], r: Respostas) {
  return condicoes.every(c => {
    if (!r[c.campo]) return false
    if (c.operador === 'igual' && !['largura', 'altura', 'quantidade'].includes(c.campo)) return r[c.campo] === c.valor
    const atual = numero(r[c.campo]), limite = numero(c.valor)
    if (!Number.isFinite(atual) || !Number.isFinite(limite)) return false
    if (c.operador === 'igual') return atual === limite
    return c.operador === 'maior_igual' ? atual >= limite : atual <= limite
  })
}
/** Ordem declarada + condições: só a próxima pergunta sem resposta fica aberta. */
export function perguntasVisiveis(c: CadastroConfigurador, r: Respostas): Pergunta[] {
  if (!medidasValidas(r) || !c.categorias.some(o => o.valor === r.produto)) return []
  const visiveis: Pergunta[] = []
  for (const p of c.perguntas) {
    if (!corresponde(p.quando, r)) continue
    visiveis.push(p)
    if (!p.opcoes.some(o => o.valor === r[p.chave])) break
  }
  return visiveis
}
/** Limpa escolhas posteriores para não transportar decisões de outra configuração. */
export function alterarResposta(c: CadastroConfigurador, atual: Respostas, campo: string, valor: string): Respostas {
  const ordem = ['largura', 'altura', 'quantidade', 'produto', ...c.perguntas.flatMap(p => p.chave === 'exposicao' ? [p.chave, 'linha'] : [p.chave])]
  const proxima = { ...atual, [campo]: valor }
  const indice = ordem.indexOf(campo)
  if (indice >= 3 && campo !== 'linha') for (const chave of ordem.slice(indice + 1)) delete proxima[chave]
  // Dimensões reavaliam as regras e invalidam a escolha de linha, sem perder decisões explícitas.
  if (indice < 3) delete proxima.linha
  return proxima
}
export function avaliar(c: CadastroConfigurador, r: Respostas, linhas: { id: string; nome: string }[] = []) {
  const pendencias: string[] = []
  if (!medidasValidas(r)) pendencias.push('Informe largura e altura positivas e quantidade inteira positiva.')
  if (!corresponde(porta2f, r)) pendencias.push('Piloto disponível somente para Porta → Correr → 2 folhas.')
  const aplicaveis = c.perguntas.filter(p => corresponde(p.quando, r))
  for (const p of aplicaveis) if (!p.opcoes.some(o => o.valor === r[p.chave])) pendencias.push(`Escolha ${p.label}.`)
  // Invariante validada pelo usuário; nunca implica reforço de aba.
  if (r.fechadura === 'sim' && r.montante_lateral_movel !== 'largo') pendencias.push('Fechadura exige Montante lateral móvel Largo.')
  const regras = medidasValidas(r) ? c.regras.filter(regra => regra.ativa && corresponde(regra.quando, r)) : []
  const avisos = regras.map(regra => ({ id: regra.id, nivel: regra.nivel, mensagem: regra.nome }))
  for (const regra of regras) {
    if (regra.nivel === 'Análise técnica') pendencias.push(`Análise técnica: ${regra.nome}`)
    if (regra.nivel === 'Obrigatória' && regra.acao === 'exigir_valor' && r[regra.alvo] !== regra.valor) pendencias.push(regra.nome)
    if (regra.nivel === 'Obrigatória' && regra.acao === 'avisar') pendencias.push(regra.nome)
  }
  const permitidas = regras.filter(regra => regra.acao === 'permitir_linha' && regra.nivel === 'Obrigatória')
  if (permitidas.length && !r.linha) pendencias.push('Selecione uma das linhas permitidas pela regra obrigatória.')
  const opcoesLinhas = linhas.map(linha => {
    const bloqueada = regras.some(regra => regra.acao === 'bloquear_linha' && regra.nivel === 'Obrigatória' && regra.alvo === linha.id)
      || (permitidas.length > 0 && !permitidas.some(regra => regra.alvo === linha.id))
    return { ...linha, bloqueada, recomendada: regras.some(regra => regra.acao === 'recomendar_linha' && regra.alvo === linha.id) }
  })
  if (r.linha && !opcoesLinhas.some(l => l.id === r.linha && !l.bloqueada)) pendencias.push('A linha selecionada está indisponível para esta configuração.')
  return { pendencias: Array.from(new Set(pendencias)), avisos, linhas: opcoesLinhas, completa: pendencias.length === 0 }
}

/** Valida cadastro antes de persistir; sem eval, fórmulas ou coerção de limites vazios. */
export function validarCadastro(input: unknown): asserts input is CadastroConfigurador {
  if (!input || typeof input !== 'object') throw new Error('Cadastro inválido.')
  const c = input as CadastroConfigurador
  if (c.versao !== 1 || !Array.isArray(c.categorias) || !Array.isArray(c.perguntas) || !Array.isArray(c.regras)) throw new Error('Estrutura de cadastro inválida.')
  const texto = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500
  const chave = (v: unknown) => typeof v === 'string' && /^[a-z][a-z0-9_]{0,59}$/.test(v)
  if (c.categorias.length > 100 || c.perguntas.length > 60 || c.regras.length > 200) throw new Error('Cadastro excedeu a capacidade do piloto.')
  if (!c.categorias.some(o => o.valor === 'porta') || c.categorias.some(o => !chave(o.valor) || !texto(o.label)) || new Set(c.categorias.map(o => o.valor)).size !== c.categorias.length) throw new Error('Categorias inválidas ou repetidas.')
  const conhecidos = new Set(['largura', 'altura', 'quantidade', 'produto'])
  const validarCondicoes = (condicoes: Condicao[], campos: Set<string>) => {
    if (!Array.isArray(condicoes) || condicoes.length > 30) throw new Error('Condições inválidas.')
    for (const cond of condicoes) {
      if (!campos.has(cond.campo) || !['igual', 'maior_igual', 'menor_igual'].includes(cond.operador) || !texto(cond.valor)) throw new Error('Condição inválida.')
      if (cond.operador !== 'igual' && (!['largura', 'altura', 'quantidade'].includes(cond.campo) || !Number.isFinite(numero(cond.valor)) || numero(cond.valor) <= 0)) throw new Error('Limite dimensional deve ser positivo e validado.')
    }
  }
  for (const p of c.perguntas) {
    if (!chave(p.chave) || conhecidos.has(p.chave) || p.chave === 'linha' || !texto(p.label) || !Array.isArray(p.opcoes) || !p.opcoes.length || p.opcoes.some(o => !texto(o.valor) || !texto(o.label)) || new Set(p.opcoes.map(o => o.valor)).size !== p.opcoes.length) throw new Error('Pergunta inválida.')
    validarCondicoes(p.quando, conhecidos)
    conhecidos.add(p.chave)
  }
  // O piloto não permite remover decisões já aprovadas nem liberar outras aberturas/folhas.
  for (const original of CADASTRO_INICIAL.perguntas) {
    const p = c.perguntas.find(p => p.chave === original.chave)
    if (!p || JSON.stringify(p) !== JSON.stringify(original)) throw new Error('Preserve as perguntas técnicas aprovadas do piloto.')
  }
  if (new Set(c.regras.map(r => r.id)).size !== c.regras.length) throw new Error('Regras repetidas.')
  for (const regra of c.regras) {
    if (!texto(regra.id) || !texto(regra.nome) || !texto(regra.evidencia) || typeof regra.ativa !== 'boolean' || !NIVEIS.includes(regra.nivel) || !['recomendar_linha', 'permitir_linha', 'bloquear_linha', 'exigir_valor', 'avisar'].includes(regra.acao)) throw new Error('Regra inválida: informe nome, nível e evidência técnica.')
    validarCondicoes(regra.quando, conhecidos)
    if (regra.acao.endsWith('_linha') && !texto(regra.alvo)) throw new Error('Selecione uma linha existente.')
    if (regra.acao === 'exigir_valor' && !c.perguntas.some(p => p.chave === regra.alvo && p.opcoes.some(o => o.valor === regra.valor))) throw new Error('Selecione uma variável e opção válidas.')
  }
}
