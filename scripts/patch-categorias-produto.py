from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise RuntimeError(f'Trecho nao encontrado: {label} em {path}')
    p.write_text(s.replace(old, new, 1))

# 1) Categoria de produto passa a ser dinamica
replace_once(
    'lib/tipos.ts',
    "export type CategoriaProduto = 'porta_janela_padrao' | 'perfil' | 'pu' | 'acessorio' | 'outro'",
    "// Categoria de produto e dinamica. Os valores historicos continuam validos,\n// mas novas categorias podem ser criadas pelo usuario em Cadastro.\nexport type CategoriaProduto = string",
    'tipo CategoriaProduto',
)

# 2) Fonte dinamica das categorias, persistida em configuracoes_gerais
replace_once(
    'lib/produtos.ts',
    """export const CATEGORIAS_PRODUTO: { valor: CategoriaProduto; label: string }[] = [
  { valor: 'porta_janela_padrao', label: 'Porta/Janela padrão' },
  { valor: 'perfil', label: 'Perfil' },
  { valor: 'pu', label: 'PU' },
  { valor: 'acessorio', label: 'Acessório' },
  { valor: 'outro', label: 'Outro' },
]

export function labelCategoriaProduto(categoria: CategoriaProduto): string {
  return CATEGORIAS_PRODUTO.find(c => c.valor === categoria)?.label || categoria
}
""",
    """export interface CategoriaProdutoConfig {
  valor: CategoriaProduto
  label: string
  ordem: number
}

const CHAVE_CATEGORIAS_PRODUTO = 'categorias_produto_dinamicas'

export const CATEGORIAS_PRODUTO_PRINCIPAIS: CategoriaProdutoConfig[] = [
  { valor: 'produto', label: 'Produto', ordem: 10 },
  { valor: 'acessorio', label: 'Acessório', ordem: 20 },
  { valor: 'perfil', label: 'Perfil', ordem: 30 },
  { valor: 'porta_janela_padrao', label: 'Produto pronto', ordem: 40 },
]

// Mantido por compatibilidade com telas antigas. A listagem nova deve usar
// listarCategoriasProduto(), que inclui categorias criadas pelo usuario.
export const CATEGORIAS_PRODUTO: CategoriaProdutoConfig[] = [
  ...CATEGORIAS_PRODUTO_PRINCIPAIS,
  { valor: 'pu', label: 'PU', ordem: 90 },
  { valor: 'outro', label: 'Outro', ordem: 100 },
]

let categoriasProdutoCache: CategoriaProdutoConfig[] = [...CATEGORIAS_PRODUTO]

function humanizarCategoria(valor: string): string {
  if (valor === 'porta_janela_padrao') return 'Produto pronto'
  if (valor === 'pu') return 'PU'
  return valor
    .replace(/_/g, ' ')
    .replace(/\\b\\w/g, letra => letra.toUpperCase())
}

function normalizarChaveCategoria(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function lerExtras(valor: string | null | undefined): CategoriaProdutoConfig[] {
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item.valor === 'string' && typeof item.label === 'string')
      .map((item, index) => ({
        valor: item.valor as CategoriaProduto,
        label: item.label.trim(),
        ordem: Number(item.ordem) || 200 + index * 10,
      }))
      .filter(item => item.valor && item.label)
  } catch {
    return []
  }
}

export async function listarCategoriasProduto(): Promise<CategoriaProdutoConfig[]> {
  const [{ data: config }, { data: usados }] = await Promise.all([
    supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', CHAVE_CATEGORIAS_PRODUTO)
      .maybeSingle(),
    supabase.from('produtos').select('categoria'),
  ])

  const mapa = new Map<string, CategoriaProdutoConfig>()
  CATEGORIAS_PRODUTO_PRINCIPAIS.forEach(c => mapa.set(c.valor, c))
  lerExtras(config?.valor).forEach(c => mapa.set(c.valor, c))

  ;((usados as { categoria?: string | null }[]) || []).forEach((item, index) => {
    const valor = item.categoria?.trim()
    if (!valor || mapa.has(valor)) return
    const legado = CATEGORIAS_PRODUTO.find(c => c.valor === valor)
    mapa.set(valor, {
      valor,
      label: legado?.label || humanizarCategoria(valor),
      ordem: legado?.ordem || 1000 + index,
    })
  })

  const lista = Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
  categoriasProdutoCache = lista
  return lista
}

export async function criarCategoriaProduto(nome: string): Promise<{ categoria: CategoriaProdutoConfig | null; erro: string | null }> {
  const label = nome.trim()
  if (!label) return { categoria: null, erro: 'Informe o nome da categoria.' }

  const valor = normalizarChaveCategoria(label)
  if (!valor) return { categoria: null, erro: 'Nome de categoria inválido.' }

  const atuais = await listarCategoriasProduto()
  const duplicada = atuais.some(c => c.valor === valor || c.label.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))
  if (duplicada) return { categoria: null, erro: 'Essa categoria já existe.' }

  const { data: config } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_CATEGORIAS_PRODUTO)
    .maybeSingle()

  const extras = lerExtras(config?.valor)
  const maiorOrdem = atuais.reduce((maior, item) => Math.max(maior, item.ordem), 100)
  const nova: CategoriaProdutoConfig = { valor, label, ordem: maiorOrdem + 10 }
  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_CATEGORIAS_PRODUTO,
      valor: JSON.stringify([...extras, nova]),
      updated_at: new Date().toISOString(),
    })

  if (error) return { categoria: null, erro: 'Não foi possível salvar a categoria.' }
  categoriasProdutoCache = [...atuais, nova].sort((a, b) => a.ordem - b.ordem)
  return { categoria: nova, erro: null }
}

export function labelCategoriaProduto(categoria: CategoriaProduto): string {
  return categoriasProdutoCache.find(c => c.valor === categoria)?.label
    || CATEGORIAS_PRODUTO.find(c => c.valor === categoria)?.label
    || humanizarCategoria(categoria)
}
""",
    'categorias dinamicas em lib/produtos',
)

