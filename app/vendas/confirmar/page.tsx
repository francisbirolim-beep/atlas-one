'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Play, UserRound, AlertTriangle, Paperclip, Building2, Plus, Trash2 } from 'lucide-react'
import { OrcamentoRapido, Usuario } from '@/lib/tipos'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { criarObraCliente, listarObrasCliente, type ObraCliente360 } from '@/lib/cliente360'
import {
  CadastroVenda,
  camposFaltantesCadastroVenda,
  carregarConfirmacaoVenda,
  iniciarProcessoVenda,
  salvarCadastroVenda,
} from '@/lib/vendas'
import {
  CampoConfiguravel,
  camposDoContexto,
  listarCamposConfiguraveis,
} from '@/lib/camposConfiguraveis'

function tituloOrcamento(o: OrcamentoRapido) {
  const numero = o.numero ? `#${o.numero}` : o.id.slice(0, 8)
  const data = new Date(o.created_at).toLocaleDateString('pt-BR')
  return `Orçamento ${numero} — ${data}`
}

function tipoInput(campo: CampoConfiguravel) {
  if (campo.tipo === 'data') return 'date'
  if (campo.tipo === 'email') return 'email'
  if (campo.tipo === 'numero' || campo.tipo === 'moeda') return 'number'
  if (campo.tipo === 'telefone') return 'tel'
  return 'text'
}

function itemEstruturadoValido(item: any) {
  const ambiente = String(item?.ambiente || '').trim()
  const descricao = String(item?.descricao || '').trim()
  const tipoOutro = String(item?.tipo_outro_texto || '').trim()
  const largura = Number(item?.largura_mm || 0)
  const altura = Number(item?.altura_mm || 0)
  const nomeGenerico = [ambiente, descricao, tipoOutro].some(valor => /^item\s+\d+$/i.test(valor))
  const somenteOutro = String(item?.tipo_esquadria || '').toLowerCase() === 'outro' && !descricao && !tipoOutro
  return !nomeGenerico && !somenteOutro && largura > 0 && altura > 0 && !!ambiente && !!descricao
}

