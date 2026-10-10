'use client'
import { useEffect, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { ExternalLink, Image as ImageIcon, Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/lib/tipos'
import { uploadFotoProduto } from '@/lib/upload'
import { atualizarProduto } from '@/lib/produtos'

type Props = {
  codigo: string
  produto?: Pick<Produto, 'id' | 'foto_url'> | null
  pequeno?: boolean
  permitirEdicao?: boolean
  apenasControles?: boolean
  onAtualizar?: (id: string, url: string) => void
}

// Sempre usar a imagem do cadastro central, sem gravá-la na fórmula.
export default function ImagemProdutoTecnico({ codigo, produto, pequeno = false, permitirEdicao = false, apenasControles = false, onAtualizar }: Props) {
  const [url, setUrl] = useState(produto?.foto_url || '')
  const [imagemComErro, setImagemComErro] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false)
  const [fonteCatalogo, setFonteCatalogo] = useState<{ url: string; pagina: number; codigo: string } | null>(null)
  const [semFonte, setSemFonte] = useState(false)
  useEffect(() => {
    setUrl(produto?.foto_url || '')
    setImagemComErro(false)
    setFonteCatalogo(null)
    setSemFonte(false)
  }, [produto?.id, produto?.foto_url])

  async function consultarCatalogo() {
    if (!produto?.id || buscandoCatalogo) return
    setBuscandoCatalogo(true)
    setSemFonte(false)
    setErro('')
    try {
      const { data, error: erroBanco } = await supabase
        .from('fornecedor_catalogo_itens')
        .select('codigo_fornecedor,dados_extraidos,fornecedor_documentos(url,nome_arquivo)')
        .eq('produto_id', produto.id)
        .limit(1)
        .maybeSingle()
      if (erroBanco) throw erroBanco
      const doc = (data as any)?.fornecedor_documentos
      const arquivo = Array.isArray(doc) ? doc[0] : doc
      const urlDocumento = String(arquivo?.url || '')
      const pagina = Number((data as any)?.dados_extraidos?.pagina_pdf)
      if (!urlDocumento.startsWith('https://') || !Number.isInteger(pagina) || pagina < 1) {
        setSemFonte(true)
      } else {
        setFonteCatalogo({ url: urlDocumento, pagina, codigo: String((data as any)?.codigo_fornecedor || codigo) })
      }
    } catch {
      setErro('Não foi possível consultar a referência do fornecedor.')
    } finally {
      setBuscandoCatalogo(false)
    }
  }

  async function selecionarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo || !produto?.id) return
    setErro('')
    if (!arquivo.type.startsWith('image/')) return setErro('Escolha uma imagem do produto.')
    if (arquivo.size > 25 * 1024 * 1024) return setErro('A imagem deve ter no máximo 25 MB.')
    setEnviando(true)
    try {
      const novaUrl = await uploadFotoProduto(arquivo)
      if (!novaUrl) throw new Error('Não foi possível enviar a imagem.')
      const resposta = await atualizarProduto(produto.id, { foto_url: novaUrl })
      if (resposta.error) throw new Error('Não foi possível vincular a imagem ao cadastro.')
      setUrl(novaUrl)
      setImagemComErro(false)
      onAtualizar?.(produto.id, novaUrl)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Erro ao salvar imagem.')
    } finally {
      setEnviando(false)
    }
  }

  return <div className={pequeno ? 'shrink-0' : 'inline-flex max-w-full flex-col gap-2'}>
    {!apenasControles && <div className={(pequeno ? 'h-12 w-12' : 'h-24 w-28') + ' flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50'}>
      {url && !imagemComErro
        ? <img src={url} alt={'Imagem do produto ' + (codigo || 'sem código')} className="h-full w-full object-contain" onError={() => setImagemComErro(true)} />
        : <div className="flex flex-col items-center justify-center gap-1 text-slate-400"><ImageIcon size={pequeno ? 20 : 28} aria-hidden="true" />{!pequeno && <span className="text-center text-[10px]">Sem imagem</span>}</div>}
    </div>}
    {permitirEdicao && !pequeno && <>
      {produto?.id
        ? <label className={'inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 ' + (enviando ? 'pointer-events-none opacity-60' : '')}>
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {enviando ? 'Enviando...' : url && !imagemComErro ? 'Substituir imagem' : 'Adicionar imagem'}
            <input type="file" accept="image/*" className="sr-only" disabled={enviando} onChange={selecionarArquivo} aria-label={'Selecionar imagem de ' + codigo} />
          </label>
        : <Link href="/cadastro/produtos" className="text-center text-[11px] font-semibold text-amber-700 underline">Vincular código no catálogo</Link>}
      {produto?.id && (!url || imagemComErro) && (
        fonteCatalogo
          ? <a href={fonteCatalogo.url + '#page=' + fonteCatalogo.pagina} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
              <ExternalLink size={12} /> Ver perfil {fonteCatalogo.codigo} no catálogo · pág. {fonteCatalogo.pagina}
            </a>
          : !semFonte && <button type="button" disabled={buscandoCatalogo} onClick={() => void consultarCatalogo()} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {buscandoCatalogo ? 'Buscando referência...' : 'Procurar no catálogo do fornecedor'}
            </button>
      )}
      {semFonte && <span className="text-[11px] text-slate-500">Sem página vinculada a este código.</span>}
      {erro && <span role="alert" className="max-w-40 text-xs text-red-600">{erro}</span>}
    </>}
  </div>
}
