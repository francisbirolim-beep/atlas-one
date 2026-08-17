from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise RuntimeError(f'Trecho nao encontrado: {label} em {path}')
    p.write_text(s.replace(old, new, 1))

# 1) Metadados de exclusao logica no JSON do anexo
replace_once(
    'lib/tipos.ts',
    """export interface Anexo {
      titulo: string
      nome: string
      url: string
}
""",
    """export interface Anexo {
      titulo: string
      nome: string
      url: string
      excluido_em?: string | null
      excluido_por_id?: string | null
      excluido_por_nome?: string | null
      motivo_exclusao?: string | null
}
""",
    'interface Anexo',
)

# 2) Exclusao fisica/local vira exclusao logica persistida e auditavel
replace_once(
    'components/system/KanbanPageFixed.tsx',
    """function removerAnexo(idx: number) {
setEditando(prev => (prev ? { ...prev, anexos: (prev.anexos || []).filter((_, i) => i !== idx) } : prev))
}

async function enviarAnexoVendedor(anexo: Anexo) {
const numero = numeroWhatsApp(whatsappVendedor || vendedorInfo?.whatsapp || '')
""",
    """async function excluirAnexo(idx: number) {
if (!editando || !cardSelecionado) return
const anexo = (editando.anexos || [])[idx]
if (!anexo || anexo.excluido_em) return

const motivo = window.prompt(
`Por que o anexo \"${anexo.titulo}\" está sendo excluído? O arquivo continuará no histórico para auditoria.`
)
if (!motivo || !motivo.trim()) {
alert('É obrigatório informar o motivo da exclusão do anexo.')
return
}

const agoraIso = new Date().toISOString()
const anexosAtualizados = (editando.anexos || []).map((item, i) =>
i === idx
? {
...item,
excluido_em: agoraIso,
excluido_por_id: usuario?.id || null,
excluido_por_nome: usuario?.nome || null,
motivo_exclusao: motivo.trim(),
}
: item
)

const { error } = await supabase
.from('orcamentos')
.update({ anexos: anexosAtualizados })
.eq('id', cardSelecionado.id)

if (error) {
console.error('Erro ao excluir anexo logicamente:', error)
alert('Não foi possível registrar a exclusão do anexo. Tente novamente.')
return
}

setEditando(prev => (prev ? { ...prev, anexos: anexosAtualizados } : prev))
setCardSelecionado(prev => (prev ? { ...prev, anexos: anexosAtualizados } : prev))
setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? { ...c, anexos: anexosAtualizados } : c)))
await registrarHistorico(
cardSelecionado.id,
usuario,
'Excluiu anexo do orçamento',
`${anexo.titulo} — motivo: ${motivo.trim()}`
)
listarHistorico(cardSelecionado.id).then(setHistorico)
}

async function enviarAnexoVendedor(anexo: Anexo) {
if (anexo.excluido_em) {
alert('Este anexo está marcado como excluído e não pode ser reenviado. Ele continua disponível apenas para consulta do histórico.')
return
}
const numero = numeroWhatsApp(whatsappVendedor || vendedorInfo?.whatsapp || '')
""",
    'exclusao logica e guarda de reenvio',
)

# 3) Anexos excluidos nunca entram no envio de uma nova versao
replace_once(
    'components/system/KanbanPageFixed.tsx',
    """const anexosParaEnvio = anexosFinais.filter(a => !ehPdfOrcamentoAtlas(a) || a.url === pdfUrlAtual)
""",
    """const anexosParaEnvio = anexosFinais.filter(a => !a.excluido_em && (!ehPdfOrcamentoAtlas(a) || a.url === pdfUrlAtual))
""",
    'filtro de anexos para envio',
)

