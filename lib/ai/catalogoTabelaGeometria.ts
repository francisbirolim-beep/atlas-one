const norm=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9]/g,'')
export function celulasTabela(items:any[],codigo:string){
  const tokens=items.filter(i=>i?.transform&&String(i.str||'').trim()).map(i=>({s:String(i.str),x:Number(i.transform[4]),y:Number(i.transform[5]),w:Number(i.width||0)}))
  const alvo=norm(codigo)
  let target=tokens.find(i=>norm(i.s)===alvo)
  if(!target){
    for(const t of tokens){
      const row=tokens.filter(i=>Math.abs(i.y-t.y)<2&&i.x>=t.x).sort((a,b)=>a.x-b.x)
      let text=''
      for(const i of row.slice(0,3)){text+=i.s;if(norm(text)===alvo){target=t;break}}
      if(target)break
    }
  }
  if(!target)return null
  const t=target
  const kg=tokens.filter(i=>/^kg$/i.test(i.s.trim())&&i.y>t.y&&i.x>t.x).sort((a,b)=>a.y-b.y)[0]
  if(!kg||kg.y-t.y>300)return null
  const headers=tokens.filter(i=>Math.abs(i.y-kg.y)<3&&i.x>=kg.x-2&&/^(Kg|[ABCDe])$/i.test(i.s.trim())).sort((a,b)=>a.x-b.x)
  if(headers.length<3)return null
  const values=headers.map(()=>[] as typeof tokens)
  for(const i of tokens.filter(i=>Math.abs(i.y-t.y)<6&&i.x>t.x+20)){
    const center=i.x+i.w/2
    const index=headers.reduce((best,h,j)=>Math.abs(center-(h.x+h.w/2))<Math.abs(center-(headers[best].x+headers[best].w/2))?j:best,0)
    if(Math.abs(center-(headers[index].x+headers[index].w/2))<25)values[index].push(i)
  }
  const cells=values.map(v=>v.sort((a,b)=>a.x-b.x).map(i=>i.s).join('').trim())
  const number=(v:string)=>/^\d+(?:[.,]\d+)?$/.test(v)?Number(v.replace(',','.')):null
  const peso=number(cells[0])
  if(peso===null)return null
  const mm:Record<string,number>={},polegadas:Record<string,string>={}
  let polegada=false
  for(let i=1;i<headers.length;i++){
    const key=headers[i].s.trim()
    if(key in mm)polegada=true
    if(polegada){if(cells[i])polegadas[key]=cells[i]}
    else {const value=number(cells[i]);if(value!==null)mm[key]=value}
  }
  return {peso,mm,polegadas}
}
