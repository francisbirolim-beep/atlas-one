'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import {
  CONFIGURACAO_ORCAMENTO_PADRAO,
  lerConfiguracaoOrcamento,
  salvarConfiguracaoOrcamento,
  type ConfiguracaoOrcamento,
} from '@/lib/configGeral'

type RegraMargemCidade = {
  id: string
  cidade: string
  uf: string
  margem_pct: number
  versao?: number
  motivo?: string | null
}

export default function ConfiguracaoOrcamentoPage() {
  const [config, setConfig] = useState<ConfiguracaoOrcamento>(CONFIGURACAO_ORCAMENTO_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [mensagem, setMensagem] = useState('')

  const [margemPadrao, setMargemPadrao] = useState('40')
  const [regrasMargem, setRegrasMargem] = useState<RegraMargemCidade[]>([])
  const [cidadeMargem, setCidadeMargem] = useState('')
  const [ufMargem, setUfMargem] = useState('SP')
  const [valorMargemCidade, setValorMargemCidade] = useState('')
  const [motivoMargem, setMotivoMargem] = useState('')
  const [salvandoMargem, setSalvandoMargem] = useState(false)
  const [mensagemMargem, setMensagemMargem] = useState('')

  async function carregarMargens() {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
    const resp = await fetch('/api/configuracoes/orcamento/margens', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Não foi possível carregar as margens.')
    setMargemPadrao(String(Number(json.margemPadrao ?? 40)))
    setRegrasMargem(Array.isArray(json.regras) ? json.regras : [])
  }

  useEffect(() => {
    async function carregar() {
      const usuario = await usuarioAtual()
      const master = usuario?.role === 'master'
      setAutorizado(master)
      if (master) {
        const [configAtual] = await Promise.all([
          lerConfiguracaoOrcamento(),
          carregarMargens().catch(e => setMensagemMargem(e instanceof Error ? e.message : 'Falha ao carregar margens.')),
        ])
        setConfig(configAtual)
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  async function salvar() {
    setSalvando(true)
    setMensagem('')
    const ok = await salvarConfiguracaoOrcamento(config)
    setSalvando(false)
    setMensagem(ok ? 'Configurações do orçamento salvas.' : 'Não foi possível salvar as configurações.')
  }

  async function chamarApiMargem(body: Record<string, unknown>) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
    const resp = await fetch('/api/configuracoes/orcamento/margens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Não foi possível salvar a margem.')
    return json
  }

  async function salvarMargemPadrao() {
    setSalvandoMargem(true)
    setMensagemMargem('')
    try {
      await chamarApiMargem({ acao: 'salvar_padrao', margem: margemPadrao })
      await carregarMargens()
      setMensagemMargem('Margem padrão das outras cidades atualizada.')
    } catch (e) {
      setMensagemMargem(e instanceof Error ? e.message : 'Falha ao salvar margem padrão.')
    } finally {
      setSalvandoMargem(false)
    }
  }

  async function salvarMargemCidade() {
    setSalvandoMargem(true)
    setMensagemMargem('')
    try {
      await chamarApiMargem({
        acao: 'salvar_cidade',
        cidade: cidadeMargem,
        uf: ufMargem,
        margem: valorMargemCidade,
        motivo: motivoMargem || 'Política comercial por cidade',
      })
      setCidadeMargem('')
      setValorMargemCidade('')
      setMotivoMargem('')
      await carregarMargens()
      setMensagemMargem('Regra da cidade salva. Novos orçamentos usarão esta margem automaticamente.')
    } catch (e) {
      setMensagemMargem(e instanceof Error ? e.message : 'Falha ao salvar regra da cidade.')
    } finally {
      setSalvandoMargem(false)
    }
  }

  async function desativarMargemCidade(id: string) {
    setSalvandoMargem(true)
    setMensagemMargem('')
    try {
      await chamarApiMargem({ acao: 'desativar_cidade', id })
      await carregarMargens()
      setMensagemMargem('Regra desativada. A cidade volta a usar a margem padrão.')
    } catch (e) {
      setMensagemMargem(e instanceof Error ? e.message : 'Falha ao desativar regra.')
    } finally {
      setSalvandoMargem(false)
    }
  }

  if (carregando || autorizado === null) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
  }

  if (!autorizado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="font-semibold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-sm text-slate-500">Somente o usuário Master pode alterar o padrão dos orçamentos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-start gap-3">
        <Link href="/configuracoes" className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Configurações</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-950"><FileText size={22} /> Orçamento</h1>
          <p className="mt-1 text-sm text-slate-500">Defina o padrão dos orçamentos e a política de margem comercial.</p>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-900">Margem por cidade</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Defina uma margem para José Bonifácio ou outra cidade e mantenha uma margem padrão para todas as demais.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Somente Master</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="text-sm font-semibold text-slate-800">Margem padrão · outras cidades</label>
            <p className="mt-1 text-xs leading-5 text-slate-500">Usada quando não existir uma regra específica para a cidade do cliente/obra.</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={margemPadrao}
                onChange={e => setMargemPadrao(e.target.value)}
                className="w-32 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-slate-500"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
              <button
                type="button"
                onClick={() => void salvarMargemPadrao()}
                disabled={salvandoMargem}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {salvandoMargem ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar padrão
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">Criar / alterar regra específica</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_84px_110px]">
              <input
                value={cidadeMargem}
                onChange={e => setCidadeMargem(e.target.value.toUpperCase())}
                placeholder="CIDADE"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                value={ufMargem}
                maxLength={2}
                onChange={e => setUfMargem(e.target.value.toUpperCase())}
                placeholder="UF"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold outline-none focus:border-slate-500"
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={valorMargemCidade}
                  onChange={e => setValorMargemCidade(e.target.value)}
                  placeholder="Margem"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-8 text-sm outline-none focus:border-slate-500"
                />
                <span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={motivoMargem}
                onChange={e => setMotivoMargem(e.target.value)}
                placeholder="Motivo / observação (opcional)"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => void salvarMargemCidade()}
                disabled={salvandoMargem || !cidadeMargem.trim() || !valorMargemCidade.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Plus size={16} /> Salvar cidade
              </button>
            </div>
          </div>
        </div>

        {regrasMargem.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_70px_95px_46px] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <span>Cidade</span><span>UF</span><span>Margem</span><span />
            </div>
            {regrasMargem.map(regra => (
              <div key={regra.id} className="grid grid-cols-[1fr_70px_95px_46px] items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm">
                <span className="font-semibold text-slate-800">{regra.cidade}</span>
                <span className="text-slate-500">{regra.uf}</span>
                <span className="font-bold text-slate-800">{Number(regra.margem_pct || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                <button
                  type="button"
                  onClick={() => void desativarMargemCidade(regra.id)}
                  disabled={salvandoMargem}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  title="Desativar regra"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            Nenhuma cidade específica cadastrada. Todos os novos orçamentos usam a margem padrão.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-1 text-xs">
          {mensagemMargem && <p className={mensagemMargem.toLowerCase().includes('falha') || mensagemMargem.toLowerCase().includes('não foi') ? 'text-red-600' : 'text-emerald-700'}>{mensagemMargem}</p>}
          <p className="text-slate-400">A margem é gravada como snapshot no orçamento. Se você alterar manualmente um orçamento, uma sincronização do W.Vetro não sobrescreve esse ajuste.</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className="text-sm font-semibold text-slate-700">Título do documento</label>
            <input
              value={config.tituloDocumento}
              onChange={e => setConfig(prev => ({ ...prev, tituloDocumento: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              placeholder="ORÇAMENTO"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Validade padrão da proposta</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={config.validadeDias}
                onChange={e => setConfig(prev => ({ ...prev, validadeDias: Number(e.target.value) }))}
                className="w-28 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <span className="text-sm text-slate-500">dias</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Observação padrão</label>
            <textarea
              value={config.observacaoPadrao}
              onChange={e => setConfig(prev => ({ ...prev, observacaoPadrao: e.target.value }))}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              placeholder="Condições comerciais, validade, prazo etc."
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Rodapé</label>
            <input
              value={config.rodape}
              onChange={e => setConfig(prev => ({ ...prev, rodape: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              placeholder="Esquadrifácio Soluções em Alumínio"
            />
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            {[
              ['mostrarFoto', 'Mostrar fotos dos itens'],
              ['mostrarPrecoUnitario', 'Mostrar preço unitário'],
              ['mostrarAssinatura', 'Mostrar campo de aceite/assinatura'],
            ].map(([chave, label]) => (
              <label key={chave} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(config[chave as keyof ConfiguracaoOrcamento])}
                  onChange={e => setConfig(prev => ({ ...prev, [chave]: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className={`text-xs ${mensagem.includes('salvas') ? 'text-emerald-600' : 'text-red-500'}`}>{mensagem}</p>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Prévia do padrão</p>
          <h2 className="mt-3 text-xl font-bold">{config.tituloDocumento || 'ORÇAMENTO'}</h2>
          <p className="mt-1 text-xs text-slate-400">Validade: {config.validadeDias || 7} dias</p>
          <div className="my-4 border-t border-white/10" />
          <p className="text-xs leading-5 text-slate-300">{config.observacaoPadrao || 'Sem observação padrão.'}</p>
          <div className="mt-5 space-y-2 text-xs text-slate-400">
            <p>{config.mostrarFoto ? '✓ Fotos dos itens' : '– Sem fotos dos itens'}</p>
            <p>{config.mostrarPrecoUnitario ? '✓ Preço unitário' : '– Sem preço unitário'}</p>
            <p>{config.mostrarAssinatura ? '✓ Campo de aceite' : '– Sem campo de aceite'}</p>
          </div>
          {config.rodape && <p className="mt-6 border-t border-white/10 pt-4 text-[11px] text-slate-500">{config.rodape}</p>}
        </aside>
      </div>
    </div>
  )
}