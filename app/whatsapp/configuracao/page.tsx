'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, QrCode, Save, Trash2, Wifi, WifiOff } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Usuario = { id: string; nome: string }
type Regra = {
  nome: string
  prioridade: number
  palavrasChave: string
  setor: string
  usuarioId: string
  ativo: boolean
}

async function authHeaders() {
  const token = await tokenAtual()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  }
}

export default function ConfiguracaoWhatsAppPage() {
  const [usuarios,setUsuarios]=useState<Usuario[]>([])
  const [numero,setNumero]=useState('5517996355667')
  const [setorPadrao,setSetorPadrao]=useState('')
  const [usuarioPadraoId,setUsuarioPadraoId]=useState('')
  const [regras,setRegras]=useState<Regra[]>([])
  const [erro,setErro]=useState('')
  const [salvando,setSalvando]=useState(false)
  const [salvo,setSalvo]=useState(false)
  const [gatewayStatus,setGatewayStatus]=useState('offline')
  const [qrDataUrl,setQrDataUrl]=useState('')
  const [gatewayLastSeen,setGatewayLastSeen]=useState('')

  useEffect(()=>{
    void carregar()
    const timer=setInterval(()=>void carregar(true),2500)
    return()=>clearInterval(timer)
  },[])

  async function carregar(silencioso=false){
    if(!silencioso)setErro('')
    const headers=await authHeaders()
    const resp=await fetch('/api/integracoes/whatsapp/configuracao',{headers})
    const json=await resp.json()
    if(!resp.ok){setErro(json.error||'Nao foi possivel carregar.');return}
    setUsuarios(json.usuarios||[])
    const c=json.configuracao
    if(c){
      setNumero(c.numero_principal||'5517996355667')
      setSetorPadrao(c.setor_padrao||'')
      setUsuarioPadraoId(c.usuario_padrao_id||'')
      setGatewayStatus(c.gateway_status||'offline')
      setQrDataUrl(c.gateway_qr_data_url||'')
      setGatewayLastSeen(c.gateway_last_seen_at||'')
    }
    setRegras((json.regras||[]).map((r:any)=>({
      nome:r.nome||'',
      prioridade:r.prioridade||100,
      palavrasChave:(r.palavras_chave||[]).join(', '),
      setor:r.setor||'',
      usuarioId:r.usuario_id||'',
      ativo:r.ativo!==false,
    })))
  }

  function alterar(indice:number, campo:keyof Regra, valor:string|number|boolean){
    setRegras(rs=>rs.map((r,i)=>i===indice?{...r,[campo]:valor}:r))
  }

  function adicionar(){
    setRegras(rs=>[...rs,{
      nome:'Nova regra',
      prioridade:(rs.length+1)*10,
      palavrasChave:'',
      setor:'',
      usuarioId:'',
      ativo:true,
    }])
  }

  async function salvar(){
    setSalvando(true);setErro('');setSalvo(false)
    try{
      const headers=await authHeaders()
      const resp=await fetch('/api/integracoes/whatsapp/configuracao',{
        method:'PUT',headers,
        body:JSON.stringify({
          numeroPrincipal:numero,
          setorPadrao:setorPadrao||null,
          usuarioPadraoId:usuarioPadraoId||null,
          regras:regras.map(r=>({
            ...r,
            palavrasChave:r.palavrasChave.split(',').map(p=>p.trim()).filter(Boolean),
          })),
        }),
      })
      const json=await resp.json()
      if(!resp.ok)throw new Error(json.error||'Nao foi possivel salvar.')
      setSalvo(true)
      await carregar()
    }catch(e){
      setErro(e instanceof Error?e.message:'Nao foi possivel salvar.')
    }finally{setSalvando(false)}
  }

  return <main className="min-h-screen bg-slate-100 p-4 md:p-8">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/whatsapp" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
          <div>
            <h1 className="font-bold text-slate-900">Roteamento do WhatsApp</h1>
            <p className="text-xs text-slate-500">Configuracao exclusiva do usuario Master</p>
          </div>
        </div>
        <button onClick={()=>void salvar()} disabled={salvando}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Save size={16}/>{salvando?'Salvando...':'Salvar'}
        </button>
      </header>

      {erro&&<div className="border-b bg-red-50 px-5 py-2 text-sm text-red-700">{erro}</div>}
      {salvo&&<div className="border-b bg-emerald-50 px-5 py-2 text-sm text-emerald-700">Configuracao salva.</div>}

      <div className="space-y-6 p-5">
        <section className="rounded-2xl border p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                {gatewayStatus==='connected'
                  ? <Wifi size={20} className="text-emerald-600"/>
                  : gatewayStatus==='qr'
                    ? <QrCode size={20} className="text-blue-600"/>
                    : <WifiOff size={20} className="text-amber-600"/>}
                <h2 className="font-bold text-slate-900">Conexao por QR Code</h2>
              </div>
              <p className="text-sm text-slate-600">
                {gatewayStatus==='connected'
                  ? 'WhatsApp conectado ao Atlas. O gateway do Mac esta ativo.'
                  : gatewayStatus==='qr'
                    ? 'QR Code pronto. Escaneie no WhatsApp Business para vincular o Atlas.'
                    : 'Gateway desconectado. Inicie o gateway no Mac para gerar o QR Code.'}
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                No celular: <b>WhatsApp Business → Configuracoes → Aparelhos conectados → Conectar aparelho</b>.
              </div>
              {gatewayLastSeen&&(
                <p className="mt-2 text-xs text-slate-400">
                  Ultimo sinal do gateway: {new Date(gatewayLastSeen).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            {gatewayStatus==='qr'&&qrDataUrl&&(
              <div className="shrink-0 rounded-2xl border bg-white p-3 text-center shadow-sm">
                <img src={qrDataUrl} alt="QR Code para conectar WhatsApp ao Atlas" className="h-64 w-64"/>
                <p className="mt-2 text-xs font-semibold text-slate-600">Escaneie com o numero principal</p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border p-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Numero principal
            <input value={numero} onChange={e=>setNumero(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" placeholder="5517996355667"/>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Setor padrao
            <input value={setorPadrao} onChange={e=>setSetorPadrao(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" placeholder="Ex.: Comercial"/>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Usuario padrao
            <select value={usuarioPadraoId} onChange={e=>setUsuarioPadraoId(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal">
              <option value="">Deixar em espera</option>
              {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <p className="md:col-span-3 text-xs text-slate-500">
            Se nenhuma regra abaixo combinar, a conversa usa o usuario padrao. Sem usuario padrao, entra na fila para alguem assumir.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Regras automaticas</h2>
              <p className="text-xs text-slate-500">A menor prioridade numerica e analisada primeiro.</p>
            </div>
            <button onClick={adicionar} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
              <Plus size={15}/> Nova regra
            </button>
          </div>
          <div className="space-y-3">
            {regras.length===0&&<div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">Nenhuma regra cadastrada.</div>}
            {regras.map((r,i)=><div key={i} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[90px_1fr_1.3fr_1fr_1fr_44px]">
              <label className="text-xs font-semibold text-slate-500">Prioridade
                <input type="number" value={r.prioridade} onChange={e=>alterar(i,'prioridade',Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Nome
                <input value={r.nome} onChange={e=>alterar(i,'nome',e.target.value)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Palavras-chave
                <input value={r.palavrasChave} onChange={e=>alterar(i,'palavrasChave',e.target.value)}
                  placeholder="orcamento, preco, projeto" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Setor
                <input value={r.setor} onChange={e=>alterar(i,'setor',e.target.value)}
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm font-normal text-slate-900"/>
              </label>
              <label className="text-xs font-semibold text-slate-500">Direcionar para
                <select value={r.usuarioId} onChange={e=>alterar(i,'usuarioId',e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm font-normal text-slate-900">
                  <option value="">Somente setor/fila</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </label>
              <button onClick={()=>setRegras(rs=>rs.filter((_,x)=>x!==i))}
                className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50" title="Excluir regra">
                <Trash2 size={17}/>
              </button>
            </div>)}
          </div>
        </section>
        <section className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <b className="text-slate-800">Como funciona:</b> quando o cliente envia uma mensagem,
          o Atlas compara o texto com as palavras-chave na ordem de prioridade. A primeira regra
          compativel define o setor e, se configurado, o usuario responsavel. Conversas recorrentes
          continuam com o atendente que ja estava responsavel.
        </section>
      </div>
    </div>
  </main>
}