'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, X, Phone, MapPin, Camera, FileText, User, Building2, Clock, Play, Paperclip, CheckCircle2, Search, Wrench } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarTipologias } from '@/lib/tipologias'
import { KanbanColuna, OrcamentoRapido, ItemEsquadria, TipoEsquadria, HistoricoItem, Usuario, Anexo, Tipologia } from '@/lib/tipos'
import { listarColunas, criarColuna, renomearColuna, excluirColuna, moverCard, excluirOrcamento } from '@/lib/kanban'
import { executarAutomacoesColuna } from '@/lib/automacoes'
import { verificarDuplicatasAutomacaoSetor } from '@/lib/automacoesSetor'
import { usuarioAtual } from '@/lib/auth'
import { registrarHistorico, listarHistorico } from '@/lib/historico'
import { uploadFoto, uploadArquivo } from '@/lib/upload'
import { corTextoParaFundo } from '@/lib/cor'
import { lerCorAssistencia } from '@/lib/configGeral'
import { bateBusca } from '@/lib/texto'
import { v4 as uuidv4 } from 'uuid'
import { jsPDF } from 'jspdf'

let tipoLabels: Record<string, string> = {}

function novoItemEdit(): ItemEsquadria {
return { id: uuidv4(), tipo_esquadria: 'porta_correr', largura_mm: 0, altura_mm: 0, quantidade: 1 }
}

function fotosGeraisDoItem(item: ItemEsquadria): string[] {
const fotosMedida = new Set(
[item.foto_larguras_url, item.foto_alturas_url].filter(Boolean) as string[]
)
const fotosGerais = [
...(item.foto_urls || []),
item.foto_url,
].filter(Boolean) as string[]
return Array.from(new Set(fotosGerais)).filter(url => !fotosMedida.has(url))
}

function formatarDuracao(inicioIso: string, fimIso: string): string {
const ms = Math.max(0, new Date(fimIso).getTime() - new Date(inicioIso).getTime())
const totalMin = Math.floor(ms / 60000)
const h = Math.floor(totalMin / 60)
const m = totalMin % 60
if (h === 0) return `${m}min`
return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

function mensagemPadraoVendedor(card: OrcamentoRapido): string {
return `Olá! O orçamento de ${card.cliente_nome || 'cliente'} está pronto. Segue em anexo.`
}

function numeroWhatsApp(raw: string): string {
const digitos = raw.replace(/\D/g, '')
if (!digitos) return ''
return digitos.startsWith('55') ? digitos : `55${digitos}`
}

const acabamentoLabelsPdf: Record<string, string> = {
preto: 'Preto',
branco: 'Branco',
madeirado: 'Amadeirado',
outro: 'Outra cor',
}

function gerarPdfOrcamento(card: OrcamentoRapido): Blob {
const doc = new jsPDF({ unit: 'mm', format: 'a4' })
const margem = 15
const largura = 210 - margem * 2
let y = margem

function linhaNova(altura = 6) {
y += altura
if (y > 280) {
doc.addPage()
y = margem
}
}

doc.setFontSize(16)
doc.setFont('helvetica', 'bold')
doc.text('Esquadrifácio — Orçamento', margem, y)
linhaNova(10)

doc.setFontSize(10)
doc.setFont('helvetica', 'normal')
doc.setTextColor(100)
doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, y)
doc.setTextColor(0)
linhaNova(10)

doc.setFontSize(12)
doc.setFont('helvetica', 'bold')
doc.text('Cliente', margem, y)
linhaNova(6)
doc.setFontSize(10)
doc.setFont('helvetica', 'normal')
doc.text(`Nome: ${card.cliente_nome || '-'}`, margem, y)
linhaNova()
if (card.cliente_whatsapp) { doc.text(`WhatsApp: ${card.cliente_whatsapp}`, margem, y); linhaNova() }
if (card.cidade) { doc.text(`Cidade: ${card.cidade}`, margem, y); linhaNova() }
if (card.arquiteto_nome) { doc.text(`Arquiteto/Engenheiro: ${card.arquiteto_nome}${card.arquiteto_contato ? ' — ' + card.arquiteto_contato : ''}`, margem, y); linhaNova() }
linhaNova(4)

doc.setFontSize(12)
doc.setFont('helvetica', 'bold')
doc.text('Especificações', margem, y)
linhaNova(6)
doc.setFontSize(10)
doc.setFont('helvetica', 'normal')
const acabLabel = card.acabamento === 'outro' ? (card.acabamento_outro_texto || 'Outra cor') : (acabamentoLabelsPdf[card.acabamento || ''] || '-')
doc.text(`Cor/Acabamento: ${acabLabel}`, margem, y)
linhaNova()
if (card.contramarco) { doc.text(`Contramarco: ${card.contramarco === 'com' ? 'Com contramarco' : 'Sem contramarco'}`, margem, y); linhaNova() }
if (card.tipo_medida) { doc.text(`Tipo de medida: ${card.tipo_medida === 'final' ? 'Medida final' : 'Orçamento comum'}`, margem, y); linhaNova() }
linhaNova(4)

doc.setFontSize(12)
doc.setFont('helvetica', 'bold')
doc.text('Esquadrias', margem, y)
linhaNova(7)

const itens = card.itens || []
itens.forEach((item, i) => {
if (y > 260) { doc.addPage(); y = margem }
doc.setFontSize(10)
doc.setFont('helvetica', 'bold')
const tituloTipo = item.tipo_esquadria === 'outro' ? (item.tipo_outro_texto || 'Outro') : (tipoLabels[item.tipo_esquadria] || item.tipo_esquadria)
doc.text(`${i + 1}. ${tituloTipo}${item.quantidade > 1 ? ` (x${item.quantidade})` : ''}`, margem, y)
linhaNova(5.5)
doc.setFont('helvetica', 'normal')
doc.setFontSize(9.5)

if (item.ambiente) { doc.text(`Ambiente: ${item.ambiente}`, margem + 4, y); linhaNova(5) }
if (item.folhas) { doc.text(`Folhas: ${item.folhas}`, margem + 4, y); linhaNova(5) }

if (card.tipo_medida === 'final' && (item.largura_baixo_mm || item.largura_meio_mm || item.largura_cima_mm)) {
doc.text(
`Larguras (mm) — baixo: ${item.largura_baixo_mm ?? '-'} | meio: ${item.largura_meio_mm ?? '-'} | cima: ${item.largura_cima_mm ?? '-'}`,
margem + 4, y
)
linhaNova(5)
doc.text(
`Alturas (mm) — direita: ${item.altura_direita_mm ?? '-'} | meio: ${item.altura_meio_mm ?? '-'} | esquerda: ${item.altura_esquerda_mm ?? '-'}`,
margem + 4, y
)
linhaNova(5)
} else {
doc.text(`Medidas: ${item.largura_mm || '-'}mm x ${item.altura_mm || '-'}mm`, margem + 4, y)
linhaNova(5)
}

if (item.preco_unit != null) {
doc.text(
`Produto cadastrado: preço unitário R$ ${item.preco_unit.toFixed(2)}${item.preco_total != null ? ` — total R$ ${item.preco_total.toFixed(2)}` : ''}`,
margem + 4, y
)
linhaNova(5)
}

if (item.cor) { doc.text(`Cor: ${item.cor}`, margem + 4, y); linhaNova(5) }
if (item.descricao) {
const linhas = doc.splitTextToSize(`Observação: ${item.descricao}`, largura - 4)
doc.text(linhas, margem + 4, y)
linhaNova(5 * linhas.length)
}
linhaNova(2)
})

linhaNova(2)
doc.setFontSize(12)
doc.setFont('helvetica', 'bold')
doc.text(`Valor total: R$ ${(card.valor_estimado ?? 0).toFixed(2)}`, margem, y)

return doc.output('blob')
}

