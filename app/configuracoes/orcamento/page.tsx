'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Loader2, Save } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  CONFIGURACAO_ORCAMENTO_PADRAO,
  lerConfiguracaoOrcamento,
  salvarConfiguracaoOrcamento,
  type ConfiguracaoOrcamento,
} from '@/lib/configGeral'

export default function ConfiguracaoOrcamentoPage() {
  const [config, setConfig] = useState<ConfiguracaoOrcamento>(CONFIGURACAO_ORCAMENTO_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregar() {
      const usuario = await usuarioAtual()
      const master = usuario?.role === 'master'
      setAutorizado(master)
      if (master) setConfig(await lerConfiguracaoOrcamento())
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
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-start gap-3">
        <Link href="/configuracoes" className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Configurações</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-950"><FileText size={22} /> Orçamento</h1>
          <p className="mt-1 text-sm text-slate-500">Defina o padrão usado nos PDFs de orçamento do Atlas.</p>
        </div>
      </div>

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
