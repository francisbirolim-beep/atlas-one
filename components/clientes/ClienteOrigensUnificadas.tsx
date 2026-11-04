'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Origem = {
  id: string; nome: string; apelido: string | null
  cpf_cnpj: string | null; telefone: string | null; whatsapp: string | null
  email: string | null; cidade: string | null; bairro: string | null
  endereco: string | null; observacoes: string | null
  created_at: string
}

/** Mostra dados anteriores sem sobrescrever o cadastro principal.
 * A consulta usa o RLS de clientes, sem credenciais administrativas no browser.
 */
export default function ClienteOrigensUnificadas({ clienteId }: { clienteId: string }) {
  const [origens, setOrigens] = useState<Origem[]>([])
  useEffect(() => {
    let ativo = true
    void (async () => {
      const { data, error } = await supabase.from('clientes')
        .select('id,nome,apelido,cpf_cnpj,telefone,whatsapp,email,cidade,bairro,endereco,observacoes,created_at')
        .eq('mesclado_em_cliente_id', clienteId).eq('ativo', false)
        .order('created_at', { ascending: false }).limit(100)
      if (ativo && !error) setOrigens((data || []) as Origem[])
    })()
    return () => { ativo = false }
  }, [clienteId])

  if (!origens.length) return null
  return <section className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ArrowRightLeft size={16}/> Cadastros anteriores unificados ({origens.length})</h3>
    <p className="mt-1 text-xs text-slate-600">Os dados antigos são preservados como histórico. O cadastro principal continua sendo o utilizado nos novos orçamentos.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {origens.map(c => <article key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm text-slate-800">{c.nome}</strong><Link href={'/clientes/'+c.id} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Ver antigo <ExternalLink size={12}/></Link></div>
        <p className="mt-1 text-[11px] text-slate-500">Cadastro original de {new Date(c.created_at).toLocaleDateString('pt-BR')} · ID {c.id.slice(0,8)}</p>
        <div className="mt-2 space-y-1 text-xs text-slate-700">
          {[['Apelido',c.apelido],['Documento',c.cpf_cnpj],['WhatsApp',c.whatsapp],['Telefone',c.telefone],['E-mail',c.email],
            ['Local', [c.endereco,c.bairro,c.cidade].filter(Boolean).join(' · ')],['Observações antigas',c.observacoes]]
            .filter(([,valor]) => Boolean(valor)).map(([rotulo,valor]) =>
            <p key={rotulo}><span className="font-semibold">{rotulo}:</span> {valor}</p>)}
        </div>
      </article>)}
    </div>
    {origens.length === 100 && <p className="mt-2 text-xs text-amber-700">Exibidos os 100 cadastros mais recentes. Consulte o histórico para outras unificações.</p>}
  </section>
}
