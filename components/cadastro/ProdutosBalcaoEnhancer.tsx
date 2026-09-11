'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { aplicarMargemBalcaoEmLote, type FiltroStatusProduto } from '@/lib/produtosConsulta'

function acharSecaoProdutos() {
  const secoes = Array.from(document.querySelectorAll('section'))
  return secoes.find(secao => secao.querySelector('h2')?.textContent?.trim() === 'Produtos cadastrados') || null
}

export default function ProdutosBalcaoEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [margem, setMargem] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let atual: HTMLElement | null = null
    const montar = () => {
      const secao = acharSecaoProdutos()
      if (!secao) return
      const existente = secao.querySelector<HTMLElement>('[data-atlas-margem-balcao-geral="1"]')
      if (existente) { atual = existente; setHost(existente); return }
      const alvo = document.createElement('div')
      alvo.dataset.atlasMargemBalcaoGeral = '1'
      const filhos = Array.from(secao.children)
      secao.insertBefore(alvo, filhos[1] || null)
      atual = alvo
      setHost(alvo)
    }

    montar()
    const observer = new MutationObserver(() => { if (!atual?.isConnected) montar() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const conteudo = useMemo(() => {
    if (!host) return null

    async function aplicar() {
      const valor = Number(margem.replace(',', '.'))
      if (!Number.isFinite(valor) || valor < 0 || valor >= 100) {
        setMensagem('Informe uma margem entre 0% e menos de 100%.')
        return
      }

      const secao = acharSecaoProdutos()
      const selects = secao ? Array.from(secao.querySelectorAll('select')) : []
      const categoria = (selects[0] as HTMLSelectElement | undefined)?.value || ''
      const linhaId = (selects[1] as HTMLSelectElement | undefined)?.value || ''
      const status = ((selects[2] as HTMLSelectElement | undefined)?.value || 'ativos') as FiltroStatusProduto
      const escopo = [categoria || 'todas as categorias', linhaId ? 'linha selecionada' : 'todas as linhas', status].join(' • ')
      if (!window.confirm(`Aplicar ${valor.toFixed(2)}% de margem balcão em todos os produtos deste filtro?\n\n${escopo}\n\nDepois você poderá alterar produtos individualmente.`)) return

      setAplicando(true)
      setMensagem('')
      const resultado = await aplicarMargemBalcaoEmLote({ margem: valor, categoria, linhaId, status })
      setAplicando(false)
      if (resultado.error) {
        setMensagem(`Não foi possível aplicar a margem: ${resultado.error}`)
        return
      }
      setMensagem(`${resultado.atualizados} produto(s) atualizado(s). Recarregando valores...`)
      window.setTimeout(() => window.location.reload(), 700)
    }

    return (
      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="block md:w-56">
            <span className="text-xs font-semibold text-indigo-900">Margem balcão geral (%)</span>
            <input
              value={margem}
              onChange={e => setMargem(e.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 35"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            disabled={aplicando}
            onClick={() => void aplicar()}
            className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {aplicando ? 'Aplicando...' : 'Aplicar ao filtro atual'}
          </button>
          <p className="text-xs text-indigo-800 md:pb-2">Use uma margem padrão para o grupo e depois altere qualquer produto individualmente em <strong>Editar</strong>.</p>
        </div>
        {mensagem && <p className="mt-2 text-xs font-medium text-indigo-900">{mensagem}</p>}
      </div>
    )
  }, [host, margem, aplicando, mensagem])

  if (!host || !conteudo) return null
  return createPortal(conteudo, host)
}
