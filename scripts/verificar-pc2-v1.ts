import { readFileSync } from 'node:fs'
import { calcularFormulaCorteIsolada, calcularFormulasCorte } from '../lib/formulasCorteEngine'
import type { TipologiaFormulasCorte } from '../lib/formulasCorteEngine'

const sql = readFileSync('supabase/migrations/20260916011453_pc2_suprema_receita_v1.sql', 'utf8')
const variaveisSql = readFileSync('supabase/migrations/20260916012340_pc2_suprema_variaveis_v1.sql', 'utf8')
function bloco(campo: string) {
  const match = sql.match(new RegExp(`\\b${campo} = '([\\s\\S]*?)'::jsonb,`))
  if (!match) throw new Error(`Bloco ${campo} ausente`)
  return JSON.parse(match[1])
}
const variaveisNovas = JSON.parse(variaveisSql.match(/variaveis = f\.variaveis \|\| '([\s\S]*?)'::jsonb,/)?.[1] || '[]')
const definicao: TipologiaFormulasCorte = { tipologia_id: 'pc2', variaveis: [...bloco('variaveis'), ...variaveisNovas], pecas: bloco('pecas') }
const vidro = bloco('vidro')

function simular(L: number, H: number, opcoes: Record<string,string>) {
  const pecas = calcularFormulasCorte(definicao, L, H, opcoes)
  const corte = (codigo: string, eixo?: string) => pecas.find(p => p.codigo === codigo && (!eixo || p.eixo === eixo))?.tamanho
  const formulaCondicional = (base: string, regras: Array<{quando: Record<string,string[]>; formula:string}>) =>
    regras.reduce((formula, regra) => Object.entries(regra.quando).every(([chave, valores]) => valores.includes(opcoes[chave])) ? regra.formula : formula, base)
  const vidroL = calcularFormulaCorteIsolada(formulaCondicional(vidro.formula_largura, vidro.condicoes_largura), L, H)
  const vidroH = calcularFormulaCorteIsolada(formulaCondicional(vidro.formula_altura, vidro.condicoes_altura), L, H)
  return { corte, vidroL, vidroH }
}

const base = simular(2000, 2200, { contramarco:'sem', arremate:'sem', trilho:'macarrao', fechamento:'fechadura', mao_amigo_largura:'comum', reforco_mao_amigo:'interno_externo', roldana:'100', montante_lateral:'largo', puxador:'sem', cor:'Natural', vidro:'Incolor 06mm - Temperado' })
const esperado: Array<[string,number,string?]> = [['SU001',1970],['TMC',1970],['SU007',2196],['SU008',2183],['SU053',917],['SU225',917],['SU280',2166],['SU047',2166],['SU049',2166],['SU102',917,'L'],['SU102',2015,'H']]
for (const [codigo, valor, eixo] of esperado) if (base.corte(codigo,eixo) !== valor) throw new Error(`${codigo}: esperado ${valor}, recebido ${base.corte(codigo,eixo)}`)
if (base.vidroL !== 911 || base.vidroH !== 2033) throw new Error(`Vidro: ${base.vidroL}×${base.vidroH}`)

// Regressão da medida CM200 larga já representada no editor anterior.
const cm = simular(2137, 2419, { contramarco:'cm200', arremate:'interno', trilho:'macarrao', fechamento:'fechadura', mao_amigo_largura:'largo', reforco_mao_amigo:'interno_externo', roldana:'100', montante_lateral:'largo', puxador:'sem', cor:'Natural', vidro:'Incolor 06mm - Temperado' })
if (cm.corte('CM200','L') !== 2089 || cm.corte('CM200','H') !== 2395 || cm.corte('MP347','L') !== 2157 || cm.corte('SU001') !== 2083 || cm.corte('SU053') !== 962 || cm.vidroL !== 956 || cm.vidroH !== 2240) throw new Error('Regressão CM200 larga falhou')
console.log('PC2 V1: 2000×2200 e regressão CM200 larga passaram')