export default function Kanban() {
const router = useRouter()
const [colunas, setColunas] = useState<KanbanColuna[]>([])
const [cards, setCards] = useState<OrcamentoRapido[]>([])
const [carregando, setCarregando] = useState(true)
const [cardSelecionado, setCardSelecionado] = useState<OrcamentoRapido | null>(null)
const [editando, setEditando] = useState<OrcamentoRapido | null>(null)
const [historico, setHistorico] = useState<HistoricoItem[]>([])
const [salvando, setSalvando] = useState(false)
const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
const [usuario, setUsuario] = useState<Usuario | null>(null)
const [agora, setAgora] = useState(Date.now())
const [novoAnexoTitulo, setNovoAnexoTitulo] = useState('')
const [sessaoAtiva, setSessaoAtiva] = useState(false)
const [vendedorInfo, setVendedorInfo] = useState<Usuario | null>(null)
const [whatsappVendedor, setWhatsappVendedor] = useState('')
const [mensagemVendedor, setMensagemVendedor] = useState('')
const [busca, setBusca] = useState('')
const [filtroData, setFiltroData] = useState('')
const [filtroTemperatura, setFiltroTemperatura] = useState('')
const [corAssistencia, setCorAssistencia] = useState('#8b5cf6')
const [tiposVersao, setTiposVersao] = useState(0)

useEffect(() => {
carregar()
usuarioAtual().then(setUsuario)
lerCorAssistencia().then(setCorAssistencia)
listarTipologias().then(list => {
tipoLabels = Object.fromEntries(list.map(tp => [tp.chave, tp.label]))
setTiposVersao(v => v + 1)
})
const t = setInterval(() => setAgora(Date.now()), 60000)
return () => clearInterval(t)
}, [])

async function carregar() {
setCarregando(true)
const [cols, { data: orc }] = await Promise.all([
listarColunas(),
supabase
.from('orcamentos')
.select('*')
.order('created_at', { ascending: false }),
])
setColunas(cols)
if (orc) {
const lista = orc as OrcamentoRapido[]
setCards(lista)
if (typeof window !== 'undefined') {
const idAlvo = new URLSearchParams(window.location.search).get('orcamento')
if (idAlvo) {
const alvo = lista.find(c => c.id === idAlvo)
if (alvo) abrirCard(alvo)
}
}
}
setCarregando(false)
}

function passaFiltro(c: OrcamentoRapido): boolean {
if (busca.trim()) {
const bate = bateBusca(
  busca,
  c.cliente_nome,
  c.cidade,
  c.arquiteto_nome,
  c.criado_por_nome,
  c.cliente_whatsapp,
  tipoLabels[c.tipo_esquadria] || c.tipo_esquadria || ''
)
if (!bate) return false
}
if (filtroData) {
const d = new Date(c.created_at)
const dataCard = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
if (dataCard !== filtroData) return false
}
if (filtroTemperatura && c.temperatura !== filtroTemperatura) return false
return true
}

const temperaturaInfo: Record<string, { emoji: string; label: string; texto: string; fundo: string; borda: string }> = {
quente: { emoji: '🔥', label: 'Quente', texto: 'text-red-600', fundo: 'bg-red-50', borda: 'border-red-500' },
morno: { emoji: '🌤️', label: 'Morno', texto: 'text-amber-600', fundo: 'bg-amber-50', borda: 'border-amber-500' },
frio: { emoji: '❄️', label: 'Frio', texto: 'text-blue-600', fundo: 'bg-blue-50', borda: 'border-blue-500' },
}

function cardsDaColuna(colunaId: string, index: number) {
return cards
.filter(c => (c.coluna_id || colunas[0]?.id) === colunaId || (!c.coluna_id && index === 0))
.filter(passaFiltro)
}

function estiloCard(card: OrcamentoRapido, coluna: KanbanColuna | undefined): { fundo: string; texto: string; alerta: boolean } | null {
if (card.eh_assistencia) {
return { fundo: corAssistencia, texto: corTextoParaFundo(corAssistencia), alerta: false }
}
if (!coluna) return null
const base = card.coluna_atualizada_em || card.created_at
if (base) {
const horas = (agora - new Date(base).getTime()) / 3600000
if (coluna.sla_vermelho_horas != null && horas >= coluna.sla_vermelho_horas) {
const cor = coluna.sla_vermelho_cor || '#ef4444'
return { fundo: cor, texto: corTextoParaFundo(cor), alerta: true }
}
if (coluna.sla_amarelo_horas != null && horas >= coluna.sla_amarelo_horas) {
const cor = coluna.sla_amarelo_cor || '#f59e0b'
return { fundo: cor, texto: corTextoParaFundo(cor), alerta: true }
}
}
if (coluna.cor_cards) {
return { fundo: coluna.cor_cards, texto: corTextoParaFundo(coluna.cor_cards), alerta: false }
}
return null
}

async function handleDrop(e: React.DragEvent, colunaId: string) {
e.preventDefault()
setColunaArrastando(null)
const cardId = e.dataTransfer.getData('text/plain')
if (!cardId) return
const card = cards.find(c => c.id === cardId)
if (card?.eh_assistencia) return
const colunaAnterior = colunas.find(c => c.id === (card?.coluna_id || colunas[0]?.id))
const colunaNova = colunas.find(c => c.id === colunaId)
const agoraIso = new Date().toISOString()
setCards(prev => prev.map(c => (c.id === cardId ? { ...c, coluna_id: colunaId, coluna_atualizada_em: agoraIso } : c)))
let decisoesAutomacao: Record<string, 'substituir' | 'duplicar'> | undefined
  const duplicatasSetor = await verificarDuplicatasAutomacaoSetor(colunaId, cardId)
  if (duplicatasSetor.length > 0) {
    decisoesAutomacao = {}
    for (const d of duplicatasSetor) {
      const substituir = window.confirm(`Já existe um card deste orçamento no setor "${d.setorNome}".\n\nOK = substituir o card existente\nCancelar = criar um novo card`)
      decisoesAutomacao[d.setorId] = substituir ? 'substituir' : 'duplicar'
    }
  }
  await moverCard(cardId, colunaId, decisoesAutomacao)
if (colunaAnterior?.id !== colunaNova?.id) {
registrarHistorico(cardId, usuario, 'Moveu no painel', `${colunaAnterior?.nome || '—'} → ${colunaNova?.nome || '—'}`)
}
}

function abrirCardOuAssistencia(card: OrcamentoRapido) {
if (card.eh_assistencia) {
router.push('/assistencias')
return
}
abrirCard(card)
}

async function novaColuna() {
const nome = window.prompt('Nome da nova coluna:')
if (!nome || !nome.trim()) return
const col = await criarColuna(nome.trim())
if (col) setColunas(prev => [...prev, col])
}

async function editarColuna(col: KanbanColuna) {
const novoNome = window.prompt('Renomear coluna:', col.nome)
if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
const ok = await renomearColuna(col.id, novoNome.trim())
if (ok) setColunas(prev => prev.map(c => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
}

async function apagarColuna(col: KanbanColuna) {
if (colunas.length <= 1) {
alert('Precisa ter pelo menos uma coluna.')
return
}
const outras = colunas.filter(c => c.id !== col.id)
const destino = outras[0]
const qtd = cards.filter(c => (c.coluna_id || colunas[0]?.id) === col.id).length
const msg = qtd > 0
? `Essa coluna tem ${qtd} card(s). Eles vão pra coluna "${destino.nome}". Apagar mesmo assim?`
: `Apagar a coluna "${col.nome}"?`
if (!window.confirm(msg)) return

const ok = await excluirColuna(col.id, destino.id)
if (ok) {
setColunas(prev => prev.filter(c => c.id !== col.id))
setCards(prev => prev.map(c => (c.coluna_id === col.id ? { ...c, coluna_id: destino.id } : c)))
}
}

function abrirCard(card: OrcamentoRapido) {
const itensComFoto = card.itens ? card.itens.map(it => {
const fotosExistentes = [
...(it.foto_urls || []),
it.foto_url,
it.foto_larguras_url,
it.foto_alturas_url,
].filter(Boolean) as string[]
const fotosUnicas = Array.from(new Set(fotosExistentes))
return {
...it,
foto_url: it.foto_url || fotosUnicas[0] || null,
foto_urls: fotosUnicas,
}
}) : []
setCardSelecionado(card)
setEditando({ ...card, itens: itensComFoto })
setNovoAnexoTitulo('')
setSessaoAtiva(false)
setVendedorInfo(null)
setWhatsappVendedor('')
setMensagemVendedor(mensagemPadraoVendedor(card))
listarHistorico(card.id).then(setHistorico)
if (card.criado_por_id) {
supabase
.from('usuarios')
.select('*')
.eq('id', card.criado_por_id)
.maybeSingle()
.then(({ data }) => {
if (data) {
const v = data as Usuario
setVendedorInfo(v)
setWhatsappVendedor(v.whatsapp || '')
}
})
}
}

function atualizarCampo(campo: keyof OrcamentoRapido, valor: any) {
setEditando(prev => (prev ? { ...prev, [campo]: valor } : prev))
}

function atualizarItemEdit(id: string, campo: keyof ItemEsquadria, valor: any) {
setEditando(prev =>
prev ? { ...prev, itens: (prev.itens || []).map(it => (it.id === id ? { ...it, [campo]: valor } : it)) } : prev
)
}

function adicionarItemEdit() {
setEditando(prev => (prev ? { ...prev, itens: [...(prev.itens || []), novoItemEdit()] } : prev))
}

function removerItemEdit(id: string) {
setEditando(prev => (prev ? { ...prev, itens: (prev.itens || []).filter(it => it.id !== id) } : prev))
}

async function adicionarFotosItem(id: string, files: FileList | null) {
const arquivos = Array.from(files || [])
if (arquivos.length === 0) return
const urls = (await Promise.all(arquivos.map(file => uploadFoto(file)))).filter(Boolean) as string[]
if (urls.length === 0) return
setEditando(prev =>
prev ? {
...prev,
itens: (prev.itens || []).map(it => {
if (it.id !== id) return it
const todas = Array.from(new Set([...fotosGeraisDoItem(it), ...urls]))
return { ...it, foto_url: todas[0] || it.foto_url || null, foto_urls: todas }
}),
} : prev
)
}

async function iniciarOrcamento() {
if (!cardSelecionado) return
const agoraIso = new Date().toISOString()
const { error } = await supabase
.from('orcamentos')
.update({ orcamento_iniciado_em: agoraIso })
.eq('id', cardSelecionado.id)
if (!error) {
setEditando(prev => (prev ? { ...prev, orcamento_iniciado_em: agoraIso } : prev))
setCardSelecionado(prev => (prev ? { ...prev, orcamento_iniciado_em: agoraIso } : prev))
setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? { ...c, orcamento_iniciado_em: agoraIso } : c)))
setSessaoAtiva(true)
await registrarHistorico(cardSelecionado.id, usuario, 'Iniciou o orçamento')
}
}

