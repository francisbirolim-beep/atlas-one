'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Loader2, PackageCheck, Save, ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type ItemBase = {
  id: string
  produto_id: string | null
  codigo_fornecedor: string | null
  descricao: string
  unidade: string | null
  quantidade: number
  valor_unitario: number | null
  valor_total: number | null
  vinculo_status: string
  produto: { id: string; codigo: string | null; nome: string; unidade: string | null } | null
  quantidadeNf: number
  jaRecebida: number
  jaAvariada: number
  saldo: number
  statusAcumulado: string
}

type Dados = {
  nf: {
    id: string
    numero: string | null
    serie: string | null
    data_emissao: string | null
    data_entrada: string
    fornecedor_nome: string | null
    fornecedor_cnpj: string | null
    valor_total: number | null
    status: string
  }
  itens: ItemBase[]
  recebimentos: Array<{
    id: string
    status: string
    data_recebimento: string
    observacoes: string | null
    recebido_por_nome: string | null
  }>
}

type LinhaForm = {
  nfItemId: string
  quantidadeRecebida: number
  quantidadeAvariada: number
  observacoes: string
}

type Resultado = {
  recebimentoId: string
  itensConferidos: number
  divergencias: number
  fotosGuardadas: number
  estoqueMovimentado: boolean
  mensagem: string
}

function moeda(valor: number | null | undefined) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString('pt-BR')
}

function agoraLocal() {
  const d = new Date()
  const deslocamento = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - deslocamento).toISOString().slice(0, 16)
}

async function compactarImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1400
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72))
    if (!blob) return file
    const nome = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${nome}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

