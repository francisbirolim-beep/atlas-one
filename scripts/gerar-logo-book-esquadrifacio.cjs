const sharp=require('sharp')
const {createHash}=require('node:crypto')
const {readFileSync}=require('node:fs')
const path=require('node:path')
const assert=require('node:assert/strict')
const asset=path.join(__dirname,'../public/branding/esquadrifacio-logo-r.webp')
assert.equal(createHash('sha256').update(readFileSync(asset)).digest('hex'),'6812d1b5ea60d36178bf14d7a39aa380c60faaa5cacf16e20404f0085d9f4da7','Arte oficial alterada: confira a fonte.')
const bg=[248,247,243],inkBlack=[16,20,22],inkGreen=[104,176,135]
const colors={claro:[[20,25,28],[91,174,130]],escuro:[[245,250,250],[111,212,158]]}
const clamp=v=>Math.max(0,Math.min(1,v))
function fit(px,fg){
 let dot=0,size=0
 for(let i=0;i<3;i++){let delta=fg[i]-bg[i];dot+=(px[i]-bg[i])*delta;size+=delta*delta}
 const alpha=clamp(dot/size);let error=0
 for(let i=0;i<3;i++)error+=(px[i]-(bg[i]+alpha*(fg[i]-bg[i])))**2
 return {alpha,error}
}
;(async()=>{
 const {data,info}=await sharp(asset).raw().toBuffer({resolveWithObject:true})
 assert.equal(info.width,640);assert.equal(info.height,118)
 const out={}
 for(const key of Object.keys(colors))out[key]=Buffer.alloc(info.width*info.height*4)
 let visible=0
 for(let i=0;i<info.width*info.height;i++){
  const p=i*info.channels,q=i*4,px=[data[p],data[p+1],data[p+2]]
  const dark=fit(px,inkBlack),green=fit(px,inkGreen)
  const isGreen=(px[1]-px[0]>7)&&green.error<dark.error*1.4
  const opacity=isGreen?green.alpha:dark.alpha
  const alpha=Math.round(255*(opacity<0.035?0:Math.pow(opacity,0.98)))
  if(alpha>35)visible++
  for(const key of Object.keys(colors)){
   const rgb=colors[key][isGreen?1:0],buffer=out[key]
   for(let c=0;c<3;c++)buffer[q+c]=rgb[c]
   buffer[q+3]=alpha
  }
 }
 for(const key of Object.keys(colors)){
  const filename='esquadrifacio-logo-r-transparente-'+key+'.webp'
  await sharp(out[key],{raw:{width:640,height:118,channels:4}}).resize(1280,236,{kernel:'lanczos3'}).webp({quality:94,effort:6}).toFile(path.join(__dirname,'../public/branding',filename))
 }
 console.log('Logotipos transparentes gerados com ® preservado, pixels visíveis:',visible)
})().catch(e=>{console.error(e);process.exitCode=1})
