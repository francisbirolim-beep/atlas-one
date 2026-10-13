/**
 * Comparação operacional W.Vetro: o número do orçamento não muda quando
 * o orçamento recebe novas peças ou revisões. Este diff é independente do
 * mapeamento técnico do Atlas e não altera o orçamento existente.
 */
export type MudancaOrcamentoWVetro = {
  tipo: 'incluido' | 'removido' | 'alterado'
  item: string
  campo: string
  antes: string | null
  depois: string | null
}

type Objeto = Record<string, unknown>
function obj(x: unknown): Objeto { return x && typeof x === 'object' && !Array.isArray(x) ? x as Objeto : {} }
function txt(...xs: unknown[]) { return String(xs.find(x => x !== undefined && x !== null && String(x).trim()) ?? '').trim() }
function arr(x: unknown) { return Array.isArray(x) ? x.map(obj) : [] }
function norm(x: unknown) { return txt(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase() }
function valor(x: unknown) {
  const texto = txt(x)
  if (!texto) return ''
  const br = texto.includes(',') && (!texto.includes('.') || texto.lastIndexOf(',') > texto.lastIndexOf('.'))
  const n = Number(br ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/,/g, ''))
  return Number.isFinite(n) ? String(n) : texto
}
function medida(x: unknown) {
  const n = Number(valor(x))
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(n < 20 ? Math.round(n * 1000) : Math.round(n))
}
function itens(p: Objeto) { return arr(Array.isArray(p.Itens) ? p.Itens : p.itens) }
function id(i: Objeto) { return txt(i.Id, i.ID, i.ItemId, i.ProjetoId) }
function modelo(i: Objeto) { return txt(i.Modelo, i.Nome, i.Descricao, i.Codigo) }
function linha(i: Objeto) { return txt(i.Linha, i.LinhaNome, i.LinhaDescricao) }
function ambiente(i: Objeto) { return txt(i.Ambiente, i.Local) }
function descricao(i: Objeto) {
  return [modelo(i), linha(i), ambiente(i)].filter(Boolean).join(' · ') || 'Item sem descrição'
}
function composicao(i: Objeto, chaves: string[]) {
  const dados = chaves.map(k => i[k]).find(x => Array.isArray(x))
  if (!Array.isArray(dados)) return ''
  return dados.map((x: unknown) => {
    const c = obj(x)
    return [txt(c.Codigo, c.ProdutoCodigo, c.Id), txt(c.Nome, c.Descricao, c.ProdutoNome),
      valor(c.Qtde ?? c.Quantidade ?? c.Qtd),
      valor(c.ValorUnitario ?? c.Valor ?? c.Custo)].join(':')
  }).sort().join(' | ')
}
function assinatura(i: Objeto) {
  return [norm(modelo(i)), norm(linha(i)), norm(ambiente(i)),
    medida(i.Largura ?? i.LarguraMM ?? i.LarguraMm),
    medida(i.Altura ?? i.AlturaMM ?? i.AlturaMm),
    valor(i.Qtde ?? i.Quantidade ?? 1)].join('|')
}
function muda(out: MudancaOrcamentoWVetro[], tipo: MudancaOrcamentoWVetro['tipo'],
  item: string, campo: string, antes: string | null, depois: string | null) {
  out.push({ tipo, item, campo, antes, depois })
}
export function compararVersoesOrcamentoWVetro(anteriorInput: unknown, atualInput: unknown): MudancaOrcamentoWVetro[] {
  const anterior = obj(anteriorInput), atual = obj(atualInput)
  const antigos = itens(anterior), novos = itens(atual)
  const result: MudancaOrcamentoWVetro[] = []
  const pares = new Map<number, number>()
  const usados = new Set<number>()
  function vincular(a: number, b: number) { pares.set(a, b); usados.add(b) }
  // Primeiro identificador real do item (se disponível); evita trocar tipologias
  // de posição no orçamento e interpretar mudança de medida como item novo.
  for (let a = 0; a < antigos.length; a++) {
    const chave = id(antigos[a])
    if (!chave) continue
    const b = novos.findIndex((n, j) => !usados.has(j) && id(n) === chave)
    if (b >= 0) vincular(a, b)
  }
  // Depois correspondência exata, inclusive para peças repetidas.
  for (let a = 0; a < antigos.length; a++) {
    if (pares.has(a)) continue
    const b = novos.findIndex((n, j) => !usados.has(j) && assinatura(n) === assinatura(antigos[a]))
    if (b >= 0) vincular(a, b)
  }
  // Uma peça que mudou de largura continua sendo a mesma peça quando seu
  // modelo/linha/ambiente a identificam sem ambiguidade.
  for (let a = 0; a < antigos.length; a++) {
    if (pares.has(a)) continue
    const semelhantes = novos.map((n, j) => ({ n, j })).filter(({ n, j }) =>
      !usados.has(j) && norm(modelo(n)) === norm(modelo(antigos[a])) &&
      norm(linha(n)) === norm(linha(antigos[a])) &&
      norm(ambiente(n)) === norm(ambiente(antigos[a])))
    if (semelhantes.length === 1) vincular(a, semelhantes[0].j)
  }
  // Se ambos têm a mesma quantidade de itens, preservamos o vínculo por
  // posição como último recurso para detectar troca de tipologia.
  if (antigos.length === novos.length) {
    for (let a = 0; a < antigos.length; a++) {
      if (pares.has(a)) continue
      if (!usados.has(a)) vincular(a, a)
    }
  }
  const campos: Array<[string, (i: Objeto) => string]> = [
    ['Tipologia', modelo],
    ['Linha', linha],
    ['Ambiente', ambiente],
    ['Largura (mm)', i => medida(i.Largura ?? i.LarguraMM ?? i.LarguraMm)],
    ['Altura (mm)', i => medida(i.Altura ?? i.AlturaMM ?? i.AlturaMm)],
    ['Quantidade', i => valor(i.Qtde ?? i.Quantidade ?? 1)],
    ['Cor', i => txt(i.Cor, i.CorNome, i.Acabamento)],
    ['Valor do item', i => valor(i.ValorTotalAlterado ?? i.ValorTotal ?? i.Total)],
    ['Perfis', i => composicao(i, ['Perfil','Perfis'])],
    ['Acessórios', i => composicao(i, ['Acessorios','Acessórios'])],
    ['Vidros', i => composicao(i, ['Vidros'])],
  ]
  for (let a = 0; a < antigos.length; a++) {
    const b = pares.get(a), velho = antigos[a]
    if (b === undefined) {
      muda(result, 'removido', descricao(velho), 'Item removido', descricao(velho), null)
      continue
    }
    const novo = novos[b]
    for (const [campo, extrair] of campos) {
      const antes = extrair(velho), depois = extrair(novo)
      if (norm(antes) !== norm(depois)) muda(result, 'alterado', descricao(novo), campo, antes || null, depois || null)
    }
  }
  for (let b = 0; b < novos.length; b++) {
    if (usados.has(b)) continue
    const novo = novos[b]
    const detalhe = [descricao(novo),
      medida(novo.Largura ?? novo.LarguraMM ?? novo.LarguraMm) + ' × ' +
      medida(novo.Altura ?? novo.AlturaMM ?? novo.AlturaMm) + ' mm',
      'Qtd. ' + valor(novo.Qtde ?? novo.Quantidade ?? 1)].join(' · ')
    muda(result, 'incluido', descricao(novo), 'Item incluído', null, detalhe)
  }
  // Não depender somente do hash bruto: timestamps e metadados W.Vetro
  // podem mudar sem qualquer alteração comercial perceptível.
  const gerais: Array<[string, unknown, unknown]> = [
    ['Valor total', anterior.ValorTotal ?? anterior.Total ?? anterior.ValorBruto,
      atual.ValorTotal ?? atual.Total ?? atual.ValorBruto],
    ['Situação', anterior.Situacao ?? anterior.Status, atual.Situacao ?? atual.Status],
    ['Desconto', anterior.DescontoVlr, atual.DescontoVlr],
    ['Custo com sobra', anterior.CustoComSobra, atual.CustoComSobra],
  ]
  for (const [campo, v1, v2] of gerais) {
    const antes = ['Valor total', 'Desconto', 'Custo com sobra'].includes(campo) ? valor(v1) : txt(v1)
    const depois = ['Valor total', 'Desconto', 'Custo com sobra'].includes(campo) ? valor(v2) : txt(v2)
    if (norm(antes) !== norm(depois)) muda(result, 'alterado', 'Orçamento', campo, antes || null, depois || null)
  }
  return result
}
