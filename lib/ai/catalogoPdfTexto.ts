// PDF text streams are not reading order: reconstruct rows by geometry first.
export function textoCatalogoGeometrico(items:any[]):string{
  const rows:Array<{y:number;items:any[]}>=[]
  for(const item of items.filter(i=>String(i?.str||'').trim()&&i?.transform).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
    const y=Number(item.transform[5])
    let row=rows.find(r=>Math.abs(r.y-y)<2)
    if(!row){row={y,items:[]};rows.push(row)}
    row.items.push(item)
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>{
    let texto='',right=-Infinity
    for(const item of r.items.sort((a,b)=>a.transform[4]-b.transform[4])){
      const x=Number(item.transform[4]),gap=x-right
      texto+=(texto?(gap<2?'':'\t'):'')+item.str
      right=x+Number(item.width||0)
    }
    return texto.trim()
  }).join('\n')
}
