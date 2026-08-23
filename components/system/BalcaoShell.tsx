'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Calculator, CircleDollarSign, History, LogOut, PackageSearch, ShoppingCart, WalletCards } from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao, Usuario } from '@/lib/tipos'

type Acessos={venda:NivelPermissao;caixa:NivelPermissao;relatorios:NivelPermissao}
export default function BalcaoShell({children}:{children:ReactNode}){
 const path=usePathname(),router=useRouter();const [u,setU]=useState<Usuario|null>(null);const [ac,setAc]=useState<Acessos>({venda:'oculto',caixa:'oculto',relatorios:'oculto'})
 useEffect(()=>{usuarioAtual().then(async x=>{setU(x);if(!x)return;const p=await listarPermissoesUsuario(x.id);setAc({venda:nivelEfetivo(x,'venda-balcao',p),caixa:nivelEfetivo(x,'caixa-balcao',p),relatorios:nivelEfetivo(x,'relatorios-balcao',p)})})},[])
 const item=(href:string,label:string,icon:React.ReactNode,vis=true)=>{const ativo=href==='/balcao'?path==='/balcao':path===href||path.startsWith(href+'/');return vis?<Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${ativo?'bg-emerald-600 text-white':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{icon}{label}</Link>:null}
 async function sair(){await logout();router.replace('/login')}
 return <div className="min-h-screen bg-slate-50 md:flex"><aside className="hidden w-64 shrink-0 flex-col bg-[#071426] p-4 text-white md:flex"><div className="mb-8"><div className="text-xl font-bold">Atlas One</div><div className="text-xs text-slate-400">Venda Balcão</div></div><nav className="space-y-1">{item('/balcao','Venda',<ShoppingCart size={18}/>,ac.venda!=='oculto')}{item('/balcao/orcamentos','Orçamento',<Calculator size={18}/>,ac.venda!=='oculto')}{item('/balcao/consulta-preco','Consulta de preço',<PackageSearch size={18}/>,ac.venda!=='oculto')}{item('/balcao/historico','Histórico de vendas',<History size={18}/>,ac.venda!=='oculto')}<div className="my-3 border-t border-white/10"/>{item('/balcao/caixa','Caixa',<WalletCards size={18}/>,ac.caixa!=='oculto')}{item('/balcao/contas-receber','Contas a receber',<CircleDollarSign size={18}/>,ac.caixa!=='oculto')}{item('/balcao/relatorios','Relatórios e Gestão',<BarChart3 size={18}/>,ac.relatorios!=='oculto')}</nav><div className="mt-auto border-t border-white/10 pt-4"><div className="mb-3 text-xs text-slate-400"><div className="font-semibold text-white">{u?.nome||'Usuário'}</div>{u?.role==='master'?'MASTER':'OPERADOR BALCÃO'}</div><button onClick={sair} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut size={17}/>Sair</button></div></aside><div className="min-w-0 flex-1"><div className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b bg-white p-2 md:hidden">{ac.venda!=='oculto'&&<><Link href="/balcao" className="rounded-lg px-3 py-2 text-xs font-semibold">Venda</Link><Link href="/balcao/consulta-preco" className="rounded-lg px-3 py-2 text-xs font-semibold">Preço</Link><Link href="/balcao/historico" className="rounded-lg px-3 py-2 text-xs font-semibold">Histórico</Link></>}{ac.caixa!=='oculto'&&<><Link href="/balcao/caixa" className="rounded-lg px-3 py-2 text-xs font-semibold">Caixa</Link><Link href="/balcao/contas-receber" className="rounded-lg px-3 py-2 text-xs font-semibold">Receber</Link></>}{ac.relatorios!=='oculto'&&<Link href="/balcao/relatorios" className="rounded-lg px-3 py-2 text-xs font-semibold">Relatórios</Link>}</div>{children}</div></div>
}
