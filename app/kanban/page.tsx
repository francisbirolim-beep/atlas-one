'use client'

import CentralKanbans from '@/components/system/CentralKanbans'
import Link from 'next/link'

export default function KanbanPage(){return <>
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3">
   <p className="text-sm font-semibold text-slate-700">Central de Kanbans · fluxos de cada setor preservados</p>
   <Link href="/visao-geral-projetos" className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:border-blue-500">Abrir Visão Geral de Projetos →</Link>
  </div>
  <CentralKanbans/>
 </>}
