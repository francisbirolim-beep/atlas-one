'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ShieldAlert, Bot, Save } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { agruparSetores, GRUPOS_ORDEM } from '@/lib/setores'
import { listarVersoes, salvarNovaVersao, restaurarVersao, VersaoInstrucoes } from '@/lib/promptVersoes'

export default function IaSetoresPage() {
  const [carregando, setCarregando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [setores, setSetores] = useState<any[]>([])
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvoId, setSalvoId] = useState<string | null>(null)
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null)
  const [versoes, setVersoes] = useState<Record<string, VersaoInstrucoes[]>>({})
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [motivos, setMotivos] = useState<Record<string, string>>({})

  useEffect(() => {
    ;(async () => {
      const usuario = await usuarioAtual()
      if (!usuario || usuario.role !== 'master') {
        setCarregando(false)
        return
      }
      setAutorizado(true)
      setUsuarioLogado(usuario)
      const { data } = await supabase.from('setores').select('*').order('grupo').order('ordem')
      const lista = (data as any[]) || []
      setSetores(lista)
      const iniciais: Record<string, string> = {}
      lista.forEach((s) => { iniciais[s.id] = s.instrucoes_ia || '' })
      setTextos(iniciais)
      setCarregando(false)
    })()
  }, [])

  async function salvar(setorId: string) {
    setSalvandoId(setorId)
    setSalvoId(null)
    const resultado = await salvarNovaVersao({
      setorId,
      conteudo: textos[setorId] || '',
      autorId: usuarioLogado?.id || null,
      autorNome: usuarioLogado?.nome || null,
      justificativa: motivos[setorId] || undefined,
    })
    setSalvandoId(null)
    if (resultado.ok) {
      setSalvoId(setorId)
      setMotivos({ ...motivos, [setorId]: '' })
      if (historicoAberto === setorId) carregarHistorico(setorId)
      setTimeout(() => setSalvoId(null), 2000)
    }
  }

  async function carregarHistorico(setorId: string) {
    setCarregandoHistorico(true)
    const lista = await listarVersoes(setorId)
    setVersoes((v) => ({ ...v, [setorId]: lista }))
    setCarregandoHistorico(false)
  }

  async function verHistorico(setorId: string) {
    if (historicoAberto === setorId) {
      setHistoricoAberto(null)
      return
    }
    setHistoricoAberto(setorId)
    if (!versoes[setorId]) await carregarHistorico(setorId)
  }

  async function restaurar(setorId: string, versao: VersaoInstrucoes) {
    if (!confirm('Restaurar a versao ' + versao.versao + '? Isso vira a versao ativa agora.')) return
    const resultado = await restaurarVersao({
      setorId,
      versaoParaRestaurar: versao,
      autorId: usuarioLogado?.id || null,
      autorNome: usuarioLogado?.nome || null,
    })
    if (resultado.ok) {
      setTextos({ ...textos, [setorId]: versao.conteudo || '' })
      await carregarHistorico(setorId)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">So o usuario master pode acessar esta pagina.</p>
        <Link href="/" className="text-brand-navy text-sm hover:underline">Voltar ao inicio</Link>
      </div>
    )
  }

  const grupos = agruparSetores(setores)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/configuracoes" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-brand-navy" />
            <h1 className="text-lg font-semibold text-slate-800">Instrucoes da IA por setor</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-slate-500">
          Defina instrucoes especificas que o Agente IA vai seguir quando ajudar usuarios de cada setor.
          O agente so responde sobre o sistema Atlas One e so ajuda com os setores que o usuario tem acesso.
        </p>

        {GRUPOS_ORDEM.filter((g) => grupos[g] && grupos[g].length > 0).map((grupo) => (
          <div key={grupo} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{grupo}</h2>
            {grupos[grupo].map((setor: any) => (
              <div key={setor.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{setor.nome}</span>
                  <button
                    onClick={() => salvar(setor.id)}
                    disabled={salvandoId === setor.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-navy text-white disabled:opacity-50"
                  >
                    <Save size={14} />
                    {salvandoId === setor.id ? 'Salvando...' : salvoId === setor.id ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={motivos[setor.id] || ''}
                    onChange={(e) => setMotivos({ ...motivos, [setor.id]: e.target.value })}
                    placeholder="Motivo da alteracao (opcional)"
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                  <button
                    onClick={() => verHistorico(setor.id)}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 whitespace-nowrap"
                  >
                    {historicoAberto === setor.id ? 'Ocultar historico' : 'Ver historico'}
                  </button>
                </div>
                <textarea
                  value={textos[setor.id] || ''}
                  onChange={(e) => setTextos({ ...textos, [setor.id]: e.target.value })}
                  placeholder="Ex: Foque em prazos de entrega e status de pedidos. Nao discuta valores de outros setores."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-brand-navy"
                />
                {historicoAberto === setor.id ? (
                  <div className="border-t border-slate-100 pt-2 mt-2 space-y-2">
                    {carregandoHistorico ? (
                      <p className="text-xs text-slate-400">Carregando historico...</p>
                    ) : (versoes[setor.id] || []).length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma versao salva ainda.</p>
                    ) : (
                      (versoes[setor.id] || []).map((v) => (
                        <div key={v.id} className="text-xs bg-slate-50 rounded-lg p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-600">
                              v{v.versao} {v.status === 'ativa' ? '(atual)' : ''}
                            </span>
                            <span className="text-slate-400">{new Date(v.criado_em).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-slate-500">{v.autor_nome || 'Desconhecido'}</p>
                          {v.justificativa ? <p className="text-slate-400 italic">{v.justificativa}</p> : null}
                          {v.status !== 'ativa' ? (
                            <button
                              onClick={() => restaurar(setor.id, v)}
                              className="text-brand-navy hover:underline"
                            >
                              Restaurar esta versao
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  )
}
