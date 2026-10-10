'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, FileImage, ImageOff, Loader2, UploadCloud } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { uploadFotoProduto } from '@/lib/upload'
import { adicionarImagemProduto } from '@/lib/historicoCadastros'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/lib/tipos'

type Entrada = {
  nome: string
  arquivo: File
  previa: string
  produto: Produto | null
  situacao: 'pronto' | 'sem_correspondencia' | 'ambiguo' | 'ja_tem_imagem'
  aprovado: boolean
  resultado?: 'importado' | 'ignorado' | 'erro'
  detalhe?: string
}

function normalizar(valor: string) {
  return valor.trim().toUpperCase()
}

function procurarProduto(nome: string, produtos: Produto[]) {
  const chave = normalizar(nome.replace(/\.(png|jpe?g|webp)$/i, ''))
  const exatos = produtos.filter(p => p.id.toUpperCase() === chave || normalizar(p.codigo || '') === chave)
  return exatos
}

export default function ImportarImagensCatalogoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 })
  const [mensagem, setMensagem] = useState('')
  const urlsTemporarias = useRef<string[]>([])

  useEffect(() => {
    let ativo = true
    void (async () => {
      const usuario = await usuarioAtual()
      if (!ativo) return
      const autorizado = usuario?.role === 'master'
      setPermitido(autorizado)
      if (autorizado) setProdutos(await listarProdutos())
      setCarregando(false)
    })()
    return () => { ativo = false }
  }, [])

  useEffect(() => () => {
    urlsTemporarias.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  function selecionarArquivos(files: FileList | null) {
    if (importando || !files) return
    urlsTemporarias.current.forEach(url => URL.revokeObjectURL(url))
    const fotos = Array.from(files).filter(f => /image\/(png|jpeg|webp)/.test(f.type) && f.size > 0 && f.size <= 25 * 1024 * 1024)
    const nomes = new Set<string>()
    const novas: Entrada[] = []
    for (const arquivo of fotos.slice(0, 500)) {
      const chave = normalizar(arquivo.name)
      if (nomes.has(chave)) continue
      nomes.add(chave)
      const candidatos = procurarProduto(arquivo.name, produtos)
      const produto = candidatos.length === 1 ? candidatos[0] : null
      const situacao: Entrada['situacao'] =
        candidatos.length > 1 ? 'ambiguo' :
        !produto ? 'sem_correspondencia' :
        produto.foto_url?.trim() ? 'ja_tem_imagem' : 'pronto'
      novas.push({ arquivo, nome: arquivo.name, produto, previa: URL.createObjectURL(arquivo), aprovado: false, situacao })
    }
    urlsTemporarias.current = novas.map(e => e.previa)
    setEntradas(novas)
    setProgresso({ feitos: 0, total: 0 })
    setMensagem(fotos.length > 500 ? 'Limite de 500 imagens por lote. Divida a pasta em dois lotes.' : '')
  }

  function alterarAprovacao(nome: string, aprovado: boolean) {
    setEntradas(prev => prev.map(e => e.nome === nome && e.situacao === 'pronto' && !e.resultado ? { ...e, aprovado } : e))
  }

  const prontos = useMemo(() => entradas.filter(e => e.situacao === 'pronto' && !e.resultado), [entradas])
  const aprovados = useMemo(() => prontos.filter(e => e.aprovado), [prontos])
  const importados = entradas.filter(e => e.resultado === 'importado').length

  async function enviarEntrada(e: Entrada): Promise<{ resultado: 'importado' | 'ignorado' | 'erro'; detalhe?: string }> {
    if (!e.produto) return { resultado: 'ignorado', detalhe: 'Produto não identificado.' }
    try {
      // Proteção extra: checar o dado atual, pois outra pessoa pode ter anexado foto desde o carregamento.
      const consulta = await supabase.from('produtos').select('foto_url').eq('id', e.produto.id).maybeSingle()
      if (consulta.error) throw consulta.error
      if (!consulta.data) return { resultado: 'ignorado', detalhe: 'Produto não encontrado.' }
      if (String(consulta.data.foto_url || '').trim()) return { resultado: 'ignorado', detalhe: 'Foto existente preservada.' }
      const url = await uploadFotoProduto(e.arquivo)
      if (!url) throw new Error('Falha ao enviar imagem ao armazenamento.')
      // Operação condicional evita sobrescrever a foto de outra sessão.
      const atualizacao = await supabase.from('produtos')
        .update({ foto_url: url, updated_at: new Date().toISOString() })
        .eq('id', e.produto.id)
        .or('foto_url.is.null,foto_url.eq.')
        .select('id')
      if (atualizacao.error) throw atualizacao.error
      if (!atualizacao.data?.length) return { resultado: 'ignorado', detalhe: 'Foto adicionada por outra sessão. Foto anterior preservada.' }
      const historico = await adicionarImagemProduto({
        produtoId: e.produto.id,
        url,
        tipo: 'desenho_tecnico',
        origem: 'catalogo_fornecedor',
        origemRef: e.nome,
        principal: true,
        statusValidacao: 'validada',
      })
      if (historico.error) return { resultado: 'importado', detalhe: 'Imagem salva; registro do histórico precisa de revisão.' }
      return { resultado: 'importado', detalhe: 'Desenho vinculado após conferência.' }
    } catch (erro) {
      return { resultado: 'erro', detalhe: erro instanceof Error ? erro.message : 'Erro ao importar.' }
    }
  }

  async function importar() {
    if (importando || !aprovados.length) return
    const confirma = window.confirm('Vincular ' + aprovados.length + ' imagens aprovadas aos produtos? As fotos já existentes não serão substituídas.')
    if (!confirma) return
    setImportando(true)
    setProgresso({ feitos: 0, total: aprovados.length })
    setMensagem('Importando apenas os desenhos selecionados...')
    // Lotes pequenos para não saturar o armazenamento nem as operações no catálogo.
    for (let i = 0; i < aprovados.length; i += 3) {
      const lote = aprovados.slice(i, i + 3)
      const resultados = await Promise.all(lote.map(e => enviarEntrada(e)))
      setEntradas(prev => prev.map(e => {
        const posicao = lote.findIndex(l => l.nome === e.nome)
        return posicao < 0 ? e : { ...e, ...resultados[posicao], aprovado: false }
      }))
      setProgresso({ feitos: Math.min(i + lote.length, aprovados.length), total: aprovados.length })
    }
    setImportando(false)
    setMensagem('Processamento terminado. Confira os resultados abaixo.')
  }

  if (carregando) return <main className="p-8 text-slate-500">Carregando catálogo de produtos...</main>
  if (!permitido) return <main className="p-8 text-slate-600">A importação de imagens é restrita ao usuário Master.</main>

  return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
    <header className="flex flex-wrap items-start gap-4">
      <Link href="/cadastro/catalogo-tecnico" className="rounded-lg border p-2 text-slate-600" aria-label="Voltar ao catálogo"><ArrowLeft size={18}/></Link>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Atlas One · Cadastro técnico</p>
        <h1 className="text-2xl font-bold">Importar desenhos por código</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">Envie PNG, JPG ou WebP com nome igual ao <strong>código ou ID do produto</strong>. Confira cada miniatura antes de selecionar. O Atlas não altera fórmulas e nunca sobrescreve uma imagem já cadastrada neste processo.</p>
      </div>
    </header>

    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <label className={'flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800 ' + (importando ? 'pointer-events-none opacity-50' : '')}>
        <UploadCloud size={20}/> Escolher imagens para conferir (até 500)
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={importando} onChange={e => { selecionarArquivos(e.target.files); e.target.value = '' }}/>
      </label>
      {entradas.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <span><strong>{entradas.length}</strong> arquivos</span>
        <span><strong>{prontos.length}</strong> sem imagem e com código identificado</span>
        <span><strong>{entradas.filter(e => e.situacao !== 'pronto').length}</strong> exigem conferência manual</span>
        <span><strong>{importados}</strong> importados</span>
        <button type="button" disabled={importando} onClick={() => setEntradas(prev => prev.map(e => ({ ...e, aprovado: false })))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Desmarcar todos</button>
      </div>}
      {mensagem && <p className="mt-3 text-sm text-slate-700" role="status">{mensagem}</p>}
      {importando && <p className="mt-2 text-sm font-medium text-blue-700"><Loader2 size={14} className="mr-1 inline animate-spin"/>{progresso.feitos} de {progresso.total} imagens processadas</p>}
    </section>

    {entradas.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Marque somente as imagens cujo desenho e código você conferiu.</p>
        <button type="button" disabled={importando || aprovados.length === 0} onClick={() => void importar()} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Importar {aprovados.length} imagem(ns) aprovadas</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entradas.map(e => <article key={e.nome} className={'rounded-xl border bg-white p-3 shadow-sm ' + (e.aprovado ? 'border-emerald-500' : 'border-slate-200')}>
          <a href={e.previa} target="_blank" rel="noopener noreferrer" title="Abrir imagem para ampliar"><img src={e.previa} alt={'Recorte candidato ' + (e.produto?.codigo || e.nome)} className="h-44 w-full rounded-lg border bg-slate-50 object-contain"/></a>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-sm font-bold">{e.produto?.codigo || 'Código não encontrado'}</span>
            {e.resultado === 'importado' ? <Check size={18} className="text-emerald-600"/> : e.situacao !== 'pronto' ? <ImageOff size={16} className="text-amber-600"/> : <FileImage size={16} className="text-slate-400"/>}
          </div>
          <p className="mt-1 line-clamp-2 min-h-9 text-xs text-slate-600">{e.produto?.nome || e.nome}</p>
          <p className="mt-1 truncate text-[11px] text-slate-400" title={e.nome}>{e.nome}</p>
          {e.situacao === 'pronto' && !e.resultado
            ? <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs font-semibold">
                <input type="checkbox" checked={e.aprovado} disabled={importando} onChange={ev => alterarAprovacao(e.nome, ev.target.checked)}/> Desenho conferido — aprovar
              </label>
            : <p className={'mt-3 text-xs ' + (e.resultado === 'erro' ? 'text-red-700' : 'text-amber-700')}>
                {e.detalhe || (e.situacao === 'ja_tem_imagem' ? 'Já possui imagem; não será sobrescrita.' : e.situacao === 'ambiguo' ? 'Código ambíguo; não associar automaticamente.' : 'Não há produto com esse ID ou código.')}
              </p>}
        </article>)}
      </div>
    </>}
  </main>
}
