'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { carregarOperacaoMedicaoV2, listarUsuariosDisponiveisMedicao } from '@/lib/medicaoFinalV2'
import type { Usuario } from '@/lib/tipos'

type Acesso = {
  id: string
  nome_convidado: string | null
  telefone_convidado: string | null
  expira_em: string | null
  revogado_em: string | null
  primeiro_acesso_em: string | null
  ultimo_acesso_em: string | null
  criado_por_nome: string | null
  created_at: string
}

type ResponsavelPadrao = {
  id: string
  nome: string
  whatsapp: string | null
}

function normalizarNome(valor: string) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export default function MedicaoExternalAccessPanel({ medicaoId }: { medicaoId: string }) {
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [podeEditar, setPodeEditar] = useState(false)
  const [visivel, setVisivel] = useState(true)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [responsavelPadrao, setResponsavelPadrao] = useState<ResponsavelPadrao | null>(null)
  const [dias, setDias] = useState(7)
  const [gerando, setGerando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [urlNova, setUrlNova] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    const token = await tokenAtual()
    if (!token) {
      setCarregando(false)
      return
    }

    const [resp, usuariosDisponiveis, operacao] = await Promise.all([
      fetch(`/api/medicao-final/${medicaoId}/acessos`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      listarUsuariosDisponiveisMedicao(),
      carregarOperacaoMedicaoV2(medicaoId),
    ])

    const json = await resp.json().catch(() => ({}))
    setUsuarios(usuariosDisponiveis)

    const responsavel = operacao?.responsavel_id
      ? usuariosDisponiveis.find(u => u.id === operacao.responsavel_id) || null
      : null

    setResponsavelPadrao(
      responsavel
        ? {
            id: responsavel.id,
            nome: responsavel.nome,
            whatsapp: responsavel.whatsapp || null,
          }
        : null,
    )

    if (resp.ok) {
      setAcessos(json.acessos || [])
      setPodeEditar(json.podeEditar === true)
      setVisivel(true)
    } else if (resp.status === 403) {
      setVisivel(false)
    }
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (!responsavelPadrao) return
    setNome(atual => atual.trim() ? atual : responsavelPadrao.nome)
    setTelefone(atual => atual.trim() ? atual : (responsavelPadrao.whatsapp || ''))
  }, [responsavelPadrao])

  function alterarNome(valor: string) {
    setNome(valor)
    const cadastrado = usuarios.find(u => normalizarNome(u.nome) === normalizarNome(valor))
    setTelefone(cadastrado?.whatsapp || '')
  }

  async function gerar() {
    if (!podeEditar) return
    if (!nome.trim()) return setMensagem('Informe o nome de quem fara a medicao.')
    setGerando(true); setMensagem(''); setUrlNova('')
    const token = await tokenAtual()
    const resp = await fetch(`/api/medicao-final/${medicaoId}/acessos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ nome, telefone, diasValidade: dias }),
    })
    const json = await resp.json().catch(() => ({}))
    setGerando(false)
    if (!resp.ok) return setMensagem(json.error || 'Nao foi possivel gerar o link.')
    setUrlNova(json.url || '')
    setMensagem('Link gerado. Copie e envie para o responsavel pela medicao.')
    setNome(''); setTelefone('')
    await carregar()
  }

  async function copiar() {
    if (!urlNova) return
    try {
      await navigator.clipboard.writeText(urlNova)
      setMensagem('Link copiado.')
    } catch {
      setMensagem('Nao foi possivel copiar automaticamente. Selecione o link abaixo.')
    }
  }

  async function revogar(acessoId: string) {
    if (!podeEditar) return
    if (!window.confirm('Revogar este link? A pessoa nao conseguira mais abrir a Medicao Final por ele.')) return
    const token = await tokenAtual()
    const resp = await fetch(`/api/medicao-final/${medicaoId}/acessos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ acessoId }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) return setMensagem(json.error || 'Nao foi possivel revogar o link.')
    setMensagem('Link revogado.')
    await carregar()
  }

  if (!visivel) return null

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Acesso de campo</p>
            <h2 className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 size={16} /> Link externo da Medicao Final</h2>
            <p className="mt-1 text-xs text-slate-500">O link abre somente esta medicao. O token fica armazenado no banco apenas como hash e pode ser revogado.</p>
          </div>
          <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
        </div>

        {podeEditar ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_100px_auto]">
            <div>
              <input
                list={`responsaveis-medicao-${medicaoId}`}
                value={nome}
                onChange={e => alterarNome(e.target.value)}
                placeholder="Nome de quem vai medir"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <datalist id={`responsaveis-medicao-${medicaoId}`}>
                {usuarios.map(u => <option key={u.id} value={u.nome} />)}
              </datalist>
            </div>
            <input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              inputMode="tel"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select value={dias} onChange={e => setDias(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value={1}>1 dia</option><option value={3}>3 dias</option><option value={7}>7 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option>
            </select>
            <button onClick={() => void gerar()} disabled={gerando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {gerando ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />} Gerar link
            </button>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Seu acesso a Medicao Final e somente consulta. Apenas usuarios com permissao de edicao podem gerar ou revogar links.</p>
        )}

        {responsavelPadrao && podeEditar && (
          <p className="mt-2 text-[11px] text-slate-400">
            Responsável cadastrado: {responsavelPadrao.nome}{responsavelPadrao.whatsapp ? ' · telefone preenchido automaticamente' : ' · sem telefone cadastrado; informe manualmente se necessário'}.
          </p>
        )}

        {urlNova && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Este endereco completo aparece somente agora.</p>
            <div className="mt-2 flex gap-2"><input readOnly value={urlNova} className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600" /><button onClick={() => void copiar()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"><Copy size={13} /> Copiar</button></div>
          </div>
        )}

        {mensagem && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{mensagem}</p>}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Links gerados</p>
          {carregando ? <p className="text-xs text-slate-400">Carregando...</p> : acessos.length === 0 ? <p className="text-xs text-slate-400">Nenhum link externo gerado para esta medicao.</p> : <div className="space-y-2">{acessos.map(acesso => {
            const expirado = acesso.expira_em ? new Date(acesso.expira_em).getTime() < Date.now() : false
            const ativo = !acesso.revogado_em && !expirado
            return <div key={acesso.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"><div><p className="text-sm font-medium text-slate-700">{acesso.nome_convidado || 'Medidor externo'}</p><p className="text-[11px] text-slate-400">{ativo ? `Valido ate ${acesso.expira_em ? new Date(acesso.expira_em).toLocaleString('pt-BR') : 'sem prazo'}` : acesso.revogado_em ? 'Revogado' : 'Expirado'}{acesso.ultimo_acesso_em ? ` · ultimo acesso ${new Date(acesso.ultimo_acesso_em).toLocaleString('pt-BR')}` : ' · ainda nao acessado'}</p></div>{ativo && podeEditar && <button onClick={() => void revogar(acesso.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 size={13} /> Revogar</button>}</div>
          })}</div>}
        </div>
      </div>
    </section>
  )
}
