from pathlib import Path

path = Path('app/cadastro/produtos/page.tsx')
text = path.read_text(encoding='utf-8')

old = """  if (carregando) {\n    return <div className=\"min-h-screen flex items-center justify-center text-slate-400\">Carregando...</div>\n  }\n"""
new = """  const unidadesPendentes = produtos.filter(p => p.categoria === 'acessorio' && !p.unidade).length\n\n  if (carregando) {\n    return <div className=\"min-h-screen flex items-center justify-center text-slate-400\">Carregando...</div>\n  }\n"""
if old not in text:
    raise SystemExit('marcador carregando nao encontrado')
text = text.replace(old, new, 1)

old = """          <Link href=\"/cadastro/produtos/precificacao\" className=\"flex items-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-1.5 hover:bg-brand-navyLight transition\">\n            <Tag size={14} /> Precificar em lote\n          </Link>\n"""
new = """          {unidadesPendentes > 0 && (\n            <Link href=\"/cadastro/produtos/unidades-pendentes\" className=\"flex items-center gap-1.5 text-xs font-semibold text-amber-800 border border-amber-300 bg-amber-50 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition\">\n              <ShieldAlert size={14} /> {unidadesPendentes} unidades pendentes\n            </Link>\n          )}\n          <Link href=\"/cadastro/produtos/precificacao\" className=\"flex items-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-1.5 hover:bg-brand-navyLight transition\">\n            <Tag size={14} /> Precificar em lote\n          </Link>\n"""
if old not in text:
    raise SystemExit('marcador header precificacao nao encontrado')
text = text.replace(old, new, 1)

old = """                      <input\n                        type=\"text\"\n                        value={editForm[p.id]?.unidade ?? ''}\n                        onChange={e => mudarCampoEdicao(p.id, 'unidade', e.target.value)}\n                        placeholder=\"Unidade operacional (origem preservada no cartão)\"\n                        className=\"w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs\"\n                      />\n"""
new = """                      <input\n                        type=\"text\"\n                        value={editForm[p.id]?.unidade ?? ''}\n                        onChange={e => mudarCampoEdicao(p.id, 'unidade', e.target.value)}\n                        disabled={!p.unidade}\n                        placeholder={p.unidade ? 'Unidade operacional' : 'Unidade pendente — use a validação auditada'}\n                        className=\"w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs disabled:bg-amber-50 disabled:text-amber-800 disabled:border-amber-200\"\n                      />\n                      {!p.unidade && (\n                        <div className=\"flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800\">\n                          <span>Origem {p.unidade_origem || 'não informada'}{p.qtde_embalagem_origem != null ? ` · Qtde Emb. ${p.qtde_embalagem_origem}` : ''}. Não preencher por inferência.</span>\n                          <Link\n                            href={`/cadastro/produtos/unidades-pendentes?q=${encodeURIComponent(p.codigo || p.nome.split(' - ')[0] || '')}`}\n                            className=\"font-semibold underline whitespace-nowrap\"\n                          >\n                            Validar unidade\n                          </Link>\n                        </div>\n                      )}\n"""
if old not in text:
    raise SystemExit('marcador input unidade edicao nao encontrado')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
