'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { aplicarMargemBalcaoEmLote, type FiltroStatusProduto } from '@/lib/produtosConsulta'
import { supabase } from '@/lib/supabase'

function acharSecaoProdutos() {
  const secoes = Array.from(document.querySelectorAll('section'))
  return secoes.find(secao => secao.querySelector('h2')?.textContent?.trim() === 'Produtos cadastrados') || null
}

function decorarCards() {
  const secao = acharSecaoProdutos()
  if (!secao) return { faltando: false }
  let faltando = false
  const botoesEditar = Array.from(secao.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Editar')

  for (const botao of botoesEditar) {
    const card = botao.closest<HTMLElement>('.rounded-xl')
    if (!card) continue

    const spans = Array.from(card.querySelectorAll('span'))
    const rotuloCusto = spans.find(s => s.textContent?.trim() === 'Custo')
    const caixaCusto = rotuloCusto?.parentElement
    const valorCusto = caixaCusto?.querySelector('div')
    if (valorCusto?.textContent?.trim() === '—' || valorCusto?.textContent?.trim() === 'Sem custo cadastrado') {
      faltando = true
      if (valorCusto.textContent?.trim() === '—') {
        valorCusto.textContent = 'Buscando no W.Vetro...'
        valorCusto.classList.add('text-amber-700')
      }
      if (!caixaCusto?.querySelector('[data-atlas-custo-manual="1"]')) {
        const acao = document.createElement('button')
        acao.type = 'button'
        acao.dataset.atlasCustoManual = '1'
        acao.textContent = 'Cadastrar manualmente'
        acao.className = 'mt-1 text-[11px] font-semibold text-brand-navy underline'
        acao.addEventListener('click', () => (botao as HTMLButtonElement).click())
        caixaCusto?.appendChild(acao)
      }
    }

    const img = card.querySelector<HTMLImageElement>('img')
    if (img && img.dataset.atlasTratado !== '1') {
      img.dataset.atlasTratado = '1'
      const falhou = () => {
        if (img.dataset.atlasFalhou === '1') return
        img.dataset.atlasFalhou = '1'
        faltando = true
        img.style.display = 'none'
        if (!img.parentElement?.querySelector('[data-atlas-desenho-pendente="1"]')) {
          const aviso = document.createElement('div')
          aviso.dataset.atlasDesenhoPendente = '1'
          aviso.className = 'w-14 h-12 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-1 text-[9px] leading-tight text-amber-700 flex items-center justify-center text-center'
          aviso.textContent = 'Buscando desenho no W.Vetro...'
          img.parentElement?.insertBefore(aviso, img)
        }
      }
      img.addEventListener('error', falhou, { once: true })
      if (img.complete && img.naturalWidth === 0) falhou()
    }
    if (card.querySelector('[data-atlas-desenho-pendente="1"]')) faltando = true
  }
  return { faltando }
}

export default function ProdutosBalcaoEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [margem, setMargem] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const sincronizar = useCallback(async (automatico = false) => {
    if (sincronizando) return
    setSincronizando(true)
    setMensagem(automatico ? 'Importando custos e desenhos do W.Vetro...' : 'Sincronizando custos e desenhos com o W.Vetro...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const resp = await fetch('/api/integracoes/wvetro/produtos/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ maxNotas: 50 }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json.error || 'Falha ao sincronizar W.Vetro.')
      const custos = Number(json?.custos?.atualizados || 0)
      const imagens = Number(json?.imagens?.copiadas || 0)
      const restantes = Number(json?.custos?.semCusto || 0)
      setMensagem(`W.Vetro sincronizado: ${custos} custo(s) importado(s) e ${imagens} desenho(s) copiado(s). ${restantes} acessório(s) ainda sem histórico de custo.`)
      window.setTimeout(() => window.location.reload(), 1400)
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : 'Não foi possível sincronizar o W.Vetro.')
    } finally {
      setSincronizando(false)
    }
  }, [sincronizando])

  useEffect(() => {
    let atual: HTMLElement | null = null
    let timer: number | null = null
    let autoTimer: number | null = null
    const montar = () => {
      const secao = acharSecaoProdutos()
      if (!secao) return
      const existente = secao.querySelector<HTMLElement>('[data-atlas-margem-balcao-geral="1"]')
      if (existente) { atual = existente; setHost(existente) }
      else {
        const alvo = document.createElement('div')
        alvo.dataset.atlasMargemBalcaoGeral = '1'
        const filhos = Array.from(secao.children)
        secao.insertBefore(alvo, filhos[1] || null)
        atual = alvo
        setHost(alvo)
      }
      const estado = decorarCards()
      if (estado.faltando && !sessionStorage.getItem('atlas-wvetro-produtos-auto-v1') && !autoTimer) {
        sessionStorage.setItem('atlas-wvetro-produtos-auto-v1', '1')
        autoTimer = window.setTimeout(() => void sincronizar(true), 250)
      }
    }

    montar()
    const observer = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!atual?.isConnected) montar()
        else montar()
      }, 100)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
      if (autoTimer) window.clearTimeout(autoTimer)
    }
  }, [sincronizar])

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
      if (!window.confirm(`Aplicar ${valor.toFixed(2)}% de margem balcão somente nos produtos com custo conhecido?\n\n${escopo}\n\nProdutos sem custo ficam pendentes até o W.Vetro retornar um custo ou você cadastrar manualmente.`)) return

      setAplicando(true)
      setMensagem('')
      const resultado = await aplicarMargemBalcaoEmLote({ margem: valor, categoria, linhaId, status })
      setAplicando(false)
      if (resultado.error) {
        setMensagem(`Não foi possível aplicar a margem: ${resultado.error}`)
        return
      }
      setMensagem(`${resultado.atualizados} produto(s) com custo receberam a margem. Recarregando valores...`)
      window.setTimeout(() => window.location.reload(), 700)
    }

    return (
      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block lg:w-52">
            <span className="text-xs font-semibold text-indigo-900">Margem balcão geral (%)</span>
            <input
              value={margem}
              onChange={e => setMargem(e.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 35"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </label>
          <button type="button" disabled={aplicando || sincronizando} onClick={() => void aplicar()} className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {aplicando ? 'Aplicando...' : 'Aplicar ao filtro atual'}
          </button>
          <button type="button" disabled={sincronizando || aplicando} onClick={() => void sincronizar(false)} className="rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 disabled:opacity-50">
            {sincronizando ? 'Sincronizando W.Vetro...' : 'Sincronizar W.Vetro'}
          </button>
          <p className="text-xs text-indigo-800 lg:pb-2">O Atlas importa primeiro <strong>custo e desenho</strong> do W.Vetro. A margem é aplicada só onde existe custo; depois cada produto pode ser alterado em <strong>Editar</strong>.</p>
        </div>
        {mensagem && <p className="mt-2 text-xs font-medium text-indigo-900">{mensagem}</p>}
      </div>
    )
  }, [host, margem, aplicando, sincronizando, mensagem, sincronizar])

  if (!host || !conteudo) return null
  return createPortal(conteudo, host)
}
