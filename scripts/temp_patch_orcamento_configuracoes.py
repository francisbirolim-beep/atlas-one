from pathlib import Path
import re

# 1) app/orcamento-rapido/page.tsx
p = Path('app/orcamento-rapido/page.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, TemperaturaLead, Produto, Tipologia } from '@/lib/tipos'", "import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, TemperaturaLead } from '@/lib/tipos'")
text = text.replace("import { listarProdutos } from '@/lib/produtos'\n", "")
text = text.replace("import { listarTipologias } from '@/lib/tipologias'\n", "")
text = text.replace("import { v4 as uuidv4 } from 'uuid'", "import { v4 as uuidv4 } from 'uuid'\nimport SeletorEsquadriaInteligente from '@/components/orcamento/SeletorEsquadriaInteligente'")

old = """  modoOrigem: 'manual' | 'produto'\n  produtoId: string | null\n  precoUnit: number | null\n}"""
new = """  modoOrigem: 'manual' | 'produto'\n  produtoId: string | null\n  precoUnit: number | null\n  linhaId: string | null\n  linhaNome: string | null\n  tipologiaId: string | null\n  configuracaoPresetId: string | null\n  configuracaoNome: string | null\n  configuracaoValidada: boolean\n  modoConfiguracao: 'rapido' | 'assistido'\n  configuracaoStatus: 'pendente' | 'preenchida' | 'validada'\n  variaveis: Record<string, string>\n}"""
if old not in text: raise SystemExit('ItemForm marker not found')
text = text.replace(old, new, 1)

old = """    modoLargura: 'digitar', modoAltura: 'digitar',\n    modoOrigem: 'manual', produtoId: null, precoUnit: null,\n  }"""
new = """    modoLargura: 'digitar', modoAltura: 'digitar',\n    modoOrigem: 'manual', produtoId: null, precoUnit: null,\n    linhaId: null, linhaNome: null, tipologiaId: null,\n    configuracaoPresetId: null, configuracaoNome: null, configuracaoValidada: false,\n    modoConfiguracao: 'rapido', configuracaoStatus: 'pendente', variaveis: {},\n  }"""
if old not in text: raise SystemExit('novoItem marker not found')
text = text.replace(old, new, 1)

text = text.replace("  const [produtos, setProdutos] = useState<Produto[]>([])\n", "")
text = text.replace("  const [tipos, setTipos] = useState<Tipologia[]>([])\n", "")
text = text.replace("\n  useEffect(() => {\n    listarProdutos(true).then(lista => setProdutos(lista.filter(p => Boolean(p.unidade?.trim()))))\n    listarTipologias().then(setTipos)\n  }, [])\n", "\n")

old = """  function atualizarItem(id: string, campo: keyof ItemForm, valor: any) {\n    setItens(itens.map(it => (it.id === id ? { ...it, [campo]: valor } : it)))\n  }\n"""
new = old + """\n  function atualizarItemCampos(id: string, patch: Partial<ItemForm>) {\n    setItens(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))\n  }\n"""
if old not in text: raise SystemExit('atualizarItem marker not found')
text = text.replace(old, new, 1)

# Remove legacy selector helpers; selection is centralized in the new component.
text = re.sub(r"\n  function selecionarProduto\(id: string, produtoId: string\) \{.*?\n  \}\n\n  function voltarParaManual\(id: string\) \{.*?\n  \}\n", "\n", text, count=1, flags=re.S)

# Replace the giant type/product selector block while preserving the rest of the item form.
start = text.find('              <div>\n                <div className="flex items-center justify-between mb-2"><label className="block text-xs text-slate-500">Tipo de esquadria *')
end_marker = "              {item.tipo && <div><label className=\"block text-xs text-slate-500 mb-1\">Quantidade de folhas (opcional)</label>"
end = text.find(end_marker, start)
if start < 0 or end < 0: raise SystemExit('selector JSX markers not found')
replacement = """              <SeletorEsquadriaInteligente\n                value={{\n                  modoOrigem: item.modoOrigem,\n                  produtoId: item.produtoId,\n                  precoUnit: item.precoUnit,\n                  tipo: item.tipo,\n                  tipoOutroTexto: item.tipoOutroTexto,\n                  folhas: item.folhas,\n                  largura: item.largura,\n                  altura: item.altura,\n                  linhaId: item.linhaId,\n                  linhaNome: item.linhaNome,\n                  tipologiaId: item.tipologiaId,\n                  configuracaoPresetId: item.configuracaoPresetId,\n                  configuracaoNome: item.configuracaoNome,\n                  configuracaoValidada: item.configuracaoValidada,\n                  modoConfiguracao: item.modoConfiguracao,\n                  configuracaoStatus: item.configuracaoStatus,\n                  variaveis: item.variaveis,\n                }}\n                onChange={patch => atualizarItemCampos(item.id, patch)}\n              />\n"""
text = text[:start] + replacement + text[end:]

# Clarify leaf count remains an optional override/snapshot field.
text = text.replace('Quantidade de folhas (opcional)</label><input', 'Quantidade de folhas (opcional / ajuste)</label><input', 1)
p.write_text(text, encoding='utf-8')

# 2) lib/tipos.ts — persist selection snapshot inside orcamentos.itens JSON.
p = Path('lib/tipos.ts')
text = p.read_text(encoding='utf-8')
old = """      produto_id?: string | null\n      preco_unit?: number | null\n      preco_total?: number | null\n}"""
new = """      produto_id?: string | null\n      preco_unit?: number | null\n      preco_total?: number | null\n      // Snapshot comercial/tecnico do novo fluxo Linha -> Tipologia -> Configuracao.\n      // Campos opcionais para manter compatibilidade com orcamentos antigos.\n      linha_id?: string | null\n      linha_nome?: string | null\n      tipologia_id?: string | null\n      configuracao_preset_id?: string | null\n      configuracao_nome?: string | null\n      configuracao_validada?: boolean\n      modo_configuracao?: 'rapido' | 'assistido'\n      configuracao_status?: 'pendente' | 'preenchida' | 'validada'\n      variaveis?: Record<string, string>\n}"""
if old not in text: raise SystemExit('ItemEsquadria persistence marker not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 3) lib/orcamentos.ts — accept + persist the new snapshot.
p = Path('lib/orcamentos.ts')
text = p.read_text(encoding='utf-8')
old = """  modoOrigem?: 'manual' | 'produto'\n  produtoId?: string | null\n  precoUnit?: number | null\n}"""
new = """  modoOrigem?: 'manual' | 'produto'\n  produtoId?: string | null\n  precoUnit?: number | null\n  linhaId?: string | null\n  linhaNome?: string | null\n  tipologiaId?: string | null\n  configuracaoPresetId?: string | null\n  configuracaoNome?: string | null\n  configuracaoValidada?: boolean\n  modoConfiguracao?: 'rapido' | 'assistido'\n  configuracaoStatus?: 'pendente' | 'preenchida' | 'validada'\n  variaveis?: Record<string, string>\n}"""
if old not in text: raise SystemExit('ItemOrcamentoForm marker not found')
text = text.replace(old, new, 1)

insert_after = """    const preco_total = preco_unit != null ? preco_unit * quantidadeNum : null\n"""
extra = """    const snapshotConfiguracao = {\n      linha_id: it.linhaId || null,\n      linha_nome: it.linhaNome || null,\n      tipologia_id: it.tipologiaId || null,\n      configuracao_preset_id: it.configuracaoPresetId || null,\n      configuracao_nome: it.configuracaoNome || null,\n      configuracao_validada: Boolean(it.configuracaoValidada),\n      modo_configuracao: it.modoConfiguracao || 'rapido',\n      configuracao_status: it.configuracaoStatus || (it.configuracaoValidada ? 'validada' : 'pendente'),\n      variaveis: it.variaveis || {},\n    }\n"""
if insert_after not in text: raise SystemExit('preco_total marker not found')
text = text.replace(insert_after, insert_after + extra, 1)
# Both item object branches have preco_total, append spread after it.
text = text.replace("""        preco_unit,\n        preco_total,\n      })""", """        preco_unit,\n        preco_total,\n        ...snapshotConfiguracao,\n      })""", 1)
text = text.replace("""        preco_unit,\n        preco_total,\n      })""", """        preco_unit,\n        preco_total,\n        ...snapshotConfiguracao,\n      })""", 1)
p.write_text(text, encoding='utf-8')

# 4) Kanban: show technical snapshot to the estimator and include it in the Atlas PDF.
p = Path('components/system/KanbanPageFixed.tsx')
text = p.read_text(encoding='utf-8')
old = """if (item.folhas) { doc.text(`Folhas: ${item.folhas}`, margem + 4, y); linhaNova(5) }\n\nif (card.tipo_medida === 'final'"""
new = """if (item.folhas) { doc.text(`Folhas: ${item.folhas}`, margem + 4, y); linhaNova(5) }\nif (item.linha_nome) { doc.text(`Linha: ${item.linha_nome}`, margem + 4, y); linhaNova(5) }\nif (item.configuracao_nome) { doc.text(`Configuração: ${item.configuracao_nome}${item.configuracao_validada ? ' (validada)' : ''}`, margem + 4, y); linhaNova(5) }\nif (item.variaveis && Object.keys(item.variaveis).length > 0) {\nconst resumoVariaveis = Object.entries(item.variaveis).map(([chave, valor]) => `${chave}: ${valor}`).join(' · ')\nconst linhasVariaveis = doc.splitTextToSize(`Variáveis: ${resumoVariaveis}`, largura - 4)\ndoc.text(linhasVariaveis, margem + 4, y); linhaNova(5 * linhasVariaveis.length)\n}\n\nif (card.tipo_medida === 'final'"""
if old not in text: raise SystemExit('PDF item marker not found')
text = text.replace(old, new, 1)

old = """<input\ntype=\"text\"\nvalue={item.folhas || ''}\nonChange={e => atualizarItemEdit(item.id, 'folhas', e.target.value || null)}\nplaceholder=\"Quantidade de folhas (ex: 2 ou 2 fixas + 1 móvel)\"\nclassName=\"w-full border border-slate-300 rounded-lg p-2 text-xs\"\n/>\n<div className=\"rounded-xl border border-slate-200 bg-white p-3 space-y-3\">"""
new = """<input\ntype=\"text\"\nvalue={item.folhas || ''}\nonChange={e => atualizarItemEdit(item.id, 'folhas', e.target.value || null)}\nplaceholder=\"Quantidade de folhas (ex: 2 ou 2 fixas + 1 móvel)\"\nclassName=\"w-full border border-slate-300 rounded-lg p-2 text-xs\"\n/>\n{(item.linha_nome || item.configuracao_nome || item.tipologia_id || Object.keys(item.variaveis || {}).length > 0) && (\n<div className={`rounded-xl border p-3 text-xs ${item.configuracao_validada ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>\n<div className=\"flex flex-wrap items-center gap-2 mb-2\">\n{item.linha_nome && <span className=\"rounded-full bg-white px-2 py-1 border border-slate-200\">Linha: {item.linha_nome}</span>}\n{item.configuracao_nome && <span className=\"rounded-full bg-white px-2 py-1 border border-slate-200 font-semibold\">{item.configuracao_nome}</span>}\n<span className={`rounded-full px-2 py-1 font-semibold ${item.configuracao_status === 'validada' ? 'bg-emerald-100 text-emerald-700' : item.configuracao_status === 'preenchida' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>\n{item.configuracao_status === 'validada' ? 'Configuração validada' : item.configuracao_status === 'preenchida' ? 'Variáveis preenchidas' : 'Conferir configuração'}\n</span>\n</div>\n{Object.keys(item.variaveis || {}).length > 0 && <div className=\"grid sm:grid-cols-2 gap-1 text-slate-600\">{Object.entries(item.variaveis || {}).map(([chave, valor]) => <span key={chave}><strong>{chave.replace(/_/g, ' ')}:</strong> {String(valor).replace(/_/g, ' ')}</span>)}</div>}\n</div>\n)}\n<div className=\"rounded-xl border border-slate-200 bg-white p-3 space-y-3\">"""
if old not in text: raise SystemExit('Kanban item edit marker not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 5) Engineering home: link to the configuration library.
p = Path('app/engenharia/page.tsx')
text = p.read_text(encoding='utf-8')
old = """        <div className=\"atlas-eng-hero-status\"><CheckCircle2 size={18} /> Fluxo conectado à Medição Final</div>\n      </section>"""
new = """        <div className=\"flex flex-wrap items-center gap-2\">\n          <div className=\"atlas-eng-hero-status\"><CheckCircle2 size={18} /> Fluxo conectado à Medição Final</div>\n          <Link href=\"/engenharia/configuracoes-orcamento\" className=\"inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20\">Configurações de orçamento <ArrowRight size={15}/></Link>\n        </div>\n      </section>"""
if old not in text: raise SystemExit('Engineering hero marker not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 6) Entry screen naming: one screen now supports quick + assisted selection.
p = Path('app/orcamento/novo/page.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace('Orçamento Detalhado</span>', 'Orçamento de Esquadrias</span>', 1)
text = text.replace('Esquadria por esquadria, com medidas e fotos</span>', 'Modo rápido ou assistido, com Linha → Tipologia → Configuração</span>', 1)
p.write_text(text, encoding='utf-8')