export default function ConfirmarVendaPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [orcamentoEntradaId, setOrcamentoEntradaId] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoRapido[]>([])
  const [selecionadoId, setSelecionadoId] = useState('')
  const [clienteId, setClienteId] = useState<string | undefined>()
  const [cadastro, setCadastro] = useState<CadastroVenda | null>(null)
  const [camposConfigurados, setCamposConfigurados] = useState<CampoConfiguravel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [importandoItens, setImportandoItens] = useState(false)
  const [salvandoItensPreview, setSalvandoItensPreview] = useState(false)
  const [itensPreview, setItensPreview] = useState<any[] | null>(null)
  const [cadastroSalvo, setCadastroSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [obras, setObras] = useState<ObraCliente360[]>([])
  const [obraId, setObraId] = useState('')
  const [novaObraNome, setNovaObraNome] = useState('')
  const [criandoObra, setCriandoObra] = useState(false)

  async function carregarObras(cliente: string | undefined) {
    if (!cliente) { setObras([]); return }
    setObras(await listarObrasCliente(cliente))
  }

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    const id = new URLSearchParams(window.location.search).get('orcamento') || ''
    setOrcamentoEntradaId(id)
    if (!id) {
      setErro('Orçamento não informado.')
      setCarregando(false)
      return
    }

    Promise.all([carregarConfirmacaoVenda(id), listarCamposConfiguraveis()]).then(async ([dados, campos]) => {
      if (!dados) {
        setErro('Não foi possível carregar o orçamento.')
        setCarregando(false)
        return
      }
      setCamposConfigurados(campos)
      setOrcamentos(dados.orcamentosCliente)
      setSelecionadoId(dados.orcamentoAtual.id)
      const idCliente = dados.cliente?.id || dados.orcamentoAtual.cliente_id
      setClienteId(idCliente)
      setCadastro(dados.dadosVenda)
      setCadastroSalvo(!!idCliente)
      setObraId((dados.orcamentoAtual as any).obra_id || '')
      await carregarObras(idCliente)
      setCarregando(false)
    })
  }, [])

  const selecionado = useMemo(
    () => orcamentos.find(o => o.id === selecionadoId) || null,
    [orcamentos, selecionadoId]
  )

  const camposVenda = useMemo(
    () => camposDoContexto(camposConfigurados, 'confirmacao_venda'),
    [camposConfigurados]
  )

  const faltantes = cadastro ? camposFaltantesCadastroVenda(cadastro, camposConfigurados) : []
  const itens = selecionado?.itens || []
  const anexos = selecionado?.anexos || []
  const itensInvalidos = itens.filter(item => !itemEstruturadoValido(item))
  const previewInvalidos = (itensPreview || []).filter(item => !itemEstruturadoValido(item))
  const temPdf = anexos.some(a => (a.nome || '').toLowerCase().endsWith('.pdf') || (a.url || '').toLowerCase().split('?')[0].endsWith('.pdf'))
  const prontoCadastro = !!cadastro && faltantes.length === 0 && cadastroSalvo
  const prontoItens = itens.length > 0 && itensInvalidos.length === 0

  function atualizarCampo(chave: string, valor: string) {
    setCadastro(prev => prev ? { ...prev, [chave]: valor } : prev)
    setCadastroSalvo(false)
  }

  function selecionarOrcamento(o: OrcamentoRapido) {
    setSelecionadoId(o.id)
    setCadastroSalvo(false)
    setItensPreview(null)
    setErro('')
    setMensagem('')
    setObraId((o as any).obra_id || '')
  }

  async function salvarCadastro() {
    if (!cadastro || !selecionado) return
    setErro('')
    setMensagem('')
    setSalvandoCadastro(true)
    const resultado = await salvarCadastroVenda(clienteId, selecionado.id, cadastro, camposConfigurados)
    setSalvandoCadastro(false)
    if (!resultado.success) {
      setErro(resultado.error || 'Não foi possível salvar o cadastro.')
      return
    }
    setClienteId(resultado.clienteId)
    setCadastroSalvo(true)
    await carregarObras(resultado.clienteId)
  }

  async function criarNovaObra() {
    if (!clienteId || !novaObraNome.trim()) return
    setCriandoObra(true); setErro('')
    const r = await criarObraCliente(clienteId, { nome: novaObraNome.trim(), status: 'planejamento' })
    setCriandoObra(false)
    if (!r.ok || !r.obra) { setErro(r.error || 'Não foi possível criar a obra.'); return }
    setObras(prev => [r.obra!, ...prev])
    setObraId(r.obra.id)
    setNovaObraNome('')
  }

  async function iniciar() {
    if (!selecionado) return
    setErro('')
    setMensagem('')
    if (!prontoCadastro) {
      setErro('Salve o cadastro completo do cliente antes de iniciar o processo.')
      return
    }
    if (!prontoItens) {
      setErro('O orçamento escolhido possui itens incompletos ou genéricos. Revise e confirme a importação do PDF antes de iniciar o processo.')
      return
    }

    const { error: erroObra } = await supabase.from('orcamentos').update({ obra_id: obraId || null }).eq('id', selecionado.id)
    if (erroObra) { setErro('Não foi possível vincular a obra: ' + erroObra.message); return }

    setIniciando(true)
    const resultado = await iniciarProcessoVenda(selecionado.id, usuario, camposConfigurados)
    setIniciando(false)
    if (!resultado.success) {
      setErro(resultado.error || 'Não foi possível iniciar o processo da venda.')
      return
    }

    router.push('/setor/engenharia-projeto')
  }

  async function importarItensDoPdf() {
    if (!selecionado) return
    setErro('')
    setMensagem('')
    setImportandoItens(true)
    try {
      const token = await tokenAtual()
      if (!token) {
        setErro('Sua sessão expirou. Entre novamente no Atlas para importar os itens.')
        return
      }

      const resp = await fetch('/api/importar-itens-orcamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orcamentoId: selecionado.id, persistirOrcamento: false }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setErro(json?.error || 'Não foi possível importar os itens do PDF.')
        return
      }

      const novosItens = Array.isArray(json?.itens) ? json.itens : []
      if (novosItens.length === 0) {
        setErro('O PDF foi lido, mas nenhum item foi identificado. Cadastre os itens manualmente.')
        return
      }

      setItensPreview(novosItens)
      if (Number(json?.itens_incompletos || 0) > 0) {
        setMensagem(`O Atlas encontrou ${novosItens.length} item(ns). ${json.itens_incompletos} precisam de correção antes de salvar.`)
      } else {
        setMensagem(`O Atlas encontrou ${novosItens.length} item(ns). Confira os dados e confirme para salvar no orçamento.`)
      }
    } catch {
      setErro('Erro ao importar os itens do PDF. Tente novamente.')
    } finally {
      setImportandoItens(false)
    }
  }

  function atualizarItemPreview(index: number, campo: string, valor: string | number) {
    setItensPreview(prev => prev ? prev.map((item, idx) => idx === index ? { ...item, [campo]: valor } : item) : prev)
  }

  function removerItemPreview(index: number) {
    setItensPreview(prev => prev ? prev.filter((_, idx) => idx !== index) : prev)
  }

  function adicionarItemPreview() {
    setItensPreview(prev => [
      ...(prev || []),
      {
        id: `novo-${Date.now()}`,
        ambiente: '',
        tipo_esquadria: 'outro',
        tipo_outro_texto: '',
        descricao: '',
        largura_mm: 0,
        altura_mm: 0,
        quantidade: 1,
        cor: '',
        linha_origem: '',
        vidro_origem: '',
      },
    ])
  }

  async function confirmarItensDoPdf() {
    if (!selecionado || !itensPreview) return
    setErro('')
    setMensagem('')

    if (itensPreview.length === 0) {
      setErro('Inclua pelo menos um item antes de confirmar.')
      return
    }
    if (previewInvalidos.length > 0) {
      setErro(`Ainda existem ${previewInvalidos.length} item(ns) incompletos. Preencha ambiente, descrição, largura e altura.`)
      return
    }

    setSalvandoItensPreview(true)
    try {
      const token = await tokenAtual()
      if (!token) {
        setErro('Sua sessão expirou. Entre novamente no Atlas para salvar os itens.')
        return
      }

      const resp = await fetch('/api/importar-itens-orcamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orcamentoId: selecionado.id,
          persistirOrcamento: true,
          itensConfirmados: itensPreview,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setErro(json?.error || 'Não foi possível salvar os itens conferidos.')
        return
      }

      const itensSalvos = Array.isArray(json?.itens) ? json.itens : []
      setOrcamentos(prev => prev.map(o => o.id === selecionado.id ? { ...o, itens: itensSalvos } : o))
      setItensPreview(null)
      setMensagem(`${itensSalvos.length} item(ns) conferidos e salvos no orçamento.`)
    } catch {
      setErro('Erro ao salvar os itens conferidos. Tente novamente.')
    } finally {
      setSalvandoItensPreview(false)
    }
  }

  function campoFormulario(campo: CampoConfiguravel) {
    const valor = cadastro?.[campo.chave] || ''
    const classe = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/20'

    if (campo.tipo === 'selecao') {
      return (
        <select value={valor} onChange={e => atualizarCampo(campo.chave, e.target.value)} className={classe}>
          <option value="">Selecione...</option>
          {(campo.opcoes || []).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
        </select>
      )
    }

    if (campo.tipo === 'booleano') {
      return (
        <select value={valor} onChange={e => atualizarCampo(campo.chave, e.target.value)} className={classe}>
          <option value="">Selecione...</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      )
    }

    if (campo.tipo === 'texto_longo') {
      return <textarea value={valor} onChange={e => atualizarCampo(campo.chave, e.target.value)} className={`${classe} min-h-24`} placeholder={campo.placeholder} />
    }

    return (
      <input type={tipoInput(campo)} value={valor} onChange={e => atualizarCampo(campo.chave, e.target.value)} className={classe} placeholder={campo.placeholder} step={campo.tipo === 'moeda' ? '0.01' : undefined} />
    )
  }

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando confirmação da venda...</div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3"><button onClick={() => router.push('/kanban')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={18}/></button><div><h1 className="text-lg font-bold text-brand-navy">Confirmar venda</h1><p className="text-xs text-slate-500">A confirmação cria o Financeiro e envia a obra para Conferir Projeto. Os demais fluxos só nascem depois da conferência.</p></div></div></header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {erro && (
          <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}
        {mensagem && (
          <div className="flex gap-2 items-start rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
            <span>{mensagem}</span>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><UserRound size={18} className="text-brand-navy"/><div><h2 className="font-semibold text-slate-800">1. Cadastro e dados da venda</h2><p className="text-xs text-slate-500">Campos, ordem e obrigatoriedade obedecem às Configurações do Atlas.</p></div></div>
          {cadastro && <div className="grid md:grid-cols-2 gap-3">{camposVenda.map(campo => <label key={campo.id} className={campo.tipo === 'texto_longo' ? 'md:col-span-2' : ''}><span className="block text-xs font-medium text-slate-600 mb-1">{campo.label}{campo.obrigatorioEm.includes('confirmacao_venda') ? ' *' : ''}</span>{campoFormulario(campo)}{campo.ajuda && <span className="block mt-1 text-[11px] text-slate-400">{campo.ajuda}</span>}</label>)}</div>}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap"><div className="text-xs text-slate-500">{faltantes.length > 0 ? `Faltando: ${faltantes.map(f => f.label).join(', ')}` : cadastroSalvo ? 'Cadastro e dados da venda completos e salvos.' : 'Dados completos. Clique em salvar para confirmar.'}</div><button onClick={salvarCadastro} disabled={!cadastro || faltantes.length > 0 || salvandoCadastro} className="px-4 py-2 rounded-xl bg-brand-navy text-white text-sm font-medium disabled:opacity-40">{salvandoCadastro ? 'Salvando...' : 'Salvar dados da venda'}</button></div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Building2 size={18} className="text-brand-navy"/><div><h2 className="font-semibold text-slate-800">2. Vincular a uma obra</h2><p className="text-xs text-slate-500">Opcional, mas recomendado. Tudo que nascer depois — Financeiro, Projeto, Compras e Produção — já herda esta obra.</p></div></div>
          {!clienteId ? <p className="text-sm text-slate-400">Salve primeiro o cadastro do cliente.</p> : <div className="grid md:grid-cols-2 gap-3">
            <label><span className="block text-xs font-medium text-slate-600 mb-1">Obra existente</span><select value={obraId} onChange={e => setObraId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sem obra definida</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
            <div><span className="block text-xs font-medium text-slate-600 mb-1">Ou criar nova obra</span><div className="flex gap-2"><input value={novaObraNome} onChange={e => setNovaObraNome(e.target.value)} placeholder="Ex.: Residência Maurício Lima" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"/><button onClick={criarNovaObra} disabled={!novaObraNome.trim() || criandoObra} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-brand-navy disabled:opacity-40"><Plus size={15}/>{criandoObra ? 'Criando...' : 'Criar'}</button></div></div>
          </div>}
          {obraId && <p className="mt-3 text-xs text-emerald-700">Obra selecionada: <b>{obras.find(o => o.id === obraId)?.nome || 'obra vinculada'}</b>.</p>}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-brand-navy" />
            <div>
              <h2 className="font-semibold text-slate-800">3. Qual orçamento foi fechado?</h2>
              <p className="text-xs text-slate-500">Um cliente pode ter várias propostas. Escolha exatamente a que foi aprovada.</p>
            </div>
          </div>

          <div className="space-y-2">
            {orcamentos.map(o => (
              <label key={o.id} className={`block rounded-xl border p-3 cursor-pointer ${selecionadoId === o.id ? 'border-brand-navy bg-brand-navyLight' : 'border-slate-200'}`}>
                <div className="flex gap-3 items-start">
                  <input type="radio" name="orcamento" checked={selecionadoId === o.id} onChange={() => selecionarOrcamento(o)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{tituloOrcamento(o)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Valor: R$ {(o.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {o.itens?.length || 0} item(ns) cadastrado(s)</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-800">4. Conferência do orçamento vendido</h2>
              <p className="text-xs text-slate-500">O PDF é lido primeiro. Nada é gravado até você revisar e confirmar os itens.</p>
            </div>
            <div className={`text-xs font-medium px-3 py-1 rounded-full ${prontoItens ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {itensPreview
                ? `${itensPreview.length} item(ns) em conferência`
                : prontoItens
                  ? `${itens.length} item(ns) prontos`
                  : itens.length > 0 ? `${itensInvalidos.length} item(ns) precisam revisão` : 'Itens ainda não estruturados'}
            </div>
          </div>

          {selecionado && (
            <div className="space-y-4">
              {anexos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1"><Paperclip size={13} /> Anexos</p>
                  <div className="flex flex-wrap gap-2">
                    {anexos.map((a, i) => <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-brand-navy hover:bg-slate-200">{a.titulo || a.nome}</a>)}
                  </div>
                </div>
              )}

              {itensPreview ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="font-semibold">Confira cada peça antes de salvar.</p>
                    <p className="mt-1 text-xs text-blue-800">Você pode corrigir os dados, remover um item ou adicionar uma peça que não tenha sido reconhecida pelo PDF.</p>
                  </div>

                  <div className="space-y-3">
                    {itensPreview.map((item, idx) => {
                      const valido = itemEstruturadoValido(item)
                      return (
                        <div key={item.id || idx} className={`rounded-xl border p-4 ${valido ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'}`}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Item {idx + 1}</p>
                              <p className={`text-[11px] ${valido ? 'text-emerald-700' : 'text-amber-700'}`}>{valido ? 'Pronto para salvar' : 'Preencha os campos obrigatórios'}</p>
                            </div>
                            <button type="button" onClick={() => removerItemPreview(idx)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                              <Trash2 size={13} /> Remover
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Ambiente *</span>
                              <input value={item.ambiente || ''} onChange={e => atualizarItemPreview(idx, 'ambiente', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Quarto do fundo" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Cor</span>
                              <input value={item.cor || ''} onChange={e => atualizarItemPreview(idx, 'cor', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Preto fosco" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Linha</span>
                              <input value={item.linha_origem || ''} onChange={e => atualizarItemPreview(idx, 'linha_origem', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Suprema" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Vidro</span>
                              <input value={item.vidro_origem || ''} onChange={e => atualizarItemPreview(idx, 'vidro_origem', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Incolor 6 mm temperado" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Largura (mm) *</span>
                              <input type="number" min="1" value={Number(item.largura_mm || 0) || ''} onChange={e => atualizarItemPreview(idx, 'largura_mm', Number(e.target.value || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Altura (mm) *</span>
                              <input type="number" min="1" value={Number(item.altura_mm || 0) || ''} onChange={e => atualizarItemPreview(idx, 'altura_mm', Number(e.target.value || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs font-medium text-slate-600">Quantidade *</span>
                              <input type="number" min="1" value={Number(item.quantidade || 1)} onChange={e => atualizarItemPreview(idx, 'quantidade', Math.max(1, Number(e.target.value || 1)))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label className="md:col-span-2">
                              <span className="mb-1 block text-xs font-medium text-slate-600">Descrição / tipo da esquadria *</span>
                              <textarea value={item.descricao || ''} onChange={e => atualizarItemPreview(idx, 'descricao', e.target.value)} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Descrição identificada no W.Vetro" />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <button type="button" onClick={adicionarItemPreview} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      <Plus size={14} /> Adicionar item
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setItensPreview(null); setMensagem(''); setErro('') }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Cancelar conferência
                      </button>
                      <button type="button" onClick={confirmarItensDoPdf} disabled={salvandoItensPreview || previewInvalidos.length > 0 || itensPreview.length === 0} className="rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        {salvandoItensPreview ? 'Salvando...' : `Confirmar e salvar ${itensPreview.length} item(ns)`}
                      </button>
                    </div>
                  </div>
                </div>
              ) : !prontoItens ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">
                    {itens.length > 0
                      ? 'Os itens existentes são antigos, genéricos ou estão sem medidas suficientes.'
                      : 'Este orçamento possui anexos, mas ainda não tem itens estruturados no Atlas.'}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {itens.length > 0
                      ? 'Leia novamente o PDF. O Atlas vai mostrar as peças para conferência antes de substituir os itens atuais.'
                      : 'Leia o PDF para conferir as peças antes de gravar ou cadastre os itens manualmente.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {temPdf && (
                      <button
                        type="button"
                        onClick={importarItensDoPdf}
                        disabled={importandoItens}
                        className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {importandoItens ? 'Lendo PDF...' : itens.length > 0 ? 'Ler PDF e conferir novamente' : 'Ler PDF e conferir itens'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push(`/kanban?orcamento=${selecionado.id}`)}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Cadastrar itens manualmente
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    {itens.map((item: any, idx) => (
                      <div key={item.id || idx} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-400">Item {idx + 1}</p>
                        <p className="font-medium text-sm text-slate-800 mt-0.5">{item.ambiente || item.descricao || item.tipo_esquadria}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.tipo_esquadria} · qtd {item.quantidade || 1}</p>
                        <p className="text-xs text-slate-500">{item.largura_mm || '-'} x {item.altura_mm || '-'} mm</p>
                        {item.linha_origem && <p className="text-xs text-slate-500">Linha: {item.linha_origem}</p>}
                        {item.vidro_origem && <p className="text-xs text-slate-500">Vidro: {item.vidro_origem}</p>}
                        {item.descricao && item.ambiente && <p className="text-xs text-slate-500 mt-1">{item.descricao}</p>}
                      </div>
                    ))}
                  </div>
                  {temPdf && (
                    <button type="button" onClick={importarItensDoPdf} disabled={importandoItens} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {importandoItens ? 'Lendo PDF...' : 'Reimportar PDF e revisar itens'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-brand-navy text-white rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> 5. Confirmar venda e iniciar Engenharia</div>
            <p className="text-xs text-white/70 mt-1">Agora nascem o Financeiro e o card Conferir Projeto. A obra selecionada acompanha todos os próximos setores.</p>
          </div>
          <button onClick={iniciar} disabled={!prontoCadastro || !prontoItens || iniciando || !!itensPreview} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-brand-navy font-semibold text-sm disabled:opacity-40">
            <Play size={16} /> {iniciando ? 'Confirmando...' : 'Confirmar venda'}
          </button>
        </section>

        {orcamentoEntradaId && selecionadoId !== orcamentoEntradaId && <p className="text-xs text-slate-400 text-center">Você escolheu um orçamento diferente do card originalmente arrastado para Vendido.</p>}
      </main>
    </div>
  )
}