# 3) Cadastro principal mostra categorias separadas e permite criar novas
replace_once(
    'app/cadastro/page.tsx',
    "import { lerCorAssistencia, salvarCorAssistencia, lerDadosEmpresa, salvarDadosEmpresa } from '@/lib/configGeral'",
    "import { lerCorAssistencia, salvarCorAssistencia, lerDadosEmpresa, salvarDadosEmpresa } from '@/lib/configGeral'\nimport { listarCategoriasProduto, criarCategoriaProduto, CategoriaProdutoConfig } from '@/lib/produtos'",
    'import categorias cadastro',
)
replace_once(
    'app/cadastro/page.tsx',
    "  const [msgEmpresa, setMsgEmpresa] = useState('')\n",
    "  const [msgEmpresa, setMsgEmpresa] = useState('')\n\n  const [categoriasProduto, setCategoriasProduto] = useState<CategoriaProdutoConfig[]>([])\n  const [novaCategoriaProdutoAberta, setNovaCategoriaProdutoAberta] = useState(false)\n  const [novaCategoriaProdutoNome, setNovaCategoriaProdutoNome] = useState('')\n  const [salvandoCategoriaProduto, setSalvandoCategoriaProduto] = useState(false)\n  const [msgCategoriaProduto, setMsgCategoriaProduto] = useState('')\n",
    'states categorias cadastro',
)
replace_once(
    'app/cadastro/page.tsx',
    """      const [{ data: users }, cols, listaSetores, listaMetas, listaBackups, corAssistencia, dadosEmpresa] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
        listarColunas(),
        listarSetores(),
        listarMetas(mesMetaAtual),
        listarBackups(),
        lerCorAssistencia(),
        lerDadosEmpresa(),
      ])
""",
    """      const [{ data: users }, cols, listaSetores, listaMetas, listaBackups, corAssistencia, dadosEmpresa, categoriasProdutoCarregadas] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
        listarColunas(),
        listarSetores(),
        listarMetas(mesMetaAtual),
        listarBackups(),
        lerCorAssistencia(),
        lerDadosEmpresa(),
        listarCategoriasProduto(),
      ])
      setCategoriasProduto(categoriasProdutoCarregadas)
""",
    'carregar categorias cadastro',
)
replace_once(
    'app/cadastro/page.tsx',
    """  async function salvarDadosEmpresaAcao() {
    setSalvandoEmpresa(true)
""",
    """  async function criarNovaCategoriaProduto(e: React.FormEvent) {
    e.preventDefault()
    if (!novaCategoriaProdutoNome.trim()) return
    setSalvandoCategoriaProduto(true)
    setMsgCategoriaProduto('')
    const resultado = await criarCategoriaProduto(novaCategoriaProdutoNome)
    setSalvandoCategoriaProduto(false)
    if (!resultado.categoria) {
      setMsgCategoriaProduto(resultado.erro || 'Erro ao criar categoria.')
      return
    }
    setCategoriasProduto(await listarCategoriasProduto())
    setNovaCategoriaProdutoNome('')
    setNovaCategoriaProdutoAberta(false)
    setMsgCategoriaProduto(`Categoria ${resultado.categoria.label} criada.`)
  }

  async function salvarDadosEmpresaAcao() {
    setSalvandoEmpresa(true)
""",
    'funcao criar categoria cadastro',
)
replace_once(
    'app/cadastro/page.tsx',
    """            <Link href="/cadastro/produtos" className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Package size={18} className="text-brand-navy" /> Produtos</span>
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
            </Link>
""",
    """            <div className="pt-2 space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Produtos e itens</p>
              {categoriasProduto.map(categoria => (
                <Link
                  key={categoria.valor}
                  href={`/cadastro/produtos?categoria=${encodeURIComponent(categoria.valor)}`}
                  className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    {categoria.valor === 'acessorio' ? <Wrench size={18} className="text-brand-navy" /> : categoria.valor === 'perfil' ? <Layers size={18} className="text-brand-navy" /> : <Package size={18} className="text-brand-navy" />}
                    {categoria.label}
                  </span>
                  <ChevronDown size={16} className="-rotate-90 text-slate-300" />
                </Link>
              ))}

              {!novaCategoriaProdutoAberta ? (
                <button
                  onClick={() => { setNovaCategoriaProdutoAberta(true); setMsgCategoriaProduto('') }}
                  className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-4 text-sm font-medium text-brand-navy hover:border-brand-navy transition"
                >
                  <Plus size={18} /> Nova categoria
                </button>
              ) : (
                <form onSubmit={criarNovaCategoriaProduto} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={novaCategoriaProdutoNome}
                    onChange={e => setNovaCategoriaProdutoNome(e.target.value)}
                    placeholder="Nome da nova categoria"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={salvandoCategoriaProduto} className="flex-1 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium disabled:opacity-50">
                      {salvandoCategoriaProduto ? 'Salvando...' : 'Criar categoria'}
                    </button>
                    <button type="button" onClick={() => { setNovaCategoriaProdutoAberta(false); setNovaCategoriaProdutoNome('') }} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              {msgCategoriaProduto && <p className="px-1 text-xs text-slate-500">{msgCategoriaProduto}</p>}
            </div>
""",
    'categorias no cadastro principal',
)

