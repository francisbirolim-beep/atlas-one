import fs from 'node:fs'

const path = 'components/system/KanbanPageFixed.tsx'
let src = fs.readFileSync(path, 'utf8')

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Trecho não encontrado: ${label}`)
  src = src.replace(from, to)
}

replaceOnce(
`async function adicionarAnexo(file: File | undefined) {
if (!file || !novoAnexoTitulo.trim()) return
const url = await uploadArquivo(file)
if (url) {
const novo: Anexo = { titulo: novoAnexoTitulo.trim(), nome: file.name, url }
setEditando(prev => (prev ? { ...prev, anexos: [...(prev.anexos || []), novo] } : prev))
setNovoAnexoTitulo('')
}
}`,
`async function adicionarAnexo(file: File | undefined) {
if (!file || !novoAnexoTitulo.trim() || !editando) return
const titulo = novoAnexoTitulo.trim()
const url = await uploadArquivo(file)
if (!url) return

const novo: Anexo = { titulo, nome: file.name, url }
const finalizado = !!cardSelecionado?.orcamento_finalizado_em
const anexosBase = finalizado ? (cardSelecionado?.anexos || []) : (editando.anexos || [])
const anexosPersistidos = [...anexosBase, novo]

if (finalizado && cardSelecionado) {
const { error } = await supabase
.from('orcamentos')
.update({ anexos: anexosPersistidos })
.eq('id', cardSelecionado.id)

if (error) {
console.error('Erro ao salvar novo anexo no orçamento finalizado:', error)
alert('Não foi possível salvar o novo anexo. Tente novamente.')
return
}

setCardSelecionado(prev => (prev ? { ...prev, anexos: anexosPersistidos } : prev))
setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? { ...c, anexos: anexosPersistidos } : c)))
await registrarHistorico(
cardSelecionado.id,
usuario,
'Anexou nova versão/arquivo ao orçamento',
titulo + ' — ' + file.name
)
listarHistorico(cardSelecionado.id).then(setHistorico)
}

const anexosExibicao = finalizado ? normalizarVersoesLegadas(anexosPersistidos) : anexosPersistidos
setEditando(prev => (prev ? { ...prev, anexos: anexosExibicao } : prev))
setNovoAnexoTitulo('')
}`,
'persistência de anexo em orçamento finalizado'
)

replaceOnce(
`<button onClick={() => enviarAnexoVendedor(a)} className="flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0">
<Phone size={12} /> Reenviar
</button>
</div>
))}
</div>
) : (`,
`<button onClick={() => enviarAnexoVendedor(a)} className="flex items-center gap-1 text-brand-navy hover:underline flex-shrink-0">
<Phone size={12} /> Reenviar
</button>
</div>
))}

<div className="pt-3 mt-3 border-t border-slate-200 space-y-2">
<label className="block text-xs font-medium text-slate-600">Anexar novo orçamento / revisão</label>
<div className="flex items-center gap-2">
<input
type="text"
value={novoAnexoTitulo}
onChange={e => setNovoAnexoTitulo(e.target.value)}
placeholder="Título da nova versão (ex: Revisão 02)"
className="flex-1 border border-slate-300 rounded-lg p-2 text-xs text-slate-700 bg-white"
/>
<label
className={[
'flex items-center gap-1 px-2.5 py-2 border border-dashed rounded-lg text-xs flex-shrink-0',
novoAnexoTitulo.trim()
? 'border-brand-navy text-brand-navy cursor-pointer hover:bg-brand-navyLight'
: 'border-slate-200 text-slate-300'
].join(' ')}
>
<Paperclip size={13} /> Anexar
<input
type="file"
className="hidden"
disabled={!novoAnexoTitulo.trim()}
onChange={e => adicionarAnexo(e.target.files?.[0])}
/>
</label>
</div>
<p className="text-[11px] text-slate-400">O novo arquivo fica salvo no orçamento assim que o upload termina e aparece acima para abrir ou reenviar. Os anexos anteriores são preservados.</p>
</div>
</div>
) : (`,
'uploader permanente no orçamento finalizado'
)

fs.writeFileSync(path, src)
console.log('Correção do anexo permanente aplicada.')
