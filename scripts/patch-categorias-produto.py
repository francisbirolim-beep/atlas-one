from pathlib import Path

path = Path('app/cadastro/produtos/page.tsx')
s = path.read_text()
old = """          {produtos.length === 0 ? (
            <p className=\"text-sm text-slate-400\">Nenhum produto cadastrado ainda.</p>
          ) : (
"""
new = """          {produtos.filter(p => {
            if (filtroCategoria && p.categoria !== filtroCategoria) return false
            if (filtroLinha && p.linha_id !== filtroLinha) return false
            const q = busca.trim().toLowerCase()
            if (!q) return true
            const codigo = (p.codigo || p.nome.split(' - ')[0] || '').toLowerCase()
            return p.nome.toLowerCase().includes(q) || codigo.includes(q) || (p.descricao || '').toLowerCase().includes(q)
          }).length === 0 ? (
            <p className=\"text-sm text-slate-400\">Nenhum produto encontrado nesta categoria ou com estes filtros.</p>
          ) : (
"""
if old not in s:
    raise RuntimeError('Trecho de estado vazio nao encontrado')
path.write_text(s.replace(old, new, 1))
print('Estado vazio por categoria ajustado.')