# 4) Tela de produtos recebe categoria pela URL, filtra e usa lista dinamica
replace_once(
    'app/cadastro/produtos/page.tsx',
    """  CATEGORIAS_PRODUTO,
  labelCategoriaProduto,
} from '@/lib/produtos'
""",
    """  labelCategoriaProduto,
  listarCategoriasProduto,
  CategoriaProdutoConfig,
} from '@/lib/produtos'
""",
    'imports produtos dinamicos',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    "  categoria: 'porta_janela_padrao',",
    "  categoria: 'produto',",
    'categoria default produto',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    "  const [filtroLinha, setFiltroLinha] = useState('')\n",
    "  const [filtroLinha, setFiltroLinha] = useState('')\n  const [filtroCategoria, setFiltroCategoria] = useState('')\n  const [categorias, setCategorias] = useState<CategoriaProdutoConfig[]>([])\n",
    'states filtro categoria',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    """      const [listaProdutos, listaFornecedores, listaLinhas, listaCores] = await Promise.all([
        listarProdutos(),
        listarFornecedores(),
        listarLinhas(),
        listarCores(),
      ])
      setProdutos(listaProdutos)
""",
    """      const [listaProdutos, listaFornecedores, listaLinhas, listaCores, listaCategorias] = await Promise.all([
        listarProdutos(),
        listarFornecedores(),
        listarLinhas(),
        listarCores(),
        listarCategoriasProduto(),
      ])
      setProdutos(listaProdutos)
      setCategorias(listaCategorias)
      const categoriaUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('categoria') || '' : ''
      setFiltroCategoria(categoriaUrl)
""",
    'carregar categorias produtos',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    """              <button
                onClick={() => setNovoAberto(true)}
                className="flex items-center gap-2 text-sm font-medium text-brand-navy hover:underline"
              >
""",
    """              <button
                onClick={() => {
                  setForm({ ...FORM_VAZIO, categoria: (filtroCategoria || 'produto') as CategoriaProduto })
                  setNovoAberto(true)
                }}
                className="flex items-center gap-2 text-sm font-medium text-brand-navy hover:underline"
              >
""",
    'abrir novo com categoria selecionada',
)
# Troca os dois selects fixos pela lista dinamica
p = Path('app/cadastro/produtos/page.tsx')
s = p.read_text()
if s.count('{CATEGORIAS_PRODUTO.map(c => (') != 2:
    raise RuntimeError('Quantidade inesperada de selects CATEGORIAS_PRODUTO')
s = s.replace('{CATEGORIAS_PRODUTO.map(c => (', '{categorias.map(c => (')
p.write_text(s)

replace_once(
    'app/cadastro/produtos/page.tsx',
    "    setForm(FORM_VAZIO)\n",
    "    setForm({ ...FORM_VAZIO, categoria: (filtroCategoria || 'produto') as CategoriaProduto })\n",
    'reset form categoria atual',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    """          <input
            type="text"
            value={busca}
""",
    """          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
          >
            <option value="">Todas as categorias</option>
            {categorias.map(c => (
              <option key={c.valor} value={c.valor}>{c.label}</option>
            ))}
          </select>

          <input
            type="text"
            value={busca}
""",
    'filtro categoria produtos',
)
replace_once(
    'app/cadastro/produtos/page.tsx',
    """              {produtos.filter(p => {
                if (filtroLinha && p.linha_id !== filtroLinha) return false
                const q = busca.trim().toLowerCase()
""",
    """              {produtos.filter(p => {
                if (filtroCategoria && p.categoria !== filtroCategoria) return false
                if (filtroLinha && p.linha_id !== filtroLinha) return false
                const q = busca.trim().toLowerCase()
""",
    'aplicar filtro categoria',
)

print('Categorias dinamicas aplicadas com sucesso.')
