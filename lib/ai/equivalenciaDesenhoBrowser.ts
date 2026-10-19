// Comparação VISUAL orientativa de imagens técnicas, executada no navegador.
// Não pode homologar ou unir produtos automaticamente.
// Retorna null quando a imagem não permite leitura CORS/Canvas.
const lado=48
type Assinatura={pixels:Uint8Array;ocupacao:number}
async function carregarImagem(src:string):Promise<HTMLImageElement>{
  return await new Promise((resolve,reject)=>{
    const i=new Image()
    i.crossOrigin='anonymous'
    i.onload=()=>resolve(i)
    i.onerror=()=>reject(new Error('Imagem inacessível para comparação visual'))
    i.src=src
  })
}
async function assinatura(url:string):Promise<Assinatura|null>{
  try{
    if(!/^https:\/\//i.test(url)&&!/^data:image\/(png|jpeg|webp);base64,/i.test(url))return null
    const i=await carregarImagem(url)
    const canvas=document.createElement('canvas')
    const w=192,h=192;canvas.width=w;canvas.height=h
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null
    ctx.fillStyle='white';ctx.fillRect(0,0,w,h)
    const k=Math.min(w/i.naturalWidth,h/i.naturalHeight)
    const rw=i.naturalWidth*k,rh=i.naturalHeight*k
    ctx.drawImage(i,(w-rw)/2,(h-rh)/2,rw,rh)
    const data=ctx.getImageData(0,0,w,h).data
    let xmin=w,ymin=h,xmax=-1,ymax=-1
    const escuro=(x:number,y:number)=>{
      const p=(y*w+x)*4
      const luminancia=0.2126*data[p]+0.7152*data[p+1]+0.0722*data[p+2]
      return data[p+3]>80&&luminancia<155
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(!escuro(x,y))continue
      xmin=Math.min(xmin,x);ymin=Math.min(ymin,y)
      xmax=Math.max(xmax,x);ymax=Math.max(ymax,y)
    }
    if(xmax-xmin<8||ymax-ymin<8)return null
    const margem=4
    xmin=Math.max(0,xmin-margem);ymin=Math.max(0,ymin-margem)
    xmax=Math.min(w-1,xmax+margem);ymax=Math.min(h-1,ymax+margem)
    const pixels=new Uint8Array(lado*lado);let usados=0
    for(let y=0;y<lado;y++)for(let x=0;x<lado;x++){
      const px=Math.round(xmin+(x+0.5)*(xmax-xmin+1)/lado)
      const py=Math.round(ymin+(y+0.5)*(ymax-ymin+1)/lado)
      if(escuro(Math.min(w-1,px),Math.min(h-1,py))){
        pixels[y*lado+x]=1;usados++
      }
    }
    if(usados<15||usados>lado*lado*.8)return null
    return {pixels,ocupacao:usados}
  }catch{return null}
}
export async function compararDesenhos(urlA:string,urlB:string):Promise<number|null>{
  const [a,b]=await Promise.all([assinatura(urlA),assinatura(urlB)])
  if(!a||!b)return null
  let intersecao=0,uniao=0
  for(let i=0;i<a.pixels.length;i++){
    if(a.pixels[i]&&b.pixels[i])intersecao++
    if(a.pixels[i]||b.pixels[i])uniao++
  }
  if(!uniao)return null
  const sobreposicao=intersecao/uniao
  const densidade=Math.min(a.ocupacao,b.ocupacao)/Math.max(a.ocupacao,b.ocupacao)
  return Math.round((sobreposicao*.8+densidade*.2)*100)
}