async function retornarOrcamento() {
if (!cardSelecionado) return
setSessaoAtiva(true)
await registrarHistorico(cardSelecionado.id, usuario, 'Retomou o orçamento')
listarHistorico(cardSelecionado.id).then(setHistorico)
}

async function adicionarAnexo(file: File | undefined) {
if (!file || !novoAnexoTitulo.trim()) return
const url = await uploadArquivo(file)
if (url) {
const novo: Anexo = { titulo: novoAnexoTitulo.trim(), nome: file.name, url }
setEditando(prev => (prev ? { ...prev, anexos: [...(prev.anexos || []), novo] } : prev))
setNovoAnexoTitulo('')
}
}

function removerAnexo(idx: number) {
setEditando(prev => (prev ? { ...prev, anexos: (prev.anexos || []).filter((_, i) => i !== idx) } : prev))
}

async function finalizarOrcamento() {
if (!cardSelecionado || !editando) return
if (editando.valor_estimado == null) {
alert('Informe o valor total do orçamento antes de finalizar.')
return
}
const numero = numeroWhatsApp(whatsappVendedor)
if (!numero) {
alert('Informe o WhatsApp do vendedor para enviar o orçamento antes de finalizar.')
return
}

setSalvando(true)
const agoraIso = new Date().toISOString()

const colunaFeito =
colunas.find(c => c.nome.trim().toLowerCase() === 'orçamento feito') ||
colunas.find(c => c.nome.trim().toLowerCase().includes('feito'))
const novaColunaId = colunaFeito ? colunaFeito.id : editando.coluna_id

let anexosFinais = editando.anexos || []
let pdfFile: File | null = null
const nomeArquivoPdf = `orcamento-${(editando.cliente_nome || 'cliente').trim().replace(/\s+/g, '-').toLowerCase()}.pdf`
try {
const pdfBlob = gerarPdfOrcamento(editando)
pdfFile = new File([pdfBlob], nomeArquivoPdf, { type: 'application/pdf' })
} catch (e) {
console.error('Erro ao gerar PDF do orçamento:', e)
}

const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
const podeCompartilharArquivo = !!(pdfFile && nav?.canShare && nav.canShare({ files: [pdfFile] }))
let compartilhouArquivo = false
if (podeCompartilharArquivo && pdfFile) {
try {
await nav.share({
files: [pdfFile],
title: `Orçamento - ${editando.cliente_nome}`,
text: mensagemVendedor,
})
compartilhouArquivo = true
} catch (e) {
console.log('Compartilhamento do PDF cancelado ou indisponível:', e)
}
}

if (pdfFile) {
try {
const pdfUrl = await uploadArquivo(pdfFile)
if (pdfUrl) {
anexosFinais = [...anexosFinais, { titulo: 'Orçamento (PDF)', nome: nomeArquivoPdf, url: pdfUrl }]
}
} catch (e) {
console.error('Erro ao salvar PDF do orçamento:', e)
}
}

const { error } = await supabase
.from('orcamentos')
.update({
anexos: anexosFinais,
valor_estimado: editando.valor_estimado,
orcamento_finalizado_em: agoraIso,
enviado_vendedor_em: agoraIso,
coluna_id: novaColunaId,
coluna_atualizada_em: colunaFeito ? agoraIso : editando.coluna_atualizada_em,
status: 'enviado',
})
.eq('id', cardSelecionado.id)
setSalvando(false)
if (!error) {
if (colunaFeito && editando.coluna_id !== colunaFeito.id) {
executarAutomacoesColuna(colunaFeito.id, {
cliente_nome: editando.cliente_nome,
criado_por_id: editando.criado_por_id,
}).catch(() => {})
}
if (!compartilhouArquivo) {
const linksAnexos = anexosFinais.map(a => `${a.titulo}: ${a.url}`).join('\n')
const textoCompleto = `${mensagemVendedor}\n\n${linksAnexos}`
window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoCompleto)}`, '_blank')
}

const duracao = editando.orcamento_iniciado_em ? formatarDuracao(editando.orcamento_iniciado_em, agoraIso) : null
const atualizado = {
...editando,
anexos: anexosFinais,
orcamento_finalizado_em: agoraIso,
enviado_vendedor_em: agoraIso,
coluna_id: novaColunaId,
coluna_atualizada_em: colunaFeito ? agoraIso : editando.coluna_atualizada_em,
status: 'enviado' as const,
}
setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? atualizado : c)))
await registrarHistorico(
cardSelecionado.id,
usuario,
'Enviou o orçamento para o vendedor e finalizou',
`${duracao ? `Levou ${duracao}. ` : ''}Para ${vendedorInfo?.nome || 'vendedor'} — "${mensagemVendedor}"`
)
setCardSelecionado(null)
setEditando(null)
}
}

async function excluirCard() {
if (!cardSelecionado) return
if (!window.confirm(`Excluir o orçamento de ${cardSelecionado.cliente_nome}? Essa ação não pode ser desfeita.`)) return
const ok = await excluirOrcamento(cardSelecionado.id)
if (ok) {
setCards(prev => prev.filter(c => c.id !== cardSelecionado.id))
setCardSelecionado(null)
setEditando(null)
}
}

function tentarFechar() {
if (editando?.orcamento_iniciado_em && !editando?.orcamento_finalizado_em && sessaoAtiva) {
const motivo = window.prompt(
'Você iniciou esse orçamento e ainda não finalizou. Por que está saindo agora? (fica registrado no histórico)'
)
if (!motivo || !motivo.trim()) {
alert('Precisa informar o motivo pra sair sem finalizar.')
return
}
const duracao = formatarDuracao(editando.orcamento_iniciado_em || '', new Date().toISOString())
if (cardSelecionado) {
registrarHistorico(cardSelecionado.id, usuario, 'Saiu sem finalizar o orçamento', `${motivo.trim()} — ficou aberto ${duracao}`)
}
}
setCardSelecionado(null)
setEditando(null)
setSessaoAtiva(false)
setVendedorInfo(null)
setWhatsappVendedor('')
setMensagemVendedor('')
}

function resumoMudancas(original: OrcamentoRapido, novo: OrcamentoRapido): string {
const partes: string[] = []
if (original.cliente_nome !== novo.cliente_nome) partes.push('nome')
if (original.cidade !== novo.cidade) partes.push('cidade')
if (original.acabamento !== novo.acabamento) partes.push('cor')
if (original.contramarco !== novo.contramarco) partes.push('contramarco')
if (original.tipo_medida !== novo.tipo_medida) partes.push('tipo de medida')
if (original.temperatura !== novo.temperatura) partes.push('temperatura')
if (original.arquiteto_nome !== novo.arquiteto_nome) partes.push('arquiteto/engenheiro')
if (original.valor_estimado !== novo.valor_estimado) partes.push('valor')
if (original.coluna_id !== novo.coluna_id) partes.push('coluna')
if ((original.itens?.length || 0) !== (novo.itens?.length || 0)) partes.push('esquadrias (quantidade)')
else if (JSON.stringify(original.itens) !== JSON.stringify(novo.itens)) partes.push('esquadrias (dados)')
return partes.length > 0 ? `Alterou: ${partes.join(', ')}` : 'Salvou sem mudanças'
}

async function salvarCard() {
if (!editando || !cardSelecionado) return
setSalvando(true)

const colunaAnterior = cardSelecionado.coluna_id
const mudouColuna = colunaAnterior !== editando.coluna_id

const { error } = await supabase
.from('orcamentos')
.update({
cliente_nome: editando.cliente_nome,
cliente_whatsapp: editando.cliente_whatsapp,
cidade: editando.cidade,
acabamento: editando.acabamento,
acabamento_outro_texto: editando.acabamento === 'outro' ? editando.acabamento_outro_texto : null,
contramarco: editando.contramarco,
tipo_medida: editando.tipo_medida,
temperatura: editando.temperatura,
arquiteto_nome: editando.arquiteto_nome,
arquiteto_contato: editando.arquiteto_contato,
itens: editando.itens,
valor_estimado: editando.valor_estimado,
coluna_id: editando.coluna_id,
coluna_atualizada_em: mudouColuna ? new Date().toISOString() : cardSelecionado.coluna_atualizada_em,
})
.eq('id', cardSelecionado.id)

setSalvando(false)
if (!error) {
if (mudouColuna && editando.coluna_id) {
executarAutomacoesColuna(editando.coluna_id, {
cliente_nome: editando.cliente_nome,
criado_por_id: editando.criado_por_id,
}).catch(() => {})
}
const atualizado = {
...editando,
coluna_atualizada_em: mudouColuna ? new Date().toISOString() : cardSelecionado.coluna_atualizada_em,
}
setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? atualizado : c)))
const resumo = resumoMudancas(cardSelecionado, editando)
await registrarHistorico(cardSelecionado.id, usuario, 'Editou o orçamento', resumo)
setCardSelecionado(null)
setEditando(null)
}
}

if (carregando) {
return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
}

// Na primeira coluna, todo pedido precisa passar por "Iniciar orçamento" antes
// de liberar os detalhes para edição, inclusive quando quem abriu foi o criador.
const naPrimeiraColuna = !!editando && (editando.coluna_id || colunas[0]?.id) === colunas[0]?.id
const podeEditarSemIniciar = false

return (
<div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
<header className="bg-white border-b border-slate-200">
<div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
<Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
<ArrowLeft size={20} />
</Link>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
<div>
<h1 className="text-lg font-bold text-slate-800">Painel de Orçamentos</h1>
<p className="text-sm text-slate-500">Arraste os cards entre as colunas</p>
</div>
</div>
</header>

<main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
<div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-4">
<div className="relative w-full flex-1 min-w-0 sm:min-w-[220px]">
<Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
<input
type="text"
value={busca}
onChange={e => setBusca(e.target.value)}
placeholder="Buscar por cliente, cidade, arquiteto, vendedor, tipo..."
className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
/>
</div>
<input
type="date"
value={filtroData}
onChange={e => setFiltroData(e.target.value)}
className="w-full sm:w-auto border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
/>
<select
value={filtroTemperatura}
onChange={e => setFiltroTemperatura(e.target.value)}
className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
>
<option value="">Todas temperaturas</option>
<option value="quente">🔥 Quente</option>
<option value="morno">🌤️ Morno</option>
<option value="frio">❄️ Frio</option>
</select>
{(busca || filtroData || filtroTemperatura) && (
<button
onClick={() => { setBusca(''); setFiltroData(''); setFiltroTemperatura('') }}
className="text-xs text-slate-400 hover:text-slate-600 px-2"
>
Limpar filtros
</button>
)}
</div>

<div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:gap-4 sm:px-0">
{colunas.map((col, index) => {
const cardsColuna = cardsDaColuna(col.id, index)
return (
<div
key={col.id}
onDragOver={e => { e.preventDefault(); setColunaArrastando(col.id) }}
onDragLeave={() => setColunaArrastando(null)}
onDrop={e => handleDrop(e, col.id)}
className={`flex-shrink-0 w-[86vw] max-w-72 snap-start bg-slate-100 rounded-2xl p-3 transition ${
colunaArrastando === col.id ? 'ring-2 ring-brand-navy bg-brand-navyLight' : ''
}`}
>
<div className="flex items-center justify-between mb-3 px-1">
<div className="flex items-center gap-2">
<h3 className="font-medium text-slate-700 text-sm">{col.nome}</h3>
<span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
{cardsColuna.length}
</span>
</div>
<div className="flex items-center gap-1">
<button onClick={() => editarColuna(col)} className="p-1 text-slate-400 hover:text-slate-600">
<Pencil size={13} />
</button>
<button onClick={() => apagarColuna(col)} className="p-1 text-slate-400 hover:text-red-500">
<Trash2 size={13} />
</button>
</div>
</div>

<div className="space-y-2 min-h-[80px]">
{cardsColuna.map(card => {
const est = estiloCard(card, col)
return (
<div
key={card.id}
draggable={!card.eh_assistencia}
onDragStart={e => e.dataTransfer.setData('text/plain', card.id)}
onClick={() => abrirCardOuAssistencia(card)}
style={est ? { backgroundColor: est.fundo, borderColor: est.fundo } : undefined}
className={`rounded-xl border-2 p-3 cursor-pointer hover:shadow-md transition ${
est ? (est.alerta ? 'shadow-md' : 'shadow-sm') : 'bg-white border-slate-200'
}`}
>
<div className="flex items-center gap-2 mb-1">
<div
className="p-1 rounded"
style={est ? { backgroundColor: 'rgba(255,255,255,0.3)' } : undefined}
>
{card.eh_assistencia
? <Wrench size={12} style={{ color: est ? est.texto : '#8b5cf6' }} />
: (card as any).modo_entrada === 'detalhado'
? <Camera size={12} style={{ color: est ? est.texto : '#059669' }} />
: <FileText size={12} style={{ color: est ? est.texto : '#2563eb' }} />}
</div>
<p className="font-medium text-sm truncate flex-1" style={{ color: est ? est.texto : '#1e293b' }}>
{card.cliente_nome}
</p>
{card.temperatura && temperaturaInfo[card.temperatura] && (
<span className="text-xs flex-shrink-0" title={temperaturaInfo[card.temperatura].label}>
{temperaturaInfo[card.temperatura].emoji}
</span>
)}
</div>
{card.eh_assistencia ? (
<>
<span
className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1"
style={{ backgroundColor: 'rgba(255,255,255,0.35)', color: est ? est.texto : '#8b5cf6' }}
>
Assistência
</span>
{card.descricao_livre && (
<p className="text-xs line-clamp-2" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.9 : 1 }}>
{card.descricao_livre}
</p>
)}
</>
) : (
<>
<p className="text-xs mb-1" style={{ color: est ? est.texto : '#64748b', opacity: est ? 0.9 : 1 }}>
{(card as any).itens?.length > 1
? `${(card as any).itens.length} esquadrias`
: `${tipoLabels[card.tipo_esquadria] || card.tipo_esquadria}${card.largura_mm ? ` — ${card.largura_mm}×${card.altura_mm}mm` : ''}`}
</p>
{card.descricao_livre && (
<p className="text-xs line-clamp-2" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.8 : 1 }}>
{card.descricao_livre}
</p>
)}
</>
)}
{card.criado_por_nome && (
<p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.85 : 1 }}>
<User size={11} /> {card.criado_por_nome}
</p>
)}
{!card.eh_assistencia && card.valor_estimado != null && (
<p className="text-xs font-semibold mt-1" style={{ color: est ? est.texto : '#059669' }}>
R$ {card.valor_estimado.toFixed(2)}
</p>
)}
{!card.eh_assistencia && (card.orcamento_finalizado_em && card.orcamento_iniciado_em ? (
<p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.85 : 1 }}>
<Clock size={11} /> Levou {formatarDuracao(card.orcamento_iniciado_em, card.orcamento_finalizado_em)}
</p>
) : card.orcamento_iniciado_em ? (
<p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#6366f1', opacity: est ? 0.9 : 1 }}>
<Play size={11} /> Em andamento
</p>
) : null)}
</div>
)
})}
</div>
</div>
)
})}

<button
onClick={novaColuna}
className="flex-shrink-0 w-[86vw] max-w-72 snap-start h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-navy hover:text-brand-navy transition"
>
<Plus size={16} /> Nova coluna
</button>
</div>
</main>

{cardSelecionado && editando && (
<div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
<div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto">
<div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
<h3 className="font-bold text-slate-800">Editar orçamento</h3>
<button onClick={tentarFechar} className="p-1 text-slate-400 hover:text-slate-600">
<X size={18} />
</button>
</div>

<div className="p-5 space-y-4">
{naPrimeiraColuna && !sessaoAtiva && !podeEditarSemIniciar ? (
<div className="text-center py-10 space-y-4">
<p className="text-xs text-slate-400 uppercase tracking-wide">Cliente</p>
<p className="text-2xl font-bold text-slate-800">{cardSelecionado.cliente_nome}</p>
{editando.orcamento_iniciado_em && (
<p className="text-xs text-brand-navy">
Em andamento há {formatarDuracao(editando.orcamento_iniciado_em, new Date(agora).toISOString())}
</p>
)}
<button
onClick={editando.orcamento_iniciado_em ? retornarOrcamento : iniciarOrcamento}
className="w-full py-3 flex items-center justify-center gap-2 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition"
>
<Play size={16} /> {editando.orcamento_iniciado_em ? 'Retornar orçamento' : 'Iniciar orçamento'}
</button>
<p className="text-xs text-slate-400">
{editando.orcamento_iniciado_em
? 'Clique para continuar de onde parou.'
: 'Os detalhes do pedido liberam depois de iniciar.'}
</p>
{usuario?.role === 'master' && (
<button
onClick={excluirCard}
className="w-full py-2 flex items-center justify-center gap-1.5 text-red-500 text-xs font-medium hover:bg-red-50 rounded-lg transition"
>
<Trash2 size={13} /> Excluir este orçamento
</button>
)}
</div>
) : (
<>
{cardSelecionado.criado_por_nome && (
<p className="text-xs text-slate-400 flex items-center gap-1.5">
<User size={13} /> Solicitado por {cardSelecionado.criado_por_nome}
</p>
)}
{cardSelecionado.cliente_id && (
<Link href={`/clientes/${cardSelecionado.cliente_id}`} className="text-xs text-brand-navy hover:underline">
Ver histórico e negociação no CRM
</Link>
)}
<div className="flex flex-wrap gap-1.5">
{cardSelecionado.tipo_medida && (
<span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
cardSelecionado.tipo_medida === 'final' ? 'bg-brand-tealLight text-brand-teal' : 'bg-slate-100 text-slate-600'
}`}>
{cardSelecionado.tipo_medida === 'final' ? 'Medida final' : 'Orçamento comum'}
</span>
)}
{cardSelecionado.temperatura && temperaturaInfo[cardSelecionado.temperatura] && (
<span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${temperaturaInfo[cardSelecionado.temperatura].fundo} ${temperaturaInfo[cardSelecionado.temperatura].texto}`}>
{temperaturaInfo[cardSelecionado.temperatura].emoji} {temperaturaInfo[cardSelecionado.temperatura].label}
</span>
)}
</div>

<div>
<label className="block text-xs text-slate-500 mb-1">Nome do cliente</label>
<input
type="text"
value={editando.cliente_nome || ''}
onChange={e => atualizarCampo('cliente_nome', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
/>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Phone size={12} /> WhatsApp</label>
<input
type="text"
value={editando.cliente_whatsapp || ''}
onChange={e => atualizarCampo('cliente_whatsapp', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
/>
</div>
<div>
<label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin size={12} /> Cidade</label>
<input
type="text"
value={editando.cidade || ''}
onChange={e => atualizarCampo('cidade', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
/>
</div>
</div>

<div>
<label className="block text-xs text-slate-500 mb-1">Cor / Acabamento</label>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
{([
{ value: 'preto', label: 'Preto' },
{ value: 'branco', label: 'Branco' },
{ value: 'madeirado', label: 'Amadeirado' },
{ value: 'outro', label: 'Outra cor' },
] as const).map(a => (
<button
key={a.value}
type="button"
onClick={() => atualizarCampo('acabamento', a.value)}
className={`p-2 rounded-lg text-xs border transition ${
editando.acabamento === a.value
? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
: 'border-slate-200 hover:border-slate-300 text-slate-600'
}`}
>
{a.label}
</button>
))}
</div>
{editando.acabamento === 'outro' && (
<input
type="text"
value={editando.acabamento_outro_texto || ''}
onChange={e => atualizarCampo('acabamento_outro_texto', e.target.value)}
placeholder="Qual cor?"
className="w-full border border-slate-300 rounded-xl p-3 text-sm mt-2"
/>
)}
</div>

<div>
<label className="block text-xs text-slate-500 mb-1">Contramarco</label>
<select
value={editando.contramarco || ''}
onChange={e => atualizarCampo('contramarco', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
>
<option value="">—</option>
<option value="com">Com contramarco</option>
<option value="sem">Sem contramarco</option>
</select>
</div>

{editando.tipo_medida && (
<div>
<label className="block text-xs text-slate-500 mb-1">Tipo de medida</label>
<select
value={editando.tipo_medida || ''}
onChange={e => atualizarCampo('tipo_medida', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
>
<option value="comum">Orçamento comum</option>
<option value="final">Medida final</option>
</select>
</div>
)}

<div>
<label className="block text-xs text-slate-500 mb-1">Temperatura do orçamento</label>
<div className="grid grid-cols-3 gap-2">
{(['quente', 'morno', 'frio'] as const).map(t => (
<button
key={t}
type="button"
onClick={() => atualizarCampo('temperatura', t)}
className={`p-2 rounded-lg text-xs border transition ${
editando.temperatura === t
? `${temperaturaInfo[t].borda} ${temperaturaInfo[t].fundo} ${temperaturaInfo[t].texto} font-medium`
: 'border-slate-200 hover:border-slate-300 text-slate-600'
}`}
>
{temperaturaInfo[t].emoji} {temperaturaInfo[t].label}
</button>
))}
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12} /> Arquiteto/Eng.</label>
<input
type="text"
value={editando.arquiteto_nome || ''}
onChange={e => atualizarCampo('arquiteto_nome', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
/>
</div>
<div>
<label className="block text-xs text-slate-500 mb-1">Contato</label>
<input
type="text"
value={editando.arquiteto_contato || ''}
onChange={e => atualizarCampo('arquiteto_contato', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
/>
</div>
</div>

<div className="space-y-2">
<div className="flex items-center justify-between">
<label className="block text-xs text-slate-500">Esquadrias</label>
<button onClick={adicionarItemEdit} className="flex items-center gap-1 text-xs text-brand-navy hover:text-brand-navyDark">
<Plus size={13} /> Adicionar
</button>
</div>
{(editando.itens || []).map((item, i) => (
<div key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
<div className="flex items-center justify-between">
<span className="text-xs text-slate-400">Esquadria {i + 1}</span>
<button onClick={() => removerItemEdit(item.id)} className="p-1 text-red-400 hover:text-red-600">
<Trash2 size={13} />
</button>
</div>
<input
type="text"
value={item.ambiente || ''}
onChange={e => atualizarItemEdit(item.id, 'ambiente', e.target.value || null)}
placeholder="Ambiente (ex: Sala, Quarto 1, Cozinha...)"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<select
value={item.tipo_esquadria}
onChange={e => atualizarItemEdit(item.id, 'tipo_esquadria', e.target.value as TipoEsquadria)}
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
>
{Object.entries(tipoLabels).map(([v, l]) => (
<option key={v} value={v}>{l}</option>
))}
</select>
{item.tipo_esquadria === 'outro' && (
<input
type="text"
value={item.tipo_outro_texto || ''}
onChange={e => atualizarItemEdit(item.id, 'tipo_outro_texto', e.target.value)}
placeholder="Qual é o tipo de esquadria?"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
)}
<input
type="text"
value={item.folhas || ''}
onChange={e => atualizarItemEdit(item.id, 'folhas', e.target.value || null)}
placeholder="Quantidade de folhas (ex: 2 ou 2 fixas + 1 móvel)"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
<div className="flex items-center justify-between gap-2">
<p className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5"><Camera size={12} /> Fotos coletadas em campo</p>
<label className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy">
<Plus size={12} /> Adicionar fotos
<input type="file" accept="image/*" multiple className="hidden" onChange={e => adicionarFotosItem(item.id, e.target.files)} />
</label>
</div>

{(item.foto_larguras_url || item.foto_alturas_url) && (
<div className="grid grid-cols-2 gap-3">
{item.foto_larguras_url && (
<a href={item.foto_larguras_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-blue-200 bg-blue-50/40 p-2">
<div className="flex items-center justify-between mb-1.5">
<span className="text-[10px] font-bold tracking-wide text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">LARGURA</span>
<span className="text-[9px] text-blue-500">Foto da medida</span>
</div>
<img src={item.foto_larguras_url} alt="Foto da largura" className="w-full h-24 object-cover rounded-lg border border-blue-200" />
</a>
)}
{item.foto_alturas_url && (
<a href={item.foto_alturas_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">
<div className="flex items-center justify-between mb-1.5">
<span className="text-[10px] font-bold tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">ALTURA</span>
<span className="text-[9px] text-emerald-500">Foto da medida</span>
</div>
<img src={item.foto_alturas_url} alt="Foto da altura" className="w-full h-24 object-cover rounded-lg border border-emerald-200" />
</a>
)}
</div>
)}

{fotosGeraisDoItem(item).length > 0 && (
<div>
<p className="text-[10px] font-medium text-slate-500 mb-1.5">Outras fotos</p>
<div className="grid grid-cols-4 gap-2">
{fotosGeraisDoItem(item).map((url, fotoIndex) => (
<a key={`${url}-${fotoIndex}`} href={url} target="_blank" rel="noreferrer" className="block">
<img src={url} alt={`Foto geral ${fotoIndex + 1}`} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
</a>
))}
</div>
</div>
)}

{!item.foto_larguras_url && !item.foto_alturas_url && fotosGeraisDoItem(item).length === 0 && (
<p className="text-[11px] text-slate-400">Nenhuma foto coletada para esta esquadria.</p>
)}
<p className="text-[10px] text-slate-400">Largura e altura ficam identificadas pela foto original de cada medicao. Clique para abrir maior.</p>
</div>
{editando.tipo_medida === 'final' ? (
<div className="space-y-2">
<div>
<p className="text-[11px] text-slate-400 mb-1">Larguras (mm) — baixo, meio, cima</p>
<div className="grid grid-cols-3 gap-2">
<input
type="number"
value={item.largura_baixo_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'largura_baixo_mm', parseFloat(e.target.value) || 0)}
placeholder="Baixo"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.largura_meio_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'largura_meio_mm', parseFloat(e.target.value) || 0)}
placeholder="Meio"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.largura_cima_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'largura_cima_mm', parseFloat(e.target.value) || 0)}
placeholder="Cima"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
</div>
</div>
<div>
<p className="text-[11px] text-slate-400 mb-1">Alturas (mm) — direita, meio, esquerda</p>
<div className="grid grid-cols-3 gap-2">
<input
type="number"
value={item.altura_direita_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'altura_direita_mm', parseFloat(e.target.value) || 0)}
placeholder="Direita"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.altura_meio_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'altura_meio_mm', parseFloat(e.target.value) || 0)}
placeholder="Meio"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.altura_esquerda_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'altura_esquerda_mm', parseFloat(e.target.value) || 0)}
placeholder="Esquerda"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
</div>
</div>
<input
type="number"
value={item.quantidade || ''}
onChange={e => atualizarItemEdit(item.id, 'quantidade', parseInt(e.target.value) || 1)}
placeholder="Qtd"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
</div>
) : (
<div className="grid grid-cols-3 gap-2">
<input
type="number"
value={item.largura_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'largura_mm', parseFloat(e.target.value) || 0)}
placeholder="Largura"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.altura_mm || ''}
onChange={e => atualizarItemEdit(item.id, 'altura_mm', parseFloat(e.target.value) || 0)}
placeholder="Altura"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<input
type="number"
value={item.quantidade || ''}
onChange={e => atualizarItemEdit(item.id, 'quantidade', parseInt(e.target.value) || 1)}
placeholder="Qtd"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
</div>
)}
{item.preco_unit != null && (
<p className="text-[11px] text-brand-teal">
Produto vinculado — R$ {item.preco_unit.toFixed(2)}{item.quantidade > 1 ? ` × ${item.quantidade} = R$ ${(item.preco_unit * item.quantidade).toFixed(2)}` : ''}
</p>
)}
<input
type="text"
value={item.cor || ''}
onChange={e => atualizarItemEdit(item.id, 'cor', e.target.value)}
placeholder="Cor desta esquadria (opcional, se diferente da geral)"
className="w-full border border-slate-300 rounded-lg p-2 text-xs"
/>
<textarea
value={item.descricao || ''}
onChange={e => atualizarItemEdit(item.id, 'descricao', e.target.value)}
placeholder="Observação (opcional)"
className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-none h-14"
/>
</div>
))}
</div>

{cardSelecionado.descricao_livre && (
<p className="text-slate-500 text-sm whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
{cardSelecionado.descricao_livre}
</p>
)}

{(cardSelecionado as any).fotos_urls?.length > 0 && (
<div className="grid grid-cols-4 gap-2">
{(cardSelecionado as any).fotos_urls.map((url: string, i: number) => (
<a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto ${i + 1}`} className="w-full h-16 object-cover rounded-lg" /></a>
))}
</div>
)}

