'use client'

import { useEffect, useState } from 'react'
import { Ban, ExternalLink, ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { uploadFotoProduto } from '@/lib/upload'
import { registrarEventoAprendizadoAtlas } from '@/lib/ai/aprendizadoAtlas'

type ProdutoCompra = {
  id: string
  codigo: string | null
  nome: string
  categoria: string | null
  foto_url: string | null
}

type Props = {
  produto: ProdutoCompra
  selecionado: boolean
  podeCorrigirImagem: boolean
  podeInativar: boolean
  aoSelecionar: () => void
  aoAtualizarFoto: (url: string) => void
  aoInativar: () => void
}

async function alterarProduto(dados: Record<string, unknown>): Promise<{ fotoUrl?: string; aviso?: string | null }> {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const resposta = await fetch('/api/compras/produtos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(dados),
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json.error || 'Não foi possível salvar a alteração.')
  return json
}

export default function OpcaoProdutoCompra({
  produto, selecionado, podeCorrigirImagem, podeInativar, aoSelecionar, aoAtualizarFoto, aoInativar,
}: Props) {
  const [editando, setEditando] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipoImagem, setTipoImagem] = useState<'foto' | 'desenho_tecnico'>(produto.categoria === 'perfil' ? 'desenho_tecnico' : 'foto')
  const [preview, setPreview] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [imagemComErro, setImagemComErro] = useState(false)

  useEffect(() => {
    if (!arquivo) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(arquivo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])
  useEffect(() => setImagemComErro(false), [produto.foto_url])

  function escolherArquivo(novo: File | undefined) {
    setErro('')
    setArquivo(null)
    if (!novo) return
    if (!novo.type.startsWith('image/')) return setErro('Escolha uma foto ou desenho em formato de imagem.')
    if (novo.size > 25 * 1024 * 1024) return setErro('A imagem deve ter no máximo 25 MB.')
    setArquivo(novo)
  }

  async function salvarImagem() {
    if (!arquivo || salvando) return
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const fotoUrl = await uploadFotoProduto(arquivo)
      if (!fotoUrl) throw new Error('Não foi possível enviar a imagem.')
      const resultado = await alterarProduto({ acao: 'corrigir_imagem', produtoId: produto.id, fotoUrl, tipoImagem })
      aoAtualizarFoto(resultado.fotoUrl || fotoUrl)
      setEditando(false)
      setArquivo(null)
      if (resultado.aviso) setAviso(resultado.aviso)
      void registrarEventoAprendizadoAtlas({
        dominio: produto.categoria === 'perfil' ? 'perfil' : produto.categoria === 'acessorio' ? 'acessorio' : 'compras',
        tipo: 'imagem_produto_corrigida_e_validada',
        entidade_tipo: 'produto',
        entidade_id: produto.id,
        contexto: { codigo: produto.codigo || null, categoria: produto.categoria || null },
        dados: { url_validada: fotoUrl, origem: 'correcao_manual_compras' },
        evidencia: 'validado',
      })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível corrigir a imagem.')
    } finally {
      setSalvando(false)
    }
  }

  async function inativarProduto() {
    if (salvando) return
    if (!window.confirm('Inativar ' + (produto.codigo || produto.nome) + '? Ele deixará de aparecer nas novas compras, mas o histórico será preservado.')) return
    setSalvando(true)
    setErro('')
    try {
      await alterarProduto({ acao: 'inativar', produtoId: produto.id })
      aoInativar()
      void registrarEventoAprendizadoAtlas({
        dominio: 'compras',
        tipo: 'produto_inativado_para_novas_compras',
        entidade_tipo: 'produto',
        entidade_id: produto.id,
        contexto: { codigo: produto.codigo || null, categoria: produto.categoria || null },
        dados: { ativo: false },
        evidencia: 'validado',
      })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível inativar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  const buscaExterna = 'https://www.google.com/search?tbm=isch&q=' +
    encodeURIComponent([produto.codigo, produto.nome, 'perfil acessório alumínio desenho técnico'].filter(Boolean).join(' '))

  return <div className={'border-b px-3 py-2 last:border-b-0 ' + (selecionado ? 'bg-blue-50' : 'bg-white')}>
    <div className="flex items-center gap-2">
      <button type="button" disabled={salvando} onClick={aoSelecionar}
        className={'flex min-w-0 flex-1 items-center gap-3 text-left text-sm disabled:opacity-60 ' + (selecionado ? 'font-semibold text-blue-700' : 'text-slate-700 hover:text-blue-700')}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {produto.foto_url && !imagemComErro
            ? <img src={produto.foto_url} alt={'Imagem de ' + (produto.codigo || produto.nome)} className="h-full w-full object-contain" onError={() => setImagemComErro(true)} />
            : <div className="flex flex-col items-center gap-0.5 text-amber-700"><ImageIcon size={18} /><span className="text-[9px]">Sem foto</span></div>}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-slate-600">{produto.codigo || 'Sem código'}</div>
          <div className="break-words">{produto.nome}</div>
          {(!produto.foto_url || imagemComErro) && <span className="text-[10px] text-amber-700">Imagem pendente de correção</span>}
        </div>
      </button>
      {selecionado && <span className="text-xs font-bold text-blue-600">Selecionado</span>}
    </div>
    {(podeCorrigirImagem || podeInativar) && <div className="mt-2 flex flex-wrap gap-2 pl-[68px] text-[11px]">
      {podeCorrigirImagem && <button type="button" disabled={salvando} onClick={() => { setEditando(v => !v); setErro(''); setAviso('') }}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">
        <Upload size={12} /> Corrigir imagem
      </button>}
      {produto.foto_url && !imagemComErro && <a href={produto.foto_url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50">
        <ExternalLink size={12} /> Ampliar imagem
      </a>}
      {podeInativar && <button type="button" disabled={salvando} onClick={() => void inativarProduto()}
        className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 font-semibold text-amber-800 hover:bg-amber-50">
        {salvando ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Inativar
      </button>}
    </div>}
    {editando && podeCorrigirImagem && <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-xs text-slate-800">Nova imagem de {produto.codigo || produto.nome}</strong>
        <button type="button" disabled={salvando} onClick={() => { setEditando(false); setArquivo(null) }} aria-label="Fechar correção"><X size={14} /></button>
      </div>
      <p className="text-[11px] text-slate-600">Confira o desenho e o código antes de confirmar. A imagem anterior ficará no histórico.</p>
      <a href={buscaExterna} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 underline">
        <ExternalLink size={12} /> Pesquisar referência na internet
      </a>
      <label className="block text-[11px] font-medium text-slate-700">Tipo de imagem
        <select value={tipoImagem} disabled={salvando} onChange={e => setTipoImagem(e.target.value as 'foto' | 'desenho_tecnico')}
          className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="desenho_tecnico">Desenho técnico</option>
          <option value="foto">Fotografia do produto</option>
        </select>
      </label>
      <input type="file" accept="image/*" disabled={salvando} aria-label={'Enviar imagem correta de ' + (produto.codigo || produto.nome)}
        onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }}
        className="block w-full text-xs file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1" />
      {preview && <img src={preview} alt="Prévia da imagem selecionada" className="h-36 w-full rounded-lg border bg-slate-50 object-contain" />}
      <button type="button" disabled={!arquivo || salvando} onClick={() => void salvarImagem()}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {salvando ? 'Gravando correção...' : 'Confirmar imagem correta'}
      </button>
    </div>}
    {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    {aviso && <p role="status" className="mt-2 text-xs text-amber-700">{aviso}</p>}
  </div>
}
