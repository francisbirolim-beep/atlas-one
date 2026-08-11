'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Play, UserRound, AlertTriangle, Paperclip } from 'lucide-react'
import { OrcamentoRapido, Usuario } from '@/lib/tipos'
import { usuarioAtual } from '@/lib/auth'
import {
  CadastroVenda,
  cadastroVendaDoCliente,
  camposFaltantesCadastroVenda,
  carregarConfirmacaoVenda,
  iniciarProcessoVenda,
  salvarCadastroVenda,
} from '@/lib/vendas'

const labelsCampos: Record<keyof CadastroVenda, string> = {
  nome: 'Nome completo / Razão social',
  cpf_cnpj: 'CPF / CNPJ',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  endereco: 'Endereço',
  bairro: 'Bairro',
  cidade: 'Cidade',
  cep: 'CEP',
  email: 'E-mail',
}

function tituloOrcamento(o: OrcamentoRapido) {
  const numero = o.numero ? `#${o.numero}` : o.id.slice(0, 8)
  const data = new Date(o.created_at).toLocaleDateString('pt-BR')
  return `Orçamento ${numero} — ${data}`
}

export default function ConfirmarVendaPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [orcamentoEntradaId, setOrcamentoEntradaId] = useState('')
  const [orcamentos, setOrcamentos] = useState<OrcamentoRapido[]>([])
  const [selecionadoId, setSelecionadoId] = useState('')
  const [clienteId, setClienteId] = useState<string | undefined>()
  const [cadastro, setCadastro] = useState<CadastroVenda | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [cadastroSalvo, setCadastroSalvo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    const id = new URLSearchParams(window.location.search).get('orcamento') || ''
    setOrcamentoEntradaId(id)
    if (!id) {
      setErro('Orçamento não informado.')
      setCarregando(false)
      return
    }

    carregarConfirmacaoVenda(id).then(dados => {
      if (!dados) {
        setErro('Não foi possível carregar o orçamento.')
        setCarregando(false)
        return
      }
      setOrcamentos(dados.orcamentosCliente)
      setSelecionadoId(dados.orcamentoAtual.id)
      setClienteId(dados.cliente?.id || dados.orcamentoAtual.cliente_id)
      setCadastro(cadastroVendaDoCliente(dados.cliente, dados.orcamentoAtual))
      setCarregando(false)
    })
  }, [])

  const selecionado = useMemo(
    () => orcamentos.find(o => o.id === selecionadoId) || null,
    [orcamentos, selecionadoId]
  )

  const faltantes = cadastro ? camposFaltantesCadastroVenda(cadastro) : []
  const itens = selecionado?.itens || []
  const anexos = selecionado?.anexos || []
  const prontoCadastro = !!cadastro && faltantes.length === 0 && cadastroSalvo
  const prontoItens = itens.length > 0

  function atualizarCampo(campo: keyof CadastroVenda, valor: string) {
    setCadastro(prev => prev ? { ...prev, [campo]: valor } : prev)
    setCadastroSalvo(false)
  }

  async function salvarCadastro() {
    if (!cadastro || !selecionado) return
    setErro('')
    setSalvandoCadastro(true)
    const resultado = await salvarCadastroVenda(clienteId, selecionado.id, cadastro)
    setSalvandoCadastro(false)
    if (!resultado.success) {
      setErro(resultado.error || 'Não foi possível salvar o cadastro.')
      return
    }
    setClienteId(resultado.clienteId)
    setCadastroSalvo(true)
  }

  async function iniciar() {
    if (!selecionado) return
    setErro('')
    if (!prontoCadastro) {
      setErro('Salve o cadastro completo do cliente antes de iniciar o processo.')
      return
    }
    if (!prontoItens) {
      setErro('O orçamento escolhido ainda não possui itens estruturados no Atlas.')
      return
    }

    setIniciando(true)
    const resultado = await iniciarProcessoVenda(selecionado.id, usuario)
    setIniciando(false)
    if (!resultado.success) {
      setErro(resultado.error || 'Não foi possível iniciar o processo da venda.')
      return
    }

    if (resultado.medicaoId) {
      router.push(`/producao/medicao-final/${resultado.medicaoId}`)
    } else {
      router.push('/producao/medicao-final')
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando confirmação da venda...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/kanban')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Confirmar venda</h1>
            <p className="text-xs text-slate-500">Nenhum processo operacional será criado antes desta confirmação.</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {erro && (
          <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserRound size={18} className="text-brand-navy" />
            <div>
              <h2 className="font-semibold text-slate-800">1. Cadastro completo do cliente</h2>
              <p className="text-xs text-slate-500">Os campos marcados com * são obrigatórios para uma venda fechada.</p>
            </div>
          </div>

          {cadastro && (
            <div className="grid md:grid-cols-2 gap-3">
              {(Object.keys(labelsCampos) as (keyof CadastroVenda)[]).map(campo => {
                const obrigatorio = ['nome', 'cpf_cnpj', 'telefone', 'endereco', 'bairro', 'cidade', 'cep'].includes(campo)
                return (
                  <label key={campo} className={campo === 'endereco' ? 'md:col-span-2' : ''}>
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {labelsCampos[campo]}{obrigatorio ? ' *' : ''}
                    </span>
                    <input
                      value={cadastro[campo]}
                      onChange={e => atualizarCampo(campo, e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                    />
                  </label>
                )
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-500">
              {faltantes.length > 0
                ? `Faltando: ${faltantes.map(f => labelsCampos[f]).join(', ')}`
                : cadastroSalvo
                  ? 'Cadastro completo e salvo.'
                  : 'Cadastro completo. Clique em salvar para confirmar.'}
            </div>
            <button
              onClick={salvarCadastro}
              disabled={!cadastro || faltantes.length > 0 || salvandoCadastro}
              className="px-4 py-2 rounded-xl bg-brand-navy text-white text-sm font-medium disabled:opacity-40"
            >
              {salvandoCadastro ? 'Salvando...' : 'Salvar cadastro'}
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-brand-navy" />
            <div>
              <h2 className="font-semibold text-slate-800">2. Qual orçamento foi fechado?</h2>
              <p className="text-xs text-slate-500">Um cliente pode ter várias propostas. Escolha exatamente a que foi aprovada.</p>
            </div>
          </div>

          <div className="space-y-2">
            {orcamentos.map(o => (
              <label
                key={o.id}
                className={`block rounded-xl border p-3 cursor-pointer ${selecionadoId === o.id ? 'border-brand-navy bg-brand-navyLight' : 'border-slate-200'}`}
              >
                <div className="flex gap-3 items-start">
                  <input
                    type="radio"
                    name="orcamento"
                    checked={selecionadoId === o.id}
                    onChange={() => {
                      setSelecionadoId(o.id)
                      setCadastroSalvo(false)
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{tituloOrcamento(o)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Valor: R$ {(o.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {o.itens?.length || 0} item(ns) estruturado(s)
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-800">3. Conferência do orçamento vendido</h2>
              <p className="text-xs text-slate-500">Esses dados serão a base da Medição Final e dos demais setores.</p>
            </div>
            <div className={`text-xs font-medium px-3 py-1 rounded-full ${prontoItens ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {prontoItens ? `${itens.length} item(ns) prontos` : 'Itens ainda não estruturados'}
            </div>
          </div>

          {selecionado && (
            <div className="space-y-4">
              {anexos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1"><Paperclip size={13} /> Anexos</p>
                  <div className="flex flex-wrap gap-2">
                    {anexos.map((a, i) => (
                      <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-brand-navy hover:bg-slate-200">
                        {a.titulo || a.nome}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {itens.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Este orçamento ainda não foi transformado em itens estruturados do Atlas. Na próxima etapa implementaremos a conversão do PDF W.Vetro para um Orçamento Atlas conferível. Até isso acontecer, o processo não será liberado sem peças.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {itens.map((item, idx) => (
                    <div key={item.id || idx} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Item {idx + 1}</p>
                      <p className="font-medium text-sm text-slate-800 mt-0.5">{item.ambiente || item.descricao || item.tipo_esquadria}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.tipo_esquadria} · qtd {item.quantidade || 1}</p>
                      {(item.largura_mm || item.altura_mm) ? (
                        <p className="text-xs text-slate-500">{item.largura_mm || '-'} x {item.altura_mm || '-'} mm</p>
                      ) : null}
                      {item.descricao && item.ambiente && <p className="text-xs text-slate-500 mt-1">{item.descricao}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-brand-navy text-white rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> 4. Iniciar processo da venda</div>
            <p className="text-xs text-white/70 mt-1">Somente agora serão criadas Medição Final e automações dos setores.</p>
          </div>
          <button
            onClick={iniciar}
            disabled={!prontoCadastro || !prontoItens || iniciando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-brand-navy font-semibold text-sm disabled:opacity-40"
          >
            <Play size={16} /> {iniciando ? 'Iniciando...' : 'Iniciar processo da venda'}
          </button>
        </section>

        {orcamentoEntradaId && selecionadoId !== orcamentoEntradaId && (
          <p className="text-xs text-slate-400 text-center">Você escolheu um orçamento diferente do card originalmente arrastado para Vendido.</p>
        )}
      </main>
    </div>
  )
}
