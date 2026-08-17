from pathlib import Path

# lib/produtos.ts: trocar update direto por chamada autenticada à rota server-side.
p = Path('lib/produtos.ts')
text = p.read_text(encoding='utf-8')
start = text.index('export async function validarUnidadeOperacionalProduto(params: {')
end = text.index('\nexport async function alternarAtivoProduto', start)
novo = '''export async function validarUnidadeOperacionalProduto(params: {
  produtoId: string
  unidade: string
  evidencia: string
}): Promise<{ error: string | null }> {
  const unidade = params.unidade.trim()
  const evidencia = params.evidencia.trim()
  if (!unidade) return { error: 'Informe a unidade operacional.' }
  if (!evidencia) return { error: 'Registre como a unidade foi confirmada.' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { error: 'Sessão expirada. Entre novamente no Atlas.' }

  try {
    const resp = await fetch('/api/produtos/validar-unidade-operacional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ produtoId: params.produtoId, unidade, evidencia }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) return { error: json.error || 'Não foi possível registrar a unidade operacional.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor para validar a unidade operacional.' }
  }
}
'''
text = text[:start] + novo + text[end:]
p.write_text(text, encoding='utf-8')

# Página: identidade não deve ser enviada pelo cliente.
p = Path('app/cadastro/produtos/unidades-pendentes/page.tsx')
text = p.read_text(encoding='utf-8')
old = '''    const resultado = await validarUnidadeOperacionalProduto({
      produtoId: produto.id,
      unidade,
      evidencia,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    })'''
new = '''    const resultado = await validarUnidadeOperacionalProduto({
      produtoId: produto.id,
      unidade,
      evidencia,
    })'''
if old not in text:
    raise SystemExit('chamada da validacao nao encontrada')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
