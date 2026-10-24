'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { medicaoIdDaRota } from '@/lib/medicaoRota'
import { supabase } from '@/lib/supabase'

const ATUAL = 'atlas-navegacao-atual'
const ANTERIOR = 'atlas-navegacao-anterior'

function interna(href: string | null): href is string {
  return Boolean(href && href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/login'))
}

function fallbackDaRota(rota: string) {
  if (rota.startsWith('/producao/medicao-final/')) return '/producao/medicao-final'
  if (/^\/clientes\/[^/]+\/vendas\/[^/]+/.test(rota)) return rota.split('/').slice(0, 3).join('/')
  if (/^\/clientes\/[^/]+/.test(rota)) return '/clientes'
  const partes = rota.split('/').filter(Boolean)
  return partes.length <= 1 ? '/' : '/' + partes.slice(0, -1).join('/')
}

// O botão pertence ao aplicativo, não ao navegador do celular; não sai para sites externos.
export default function AtlasVoltar() {
  const pathname = usePathname()
  const router = useRouter()
  const [destinoMedicao, setDestinoMedicao] = useState<string | null>(null)
  const medicaoId = medicaoIdDaRota(pathname)

  useEffect(() => {
    const atual = pathname + window.location.search
    const anterior = window.sessionStorage.getItem(ATUAL)
    if (interna(anterior) && anterior !== atual) window.sessionStorage.setItem(ANTERIOR, anterior)
    window.sessionStorage.setItem(ATUAL, atual)

    let ativo = true
    setDestinoMedicao(null)
    if (!medicaoId) return () => { ativo = false }
    async function localizarVenda() {
      const { data: medicao } = await supabase.from('medicoes_finais')
        .select('cliente_id,orcamento_id').eq('id', medicaoId).maybeSingle()
      if (!medicao?.cliente_id || !medicao?.orcamento_id) return
      const { data: venda } = await supabase.from('vendas_obras')
        .select('id').eq('cliente_id', medicao.cliente_id)
        .eq('orcamento_id', medicao.orcamento_id).limit(1).maybeSingle()
      if (ativo && venda?.id) setDestinoMedicao(
        `/clientes/${medicao.cliente_id}/vendas/${venda.id}?aba=medida-final`
      )
    }
    void localizarVenda()
    return () => { ativo = false }
  }, [pathname, medicaoId])

  if (!pathname || pathname === '/' || pathname === '/login') return null

  function voltar() {
    const atual = pathname + window.location.search
    const anterior = window.sessionStorage.getItem(ANTERIOR)
    const origemExplicita = medicaoId
      ? window.sessionStorage.getItem(`atlas-medicao-retorno:${medicaoId}`) : null
    let destino = ''
    // Ao sair da Medição Final aberta pela venda, a volta conserva a aba Medida Final.
    if (medicaoId && interna(origemExplicita) && anterior?.startsWith('/clientes/')) {
      destino = origemExplicita
    } else if (interna(anterior) && anterior !== atual && !anterior.startsWith('/login')) {
      destino = anterior
    } else if (medicaoId && interna(origemExplicita)) {
      destino = origemExplicita
    } else {
      destino = destinoMedicao || fallbackDaRota(pathname)
    }
    if (!interna(destino) || destino === atual) destino = fallbackDaRota(pathname)
    router.push(destino)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-4">
      <button type="button" onClick={voltar}
        aria-label="Voltar à tela anterior"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700">
        <ArrowLeft size={18} aria-hidden="true" /> Voltar
      </button>
    </div>
  )
}
