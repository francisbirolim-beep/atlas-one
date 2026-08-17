from pathlib import Path

# Se uma linha foi escolhida, somente vinculos reais daquela linha podem aparecer.
p = Path('components/orcamento/SeletorEsquadriaInteligente.tsx')
text = p.read_text(encoding='utf-8')
old = """  const produtosCompativeis = useMemo(() => {
    if (!linha) return catalogo.produtos
    if (!linha.produto_ids?.length) return catalogo.produtos
    return catalogo.produtos.filter(p => linha.produto_ids!.includes(p.id))
  }, [catalogo.produtos, linha])

  const tipologiasCompativeis = useMemo(() => {
    if (!linha) return catalogo.tipologias
    if (!linha.tipologia_ids?.length) return catalogo.tipologias
    return catalogo.tipologias.filter(t => linha.tipologia_ids!.includes(t.id))
  }, [catalogo.tipologias, linha])
"""
new = """  const produtosCompativeis = useMemo(() => {
    if (!linha) return catalogo.produtos
    return catalogo.produtos.filter(p => Boolean(linha.produto_ids?.includes(p.id)))
  }, [catalogo.produtos, linha])

  const tipologiasCompativeis = useMemo(() => {
    if (!linha) return catalogo.tipologias
    return catalogo.tipologias.filter(t => Boolean(linha.tipologia_ids?.includes(t.id)))
  }, [catalogo.tipologias, linha])
"""
if old not in text:
    raise SystemExit('filtro do seletor nao encontrado')
text = text.replace(old, new, 1)

marker = """              <button type=\"button\" onMouseDown={e => e.preventDefault()} onClick={usarTextoLivre} className=\"w-full text-left rounded-lg border border-dashed border-slate-200 px-3 py-2 hover:bg-slate-50\"><span className=\"text-xs text-slate-500\">Não encontrou? Usar exatamente:</span><span className=\"block text-sm font-medium text-slate-700\">“{busca.trim()}”</span></button>
"""
new_marker = """              {linha && configsEncontradas.length === 0 && tipologiasEncontradas.length === 0 && produtosEncontrados.length === 0 && (
                <div className=\"rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800\">Nenhum cadastro vinculado à linha {linha.nome} corresponde à busca. Você ainda pode seguir com texto livre, sem criar vínculo técnico falso.</div>
              )}
              <button type=\"button\" onMouseDown={e => e.preventDefault()} onClick={usarTextoLivre} className=\"w-full text-left rounded-lg border border-dashed border-slate-200 px-3 py-2 hover:bg-slate-50\"><span className=\"text-xs text-slate-500\">Não encontrou? Usar exatamente:</span><span className=\"block text-sm font-medium text-slate-700\">“{busca.trim()}”</span></button>
"""
if marker not in text:
    raise SystemExit('texto livre do seletor nao encontrado')
text = text.replace(marker, new_marker, 1)
p.write_text(text, encoding='utf-8')

# No cadastro administrativo, Linha escolhida tambem restringe de verdade.
p = Path('app/engenharia/configuracoes-orcamento/page.tsx')
text = p.read_text(encoding='utf-8')
old = """  const tipologiasFiltradas = useMemo(() => {
    if (!linha || !linha.tipologia_ids?.length) return tipologias
    return tipologias.filter(t => linha.tipologia_ids!.includes(t.id))
  }, [linha, tipologias])
  const produtosFiltrados = useMemo(() => {
    if (!linha || !linha.produto_ids?.length) return produtos
    return produtos.filter(p => linha.produto_ids!.includes(p.id))
  }, [linha, produtos])
"""
new = """  const tipologiasFiltradas = useMemo(() => {
    if (!linha) return tipologias
    return tipologias.filter(t => Boolean(linha.tipologia_ids?.includes(t.id)))
  }, [linha, tipologias])
  const produtosFiltrados = useMemo(() => {
    if (!linha) return produtos
    return produtos.filter(p => Boolean(linha.produto_ids?.includes(p.id)))
  }, [linha, produtos])
"""
if old not in text:
    raise SystemExit('filtro administrativo nao encontrado')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