{!podeEditarSemIniciar && (
<div className="bg-slate-50 rounded-xl p-4 space-y-3">
<p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
<Clock size={13} /> Elaboração do orçamento
</p>

{editando.orcamento_finalizado_em ? (
<div className="text-xs text-brand-tealDark space-y-1">
<p className="flex items-center gap-1.5">
<CheckCircle2 size={14} /> Finalizado — levou{' '}
{formatarDuracao(editando.orcamento_iniciado_em || '', editando.orcamento_finalizado_em)}
</p>
{editando.enviado_vendedor_em && (
<p className="flex items-center gap-1.5 text-brand-navy">
<Phone size={12} /> Enviado para {vendedorInfo?.nome || 'o vendedor'} em{' '}
{new Date(editando.enviado_vendedor_em).toLocaleString('pt-BR')}
</p>
)}
{(editando.anexos || []).map((a, i) => (
<a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline flex items-center gap-1">
<Paperclip size={12} /> {a.titulo} <span className="text-slate-400">({a.nome})</span>
</a>
))}
</div>
) : (
<div className="space-y-3">
<p className="text-xs text-brand-navy">
Em andamento há {formatarDuracao(editando.orcamento_iniciado_em || '', new Date(agora).toISOString())}
</p>

<div>
<label className="block text-xs text-slate-500 mb-1">Anexos do orçamento</label>
{(editando.anexos || []).map((a, i) => (
<div key={i} className="flex items-center gap-2 text-xs text-brand-teal mb-1">
<Paperclip size={12} className="flex-shrink-0" />
<span className="font-medium truncate">{a.titulo}</span>
<a href={a.url} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline flex-shrink-0">
ver
</a>
<button onClick={() => removerAnexo(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
<Trash2 size={12} />
</button>
</div>
))}
<div className="flex items-center gap-2 mt-1">
<input
type="text"
value={novoAnexoTitulo}
onChange={e => setNovoAnexoTitulo(e.target.value)}
placeholder="Título (ex: Orçamento com contramarco)"
className="flex-1 border border-slate-300 rounded-lg p-2 text-xs"
/>
<label
className={`flex items-center gap-1 px-2.5 py-2 border border-dashed rounded-lg text-xs flex-shrink-0 ${
novoAnexoTitulo.trim()
? 'border-brand-navy text-brand-navy cursor-pointer hover:bg-brand-navyLight'
: 'border-slate-200 text-slate-300'
}`}
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
<p className="text-xs text-slate-400 mt-1">Dê um título antes de escolher o arquivo (ex: "Orçamento com contramarco"). O orçamento também é gerado automaticamente em PDF: no celular, abre o menu de compartilhar para anexar o PDF de verdade no WhatsApp; se não for possível, envia o link do PDF na mensagem.</p>
</div>

<div>
<label className="block text-xs text-slate-500 mb-1">Valor total do orçamento</label>
<input
type="text"
value={editando.valor_estimado != null ? String(editando.valor_estimado) : ''}
onChange={e =>
atualizarCampo('valor_estimado', e.target.value.trim() ? parseFloat(e.target.value.replace(',', '.')) : null)
}
placeholder="Ex: 2500.00"
className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
/>
</div>

<div className="pt-2 border-t border-slate-200 space-y-2">
<p className="text-xs font-medium text-slate-500">
Enviar para {vendedorInfo?.nome || 'o vendedor'} e finalizar
</p>
<div>
<label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
<Phone size={12} /> WhatsApp do vendedor
</label>
<input
type="text"
value={whatsappVendedor}
onChange={e => setWhatsappVendedor(e.target.value)}
placeholder="Ex: 11999998888"
className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
/>
<p className="text-xs text-slate-400 mt-1">
{vendedorInfo?.whatsapp
? 'Preenchido automaticamente com o número cadastrado. Pode trocar por outro se precisar.'
: 'Não há número cadastrado para este vendedor — informe um número.'}
</p>
</div>
<div>
<label className="block text-xs text-slate-500 mb-1">Mensagem</label>
<textarea
value={mensagemVendedor}
onChange={e => setMensagemVendedor(e.target.value)}
className="w-full h-20 border border-slate-300 rounded-lg p-2.5 text-sm resize-none"
/>
</div>
</div>

<button
onClick={finalizarOrcamento}
disabled={
salvando ||
editando.valor_estimado == null ||
!whatsappVendedor.trim()
}
className="w-full py-2.5 bg-brand-teal text-white rounded-lg text-sm font-medium hover:bg-brand-tealDark transition disabled:opacity-50"
>
{salvando ? 'Gerando PDF e enviando...' : 'Enviar para o vendedor e finalizar'}
</button>
</div>
)}
</div>
)}

{!podeEditarSemIniciar && (
<div>
<label className="block text-xs text-slate-500 mb-1">Coluna</label>
<select
value={editando.coluna_id || ''}
onChange={e => atualizarCampo('coluna_id', e.target.value)}
className="w-full border border-slate-300 rounded-xl p-3 text-sm"
>
{colunas.map(c => (
<option key={c.id} value={c.id}>{c.nome}</option>
))}
</select>
</div>
)}

<button
onClick={salvarCard}
disabled={salvando}
className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
>
{salvando ? 'Salvando...' : 'Salvar alterações'}
</button>

{usuario?.role === 'master' && (
<button
onClick={excluirCard}
className="w-full py-2 flex items-center justify-center gap-1.5 text-red-500 text-xs font-medium hover:bg-red-50 rounded-lg transition"
>
<Trash2 size={13} /> Excluir este orçamento
</button>
)}

</>
)}

{historico.length > 0 && (
<div className="pt-2 border-t border-slate-100">
<p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
<Clock size={13} /> Histórico
</p>
<div className="space-y-2 max-h-40 overflow-y-auto">
{historico.map(h => (
<div key={h.id} className="text-xs text-slate-500">
<span className="font-medium text-slate-700">{h.usuario_nome || 'Sistema'}</span>
{' — '}{h.acao}
{h.detalhes && <span className="text-slate-400"> ({h.detalhes})</span>}
<div className="text-slate-300">{new Date(h.created_at).toLocaleString('pt-BR')}</div>
</div>
))}
</div>
</div>
)}
</div>
</div>
</div>
)}
</div>
)
}
