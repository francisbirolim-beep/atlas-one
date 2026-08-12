'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OrigemCliente } from '@/lib/tipos'
import {
  CampoConfiguravel,
  campoNoContexto,
  campoObrigatorio,
  camposDoContexto,
  listarCamposConfiguraveis,
} from '@/lib/camposConfiguraveis'

const origens: { value: OrigemCliente; label: string }[] = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'arquiteto', label: 'Arquiteto' },
  { value: 'engenheiro', label: 'Engenheiro' },
  { value: 'construtora', label: 'Construtora' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'cliente_antigo', label: 'Cliente antigo' },
  { value: 'passou_na_frente', label: 'Passou em frente à empresa' },
  { value: 'outros', label: 'Outros' },
]

export default function NovoCliente() {
  const router = useRouter()
  const [campos, setCampos] = useState<CampoConfiguravel[]>([])
  const [configCarregada, setConfigCarregada] = useState(false)
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cidade, setCidade] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cep, setCep] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listarCamposConfiguraveis().then((lista) => {
      setCampos(lista)
      setConfigCarregada(true)
    })
  }, [])

  function visivel(chave: string) {
    if (chave === 'nome') return true
    if (!configCarregada) return true
    return !!campoNoContexto(campos, chave, 'cliente')
  }

  function obrigatorio(chave: string) {
    if (chave === 'nome') return true
    if (!configCarregada) return chave === 'cpf_cnpj' || chave === 'endereco'
    return campoObrigatorio(campos, chave, 'cliente')
  }

  function rotulo(chave: string, fallback: string) {
    return campoNoContexto(campos, chave, 'cliente')?.label || fallback
  }

  function placeholder(chave: string, fallback = '') {
    return campoNoContexto(campos, chave, 'cliente')?.placeholder || fallback
  }

  async function salvar() {
    const valores: Record<string, string> = {
      nome,
      apelido,
      whatsapp,
      telefone,
      email,
      cidade,
      cpf_cnpj: cpfCnpj,
      endereco,
      bairro,
      cep,
      data_nascimento: dataNascimento,
      origem,
      observacoes,
    }

    const obrigatorios = configCarregada
      ? camposDoContexto(campos, 'cliente', true)
      : [
          { chave: 'nome', label: 'Nome completo' },
          { chave: 'cpf_cnpj', label: 'CPF ou CNPJ' },
          { chave: 'endereco', label: 'Endereço da obra' },
        ]

    for (const campo of obrigatorios) {
      const valor = valores[campo.chave]
      if (valor !== undefined && !String(valor).trim()) {
        setErro(`Informe: ${campo.label}`)
        return
      }
    }

    if (!nome.trim()) {
      setErro('Informe: Nome completo')
      return
    }

    setErro('')
    setSalvando(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome: nome.trim(),
        apelido: apelido.trim() || null,
        whatsapp: whatsapp.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        cidade: cidade.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        endereco: endereco.trim() || null,
        bairro: bairro.trim() || null,
        cep: cep.trim() || null,
        data_nascimento: dataNascimento || null,
        origem,
        observacoes: observacoes.trim() || null,
      })
      .select('id')
      .single()

    setSalvando(false)

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
      return
    }

    router.push(`/clientes/${data.id}`)
  }

  const estrela = (chave: string) => (obrigatorio(chave) ? ' *' : '')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/clientes" className="p-2 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft size={20} />
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
            <h1 className="text-lg font-bold text-slate-800">Novo cliente</h1>
          </div>
          <Link
            href="/configuracoes/campos"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            title="Configurar campos e obrigatoriedade"
          >
            <Settings2 size={14} /> Configurar campos
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('nome', 'Nome completo')}{estrela('nome')}</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                placeholder={placeholder('nome', 'Nome completo')}
              />
            </div>
            {visivel('apelido') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('apelido', 'Apelido / nome conhecido')}{estrela('apelido')}</label>
                <input
                  value={apelido}
                  onChange={e => setApelido(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  placeholder={placeholder('apelido', 'Ex.: Zé da Fazenda')}
                />
              </div>
            )}
          </div>

          {(visivel('whatsapp') || visivel('telefone')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visivel('whatsapp') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('whatsapp', 'WhatsApp')}{estrela('whatsapp')}</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('whatsapp', '(11) 99999-9999')} />
                </div>
              )}
              {visivel('telefone') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('telefone', 'Telefone fixo')}{estrela('telefone')}</label>
                  <input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('telefone', '(11) 3333-3333')} />
                </div>
              )}
            </div>
          )}

          {(visivel('email') || visivel('data_nascimento')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visivel('email') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('email', 'E-mail')}{estrela('email')}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('email', 'cliente@email.com')} />
                </div>
              )}
              {visivel('data_nascimento') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('data_nascimento', 'Data de nascimento')}{estrela('data_nascimento')}</label>
                  <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
                </div>
              )}
            </div>
          )}

          {(visivel('cidade') || visivel('cpf_cnpj')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visivel('cidade') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('cidade', 'Cidade')}{estrela('cidade')}</label>
                  <input value={cidade} onChange={e => setCidade(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('cidade', 'Cidade da obra')} />
                </div>
              )}
              {visivel('cpf_cnpj') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('cpf_cnpj', 'CPF ou CNPJ')}{estrela('cpf_cnpj')}</label>
                  <input value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
                </div>
              )}
            </div>
          )}

          {visivel('origem') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('origem', 'Origem')}{estrela('origem')}</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as OrigemCliente)} className="w-full border border-slate-300 rounded-xl p-3 text-sm">
                {origens.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {visivel('endereco') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('endereco', 'Endereço da obra')}{estrela('endereco')}</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('endereco', 'Rua, número')} />
            </div>
          )}

          {(visivel('bairro') || visivel('cep')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visivel('bairro') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('bairro', 'Bairro')}{estrela('bairro')}</label>
                  <input value={bairro} onChange={e => setBairro(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
                </div>
              )}
              {visivel('cep') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('cep', 'CEP')}{estrela('cep')}</label>
                  <input value={cep} onChange={e => setCep(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder={placeholder('cep', '00000-000')} />
                </div>
              )}
            </div>
          )}

          {visivel('observacoes') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{rotulo('observacoes', 'Observações')}{estrela('observacoes')}</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="w-full h-20 border border-slate-300 rounded-xl p-3 text-sm resize-none" />
            </div>
          )}

          {erro && <p className="text-red-500 text-sm">{erro}</p>}

          <button onClick={salvar} disabled={salvando} className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle size={16} />
            {salvando ? 'Salvando...' : 'Salvar cliente'}
          </button>
        </div>
      </main>
    </div>
  )
}