export default function ConferenciaRecebimentoPage() {
  const params = useParams<{ nfId: string }>()
  const [dados, setDados] = useState<Dados | null>(null)
  const [linhas, setLinhas] = useState<LinhaForm[]>([])
  const [dataRecebimento, setDataRecebimento] = useState(agoraLocal())
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [preparandoFotos, setPreparandoFotos] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => { carregar() }, [params.nfId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const resp = await fetch(`/api/compras/recebimentos/${params.nfId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Erro ao carregar a conferência.')
      setDados(json)
      setLinhas((json.itens || []).map((item: ItemBase) => ({
        nfItemId: item.id,
        quantidadeRecebida: Number(item.saldo) || 0,
        quantidadeAvariada: 0,
        observacoes: '',
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a conferência.')
    } finally {
      setCarregando(false)
    }
  }

  function atualizarLinha(index: number, campo: keyof LinhaForm, valor: string | number) {
    setLinhas(prev => prev.map((linha, i) => i === index ? { ...linha, [campo]: valor } : linha))
  }

  async function selecionarFotos(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files || []).slice(0, 4)
    setPreparandoFotos(true)
    setErro('')
    try {
      const comprimidas: File[] = []
      for (const arquivo of arquivos) {
        const foto = await compactarImagem(arquivo)
        if (foto.size > 2 * 1024 * 1024) throw new Error(`A foto ${arquivo.name} ficou maior que 2 MB. Escolha uma foto menor.`)
        comprimidas.push(foto)
      }
      const total = comprimidas.reduce((s, f) => s + f.size, 0)
      if (total > 5 * 1024 * 1024) throw new Error('As fotos juntas excedem 5 MB. Reduza a quantidade de fotos.')
      setFotos(comprimidas)
    } catch (e) {
      setFotos([])
      setErro(e instanceof Error ? e.message : 'Não foi possível preparar as fotos.')
    } finally {
      setPreparandoFotos(false)
      event.target.value = ''
    }
  }

  const resumo = useMemo(() => {
    if (!dados) return { ok: 0, faltas: 0, excessos: 0, avarias: 0 }
    let ok = 0, faltas = 0, excessos = 0, avarias = 0
    dados.itens.forEach((item, i) => {
      const linha = linhas[i]
      if (!linha) return
      const acumulado = Number(item.jaRecebida) + Number(linha.quantidadeRecebida || 0)
      const avaria = Number(item.jaAvariada) + Number(linha.quantidadeAvariada || 0)
      if (avaria > 0) avarias += 1
      else if (acumulado < Number(item.quantidadeNf)) faltas += 1
      else if (acumulado > Number(item.quantidadeNf)) excessos += 1
      else ok += 1
    })
    return { ok, faltas, excessos, avarias }
  }, [dados, linhas])

  async function salvar() {
    if (!dados) return
    setSalvando(true)
    setErro('')
    setResultado(null)
    try {
      for (let i = 0; i < linhas.length; i += 1) {
        if (Number(linhas[i].quantidadeRecebida) < 0 || Number(linhas[i].quantidadeAvariada) < 0) throw new Error(`Item ${i + 1}: quantidade inválida.`)
        if (Number(linhas[i].quantidadeAvariada) > Number(linhas[i].quantidadeRecebida)) throw new Error(`Item ${i + 1}: avaria não pode ser maior que a quantidade recebida.`)
      }

      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const form = new FormData()
      form.append('payload', JSON.stringify({ dataRecebimento, observacoes, itens: linhas }))
      fotos.forEach(foto => form.append('fotos', foto))

      const resp = await fetch(`/api/compras/recebimentos/${params.nfId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Não foi possível registrar a conferência.')
      setResultado(json)
      await carregar()
      setFotos([])
      setObservacoes('')
      setDataRecebimento(agoraLocal())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar a conferência.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto flex max-w-6xl items-center gap-2 text-slate-500"><Loader2 size={18} className="animate-spin" /> Carregando conferência...</div></main>

  if (!dados) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{erro || 'NF não encontrada.'}</div></main>

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={`/compras/notas/${dados.nf.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={16} /> Voltar para a NF</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Compras • Recebimento</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Conferência da NF {dados.nf.numero || 'sem número'}</h1>
            <p className="mt-1 text-sm text-slate-600">Compare o que a nota informa com o que realmente chegou. Recebimentos parciais são acumulados.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><PackageCheck size={28} className="text-emerald-600" /></div>
        </header>

        {erro ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div> : null}
        {resultado ? <div className={`rounded-xl border p-4 text-sm ${resultado.divergencias ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><strong>{resultado.mensagem}</strong> Fotos guardadas: {resultado.fotosGuardadas}.</div> : null}

        <section className="grid gap-3 md:grid-cols-4">
          <Info titulo="Fornecedor" valor={dados.nf.fornecedor_nome || '—'} />
          <Info titulo="Emissão" valor={dataBR(dados.nf.data_emissao)} />
          <Info titulo="Valor da NF" valor={moeda(dados.nf.valor_total)} />
          <Info titulo="Conferências anteriores" valor={String(dados.recebimentos.length)} />
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          <StatusCard label="OK" valor={resumo.ok} classe="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <StatusCard label="Falta / saldo" valor={resumo.faltas} classe="border-amber-200 bg-amber-50 text-amber-900" />
          <StatusCard label="Excesso" valor={resumo.excessos} classe="border-blue-200 bg-blue-50 text-blue-900" />
          <StatusCard label="Avaria" valor={resumo.avarias} classe="border-red-200 bg-red-50 text-red-800" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-bold text-slate-900">Itens para conferir</h2>
            <p className="mt-1 text-sm text-slate-500">O campo Recebido vem preenchido com o saldo ainda esperado. Ajuste para a quantidade que realmente chegou.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="p-3">Produto / código</th><th className="p-3 text-right">NF</th><th className="p-3 text-right">Já recebido</th><th className="p-3 text-right">Saldo</th><th className="p-3">Recebido agora</th><th className="p-3">Avariado</th><th className="p-3">Observação</th></tr>
              </thead>
              <tbody>
                {dados.itens.map((item, i) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.codigo_fornecedor || item.produto?.codigo || '—'} — {item.descricao}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.produto ? `Atlas: ${item.produto.codigo || ''} ${item.produto.nome}` : 'Produto ainda não vinculado'} • Unidade NF: {item.unidade || '—'}</div>
                    </td>
                    <td className="p-3 text-right font-semibold">{Number(item.quantidadeNf).toLocaleString('pt-BR')} {item.unidade || ''}</td>
                    <td className="p-3 text-right">{Number(item.jaRecebida).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right font-semibold">{Number(item.saldo).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><input type="number" min="0" step="any" value={linhas[i]?.quantidadeRecebida ?? 0} onChange={e => atualizarLinha(i, 'quantidadeRecebida', Number(e.target.value))} className="w-28 rounded-lg border border-slate-300 px-3 py-2" /></td>
                    <td className="p-3"><input type="number" min="0" step="any" value={linhas[i]?.quantidadeAvariada ?? 0} onChange={e => atualizarLinha(i, 'quantidadeAvariada', Number(e.target.value))} className="w-24 rounded-lg border border-slate-300 px-3 py-2" /></td>
                    <td className="p-3"><input value={linhas[i]?.observacoes ?? ''} onChange={e => atualizarLinha(i, 'observacoes', e.target.value)} placeholder="Ex.: embalagem rasgada" className="w-full min-w-52 rounded-lg border border-slate-300 px-3 py-2" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Dados do recebimento</h2>
            <label className="mt-4 block text-sm font-medium text-slate-700">Data e hora</label>
            <input type="datetime-local" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            <label className="mt-4 block text-sm font-medium text-slate-700">Observações gerais</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={4} placeholder="Ex.: material recebido pelo portão lateral; embalagem de um volume danificada..." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Camera size={20} className="text-slate-600" /><h2 className="font-bold text-slate-900">Fotos do recebimento</h2></div>
            <p className="mt-2 text-sm text-slate-500">Até 4 fotos. O navegador reduz o tamanho antes do envio e o Atlas guarda as imagens em armazenamento privado.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-700 hover:border-blue-400">
              {preparandoFotos ? <><Loader2 size={18} className="mr-2 animate-spin" /> Preparando fotos...</> : 'Selecionar ou tirar fotos'}
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={selecionarFotos} disabled={preparandoFotos} />
            </label>
            {fotos.length ? <div className="mt-3 space-y-1 text-xs text-slate-600">{fotos.map((foto, i) => <div key={`${foto.name}-${i}`}>{foto.name} • {(foto.size / 1024).toFixed(0)} KB</div>)}</div> : null}
          </div>
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div><strong>Estoque ainda não é movimentado.</strong> Esta etapa registra a conferência real e as divergências. A entrada em estoque será liberada somente depois de validar unidade operacional e conversões de embalagem.</div></div>
        </div>

        <div className="flex justify-end">
          <button onClick={salvar} disabled={salvando || preparandoFotos} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Registrar conferência
          </button>
        </div>

        {dados.recebimentos.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Histórico de conferências desta NF</h2>
            <div className="mt-3 space-y-2">
              {dados.recebimentos.map(r => <div key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm"><strong>{dataBR(r.data_recebimento)}</strong> • {r.recebido_por_nome || 'Usuário'}{r.observacoes ? <div className="mt-1 text-slate-600">{r.observacoes}</div> : null}</div>)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</div><div className="mt-1 font-semibold text-slate-900">{valor}</div></div>
}

function StatusCard({ label, valor, classe }: { label: string; valor: number; classe: string }) {
  return <div className={`rounded-xl border p-4 ${classe}`}><div className="text-sm font-medium">{label}</div><div className="mt-1 text-2xl font-bold">{valor}</div></div>
}
