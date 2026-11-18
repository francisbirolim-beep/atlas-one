'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type VisitaProspeccao = {
  id: string
  nome_obra: string | null
  cidade: string | null
  bairro: string | null
  endereco: string | null
  created_at: string
  miniatura?: string | null
}

/** Acesso somente-leitura às visitas que originaram este Cliente 360.
 * Não duplica dados/fotos no cadastro do cliente e respeita as políticas RLS.
 */
export default function VisitasOrigemProspeccao({ clienteId }: { clienteId: string }) {
  const [visitas, setVisitas] = useState<VisitaProspeccao[]>([])
  useEffect(() => {
    let ativo = true
    async function carregar() {
      // O componente desaparece se a sessão não tiver permissão de prospecção.
      const { data, error } = await supabase.from('prospeccoes')
        .select('id,nome_obra,cidade,bairro,endereco,created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(24)
      if (error || !data?.length || !ativo) return
      const comImagens = await Promise.all((data as VisitaProspeccao[]).map(async visita => {
        const { data: arquivos } = await supabase.storage.from('prospeccao-fotos')
          .list(visita.id, {limit: 1, sortBy: {column:'created_at',order:'desc'}})
        const nomeFoto = arquivos?.find(f => f.name !== '.emptyFolderPlaceholder')?.name
        if (!nomeFoto) return visita
        const { data: url } = await supabase.storage.from('prospeccao-fotos')
          .createSignedUrl(visita.id + '/' + nomeFoto, 60 * 20)
        return {...visita, miniatura: url?.signedUrl || null}
      }))
      if (ativo) setVisitas(comImagens)
    }
    void carregar()
    return () => { ativo = false }
  }, [clienteId])

  if (!visitas.length) return null
  return <section className="rounded-2xl border bg-white p-4 shadow-sm" aria-label="Visitas de prospecção vinculadas ao cliente">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><MapPin size={17} className="text-blue-600"/>Visitas de prospecção ({visitas.length})</h3>
    <p className="mt-1 text-xs text-slate-500">Endereços, observações e fotos registradas em campo permanecem vinculados à visita original.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visitas.map(visita=><Link key={visita.id} href={`/prospeccao/${visita.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border p-3 transition hover:border-blue-300">
        {visita.miniatura ? <img src={visita.miniatura} alt="Foto da visita de prospecção" loading="lazy" className="h-16 w-20 shrink-0 rounded-lg object-cover"/> :
          <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Camera size={21}/></span>}
        <span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{visita.nome_obra||visita.endereco||'Obra prospectada'}</strong>
          <span className="mt-1 block text-[11px] text-slate-500">{[visita.bairro,visita.cidade].filter(Boolean).join(' · ')||'Local em campo'}</span>
          <span className="mt-1 block text-[11px] font-semibold text-blue-600">Abrir visita e fotos</span>
        </span>
      </Link>)}
    </div>
  </section>
}
