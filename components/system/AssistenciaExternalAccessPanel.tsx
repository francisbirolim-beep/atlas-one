'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2, Loader2, MessageCircle, MessageSquareText, ShieldCheck, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Acesso = {
  id: string
  nome_tecnico: string | null
  telefone_tecnico: string | null
  expira_em: string | null
  revogado_em: string | null
  primeiro_acesso_em: string | null
  ultimo_acesso_em: string | null
  criado_por_nome: string | null
  created_at: string
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}

function telefoneWhatsApp(valor: string) {
  const digitos = somenteNumeros(valor)
  if (!digitos) return ''
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return digitos
}

export default function AssistenciaExternalAccessPanel({ assistenciaId }: { assistenciaId: string }) {
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dias, setDias] = useState(7)
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [urlNova, setUrlNova] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const token = await tokenAtual()
    if (!token) {
      setCarregando(false)
      return
    }

    const resp = await fetch(`/api/assistencias/${assistenciaId}/acessos`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const json = await resp.json().catch(() => ({}))
    if (resp.ok) setAcessos(json.acessos || [])
    setCarregando(false)
  }, [assistenciaId])

  useEffect(() => { void carregar() }, [carregar])

  async function gerar() {
    if (!nome.trim()) {
      setMensagem('Informe o nome do técnico.')
      return
    }

    setGerando(true)
    setMensagem('')
    setUrlNova('')
    const token = await tokenAtual()
    const resp = await fetch(`/api/assistencias/${assistenciaId}/acessos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ nome, telefone, diasValidade: dias }),
    })
    const json = await resp.json().catch(() => ({}))
    setGerando(false)

    if (!resp.ok) {
      setMensagem(json.error || 'Não foi possível gerar o link.')
      return
    }

    setUrlNova(json.url || '')
    setMensagem('Link gerado. Você já pode enviar por WhatsApp, SMS ou copiar.')
    await carregar()
  }

  function textoEnvio() {
    return `Olá ${nome.trim() || 'técnico'}, você recebeu uma assistência técnica. Abra o link para ver os dados do cliente, endereço, iniciar o atendimento, registrar o serviço e coletar as assinaturas: ${urlNova}`
  }

  function enviarWhatsApp() {
    if (!urlNova) return
    const numero = telefoneWhatsApp(telefone)
    const destino = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(textoEnvio())}`
      : `https://wa.me/?text=${encodeURIComponent(textoEnvio())}`
    window.open(destino, '_blank', 'noopener,noreferrer')
    setMensagem(numero ? 'WhatsApp aberto com o técnico e a mensagem pronta.' : 'WhatsApp aberto com a mensagem pronta. Escolha o contato do técnico.')
  }

  function enviarSms() {
    if (!urlNova) return
    const numero = somenteNumeros(telefone)
    const destino = `sms:${numero}?body=${encodeURIComponent(textoEnvio())}`
    window.location.href = destino
    setMensagem(numero ? 'SMS aberto com o número e a mensagem prontos.' : 'SMS aberto com a mensagem pronta. Escolha o destinatário.')
  }

  async function copiar() {
    if (!urlNova) return
    try {
      await navigator.clipboard.writeText(urlNova)
      setMensagem('Link copiado.')
    } catch {
      setMensagem('Copie manualmente o endereço abaixo.')
    }
  }

  async function revogar(acessoId: string) {
    if (!window.confirm('Revogar este link? O técnico não conseguirá mais abrir a assistência por ele.')) return
    const token = await tokenAtual()
    const resp = await fetch(`/api/assistencias/${assistenciaId}/acessos`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ acessoId }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      setMensagem(json.error || 'Não foi possível revogar o link.')
      return
    }
    setMensagem('Link revogado.')
    if (urlNova) setUrlNova('')
    await carregar()
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Acesso do técnico</p>
          <h4 className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Link2 size={15}/> Link da assistência</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">O técnico abre apenas este chamado, vê cliente/endereço, inicia o atendimento com GPS opcional, registra o serviço e coleta as assinaturas.</p>
        </div>
        <ShieldCheck size={19} className="shrink-0 text-emerald-700" />
      </div>

      <div className="mt-3 grid gap-2">
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do técnico" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <div className="grid grid-cols-[1fr_92px] gap-2">
          <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone do técnico" inputMode="tel" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select value={dias} onChange={e => setDias(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value={1}>1 dia</option>
            <option value={3}>3 dias</option>
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </div>
        <button type="button" onClick={() => void gerar()} disabled={gerando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {gerando ? <Loader2 size={15} className="animate-spin"/> : <ExternalLink size={15}/>} Gerar link para o técnico
        </button>
      </div>

      {urlNova && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-2.5">
          <p className="mb-2 text-[11px] font-semibold text-emerald-800">O link completo aparece somente no momento da geração.</p>
          <input readOnly value={urlNova} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-[11px] text-slate-600" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" onClick={enviarWhatsApp} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white"><MessageCircle size={13}/> WhatsApp</button>
            <button type="button" onClick={enviarSms} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white"><MessageSquareText size={13}/> SMS</button>
            <button type="button" onClick={() => void copiar()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2 py-2 text-xs font-semibold text-white"><Copy size={13}/> Copiar</button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-400">WhatsApp e SMS são abertos no aparelho com a mensagem pronta. O envio automático sem abrir o aplicativo exigirá integração com uma API de mensageria.</p>
        </div>
      )}

      {mensagem && <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs text-slate-600">{mensagem}</p>}

      <div className="mt-3 border-t border-emerald-200 pt-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Links gerados</p>
        {carregando ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : acessos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum link gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {acessos.slice(0, 5).map(acesso => {
              const expirado = acesso.expira_em ? new Date(acesso.expira_em).getTime() < Date.now() : false
              const ativo = !acesso.revogado_em && !expirado
              return (
                <div key={acesso.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{acesso.nome_tecnico || 'Técnico'}</p>
                    <p className="text-[10px] text-slate-400">{ativo ? (acesso.ultimo_acesso_em ? 'Acessado pelo técnico' : 'Aguardando acesso') : acesso.revogado_em ? 'Revogado' : 'Expirado'}</p>
                  </div>
                  {ativo && <button type="button" onClick={() => void revogar(acesso.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"><Trash2 size={12}/> Revogar</button>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