# 4) No finalizado, mostrar telefone/mensagem para reenvio e status auditavel dos anexos
old_finalizado = """{(editando.anexos || []).map((a, i) => (
<div key={i} className=\"flex items-center gap-2\">
<a href={a.url} target=\"_blank\" rel=\"noreferrer\" className=\"text-brand-navy hover:underline flex items-center gap-1 flex-1 min-w-0\">
<Paperclip size={12} className=\"flex-shrink-0\" /> <span className=\"truncate\">{a.titulo}</span> <span className=\"text-slate-400 truncate\">({a.nome})</span>
</a>
<button onClick={() => enviarAnexoVendedor(a)} className=\"flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0\">
<Phone size={12} /> Reenviar
</button>
</div>
))}

<div className=\"pt-3 mt-3 border-t border-slate-200 space-y-2\">
"""
new_finalizado = """<div className=\"pt-2 mt-2 border-t border-slate-200 space-y-2 text-slate-600\">
<p className=\"text-xs font-medium text-slate-500\">Reenviar para {vendedorInfo?.nome || 'o vendedor'}</p>
<div>
<label className=\"block text-xs text-slate-500 mb-1 flex items-center gap-1\">
<Phone size={12} /> WhatsApp do vendedor
</label>
<input
type=\"text\"
value={whatsappVendedor}
onChange={e => setWhatsappVendedor(e.target.value)}
placeholder=\"Ex: 11999998888\"
className=\"w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white\"
/>
<p className=\"text-[11px] text-slate-400 mt-1\">
{vendedorInfo?.whatsapp
? 'Preenchido automaticamente com o número cadastrado. Pode trocar por outro antes de reenviar.'
: 'Não há número cadastrado para este vendedor — informe um número antes de reenviar.'}
</p>
</div>
<div>
<label className=\"block text-xs text-slate-500 mb-1\">Mensagem do reenvio</label>
<textarea
value={mensagemVendedor}
onChange={e => setMensagemVendedor(e.target.value)}
className=\"w-full h-16 border border-slate-300 rounded-lg p-2.5 text-sm resize-none bg-white\"
/>
</div>
</div>

{(editando.anexos || []).map((a, i) => (
<div key={i} className={`rounded-lg px-2 py-1.5 ${a.excluido_em ? 'bg-red-50 border border-red-100' : ''}`}>
<div className=\"flex items-center gap-2\">
<a
href={a.url}
target=\"_blank\"
rel=\"noreferrer\"
className={`hover:underline flex items-center gap-1 flex-1 min-w-0 ${a.excluido_em ? 'text-red-500 line-through' : 'text-brand-navy'}`}
>
<Paperclip size={12} className=\"flex-shrink-0\" /> <span className=\"truncate\">{a.titulo}</span> <span className={`${a.excluido_em ? 'text-red-300' : 'text-slate-400'} truncate`}>({a.nome})</span>
</a>
{!a.excluido_em && (
<>
<button onClick={() => enviarAnexoVendedor(a)} className=\"flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0\">
<Phone size={12} /> Reenviar
</button>
<button onClick={() => excluirAnexo(i)} className=\"flex items-center gap-1 text-red-500 hover:underline flex-shrink-0\">
<Trash2 size={12} /> Excluir
</button>
</>
)}
</div>
{a.excluido_em && (
<p className=\"text-[10px] text-red-500 mt-1 pl-4\">
Excluído em {new Date(a.excluido_em).toLocaleString('pt-BR')}
{a.excluido_por_nome ? ` por ${a.excluido_por_nome}` : ''}
{a.motivo_exclusao ? ` — motivo: ${a.motivo_exclusao}` : ''}. O arquivo continua disponível para abrir.
</p>
)}
</div>
))}

<div className=\"pt-3 mt-3 border-t border-slate-200 space-y-2\">
"""
replace_once(
    'components/system/KanbanPageFixed.tsx',
    old_finalizado,
    new_finalizado,
    'lista finalizada com reenvio e auditoria',
)

# 5) A mesma regra vale para anexos durante a elaboracao
old_andamento = """{(editando.anexos || []).map((a, i) => (
<div key={i} className=\"flex items-center gap-2 text-xs text-brand-teal mb-1\">
<Paperclip size={12} className=\"flex-shrink-0\" />
<span className=\"font-medium truncate\">{a.titulo}</span>
<a href={a.url} target=\"_blank\" rel=\"noreferrer\" className=\"text-brand-navy hover:underline flex-shrink-0\">
ver
</a>
<button onClick={() => enviarAnexoVendedor(a)} className=\"flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0\">
<Phone size={12} /> Enviar
</button>
<button onClick={() => removerAnexo(i)} className=\"text-red-400 hover:text-red-600 flex-shrink-0\">
<Trash2 size={12} />
</button>
</div>
))}
"""
new_andamento = """{(editando.anexos || []).map((a, i) => (
<div key={i} className={`text-xs mb-1 rounded-lg px-2 py-1.5 ${a.excluido_em ? 'bg-red-50 border border-red-100 text-red-500' : 'text-brand-teal'}`}>
<div className=\"flex items-center gap-2\">
<Paperclip size={12} className=\"flex-shrink-0\" />
<span className={`font-medium truncate ${a.excluido_em ? 'line-through' : ''}`}>{a.titulo}</span>
<a href={a.url} target=\"_blank\" rel=\"noreferrer\" className={`${a.excluido_em ? 'text-red-500' : 'text-brand-navy'} hover:underline flex-shrink-0`}>
ver
</a>
{!a.excluido_em && (
<>
<button onClick={() => enviarAnexoVendedor(a)} className=\"flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0\">
<Phone size={12} /> Enviar
</button>
<button onClick={() => excluirAnexo(i)} className=\"flex items-center gap-1 text-red-500 hover:text-red-600 flex-shrink-0\">
<Trash2 size={12} /> Excluir
</button>
</>
)}
</div>
{a.excluido_em && (
<p className=\"text-[10px] text-red-500 mt-1 pl-4\">
Excluído em {new Date(a.excluido_em).toLocaleString('pt-BR')}
{a.excluido_por_nome ? ` por ${a.excluido_por_nome}` : ''}
{a.motivo_exclusao ? ` — motivo: ${a.motivo_exclusao}` : ''}. O arquivo continua disponível para abrir.
</p>
)}
</div>
))}
"""
replace_once(
    'components/system/KanbanPageFixed.tsx',
    old_andamento,
    new_andamento,
    'lista em andamento com exclusao logica',
)

print('Patch de anexos/auditoria aplicado com sucesso.')
