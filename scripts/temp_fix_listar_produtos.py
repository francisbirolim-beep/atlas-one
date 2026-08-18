from pathlib import Path

path = Path('lib/produtos.ts')
text = path.read_text(encoding='utf-8')
old = """export async function listarProdutos(somenteAtivos = false): Promise<Produto[]> {\n  let query = supabase.from('produtos').select('*').order('categoria').order('nome')\n  if (somenteAtivos) query = query.eq('ativo', true)\n  const { data } = await query\n  return (data as Produto[]) || []\n}\n"""
new = """export async function listarProdutos(somenteAtivos = false): Promise<Produto[]> {\n  const tamanhoPagina = 1000\n  const todos: Produto[] = []\n\n  for (let inicio = 0; ; inicio += tamanhoPagina) {\n    let query = supabase\n      .from('produtos')\n      .select('*')\n      .order('categoria')\n      .order('nome')\n      .order('id')\n      .range(inicio, inicio + tamanhoPagina - 1)\n\n    if (somenteAtivos) query = query.eq('ativo', true)\n\n    const { data, error } = await query\n    if (error) {\n      console.error('Erro ao listar produtos:', error)\n      return []\n    }\n\n    const pagina = (data as Produto[]) || []\n    todos.push(...pagina)\n    if (pagina.length < tamanhoPagina) break\n  }\n\n  return todos\n}\n"""
if old not in text:
    raise SystemExit('Bloco listarProdutos esperado não encontrado')
path.write_text(text.replace(old, new), encoding='utf-8')
