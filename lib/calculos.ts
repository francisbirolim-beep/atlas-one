import { TipoEsquadria } from './tipos'

interface ResultadoCalculo {
  perfis: { nome: string; referencia: string; quantidade_m: number; preco_m: number }[]
  vidro: { tipo: string; espessura_mm: number; area_m2: number; preco_m2: number }
  acessorios: { nome: string; quantidade: number; preco_unit: number }[]
  peso_estimado_kg: number
  custo_material: number
}

const PRECO_PERFIL = 45
const PRECO_VIDRO_TEMPERADO = 180
const PRECO_VIDRO_COMUM = 90

function calcPortaCorrer(largura: number, altura: number): ResultadoCalculo {
  const area = (largura * altura) / 1_000_000
  const perfis = [
    { nome: 'Marco superior', referencia: 'MC-01', quantidade_m: largura / 1000 + 0.1, preco_m: PRECO_PERFIL },
    { nome: 'Marco inferior', referencia: 'MC-02', quantidade_m: largura / 1000 + 0.1, preco_m: PRECO_PERFIL },
    { nome: 'Montante fixo', referencia: 'MT-01', quantidade_m: altura / 1000, preco_m: PRECO_PERFIL },
    { nome: 'Montante móvel', referencia: 'MT-02', quantidade_m: altura / 1000, preco_m: PRECO_PERFIL },
    { nome: 'Travessa superior', referencia: 'TR-01', quantidade_m: largura / 2000, preco_m: PRECO_PERFIL },
    { nome: 'Travessa inferior', referencia: 'TR-02', quantidade_m: largura / 2000, preco_m: PRECO_PERFIL },
  ]
  const vidro = { tipo: 'temperado_8mm', espessura_mm: 8, area_m2: area * 0.85, preco_m2: PRECO_VIDRO_TEMPERADO }
  const acessorios = [
    { nome: 'Kit roldanas', quantidade: 2, preco_unit: 35 },
    { nome: 'Fechadura correr', quantidade: 1, preco_unit: 80 },
    { nome: 'Puxador', quantidade: 2, preco_unit: 25 },
    { nome: 'Vedação inferior', quantidade: 1, preco_unit: 30 },
  ]
  const custoMaterial = perfis.reduce((s, p) => s + p.quantidade_m * p.preco_m, 0)
    + vidro.area_m2 * vidro.preco_m2
    + acessorios.reduce((s, a) => s + a.quantidade * a.preco_unit, 0)
  return { perfis, vidro, acessorios, peso_estimado_kg: area * 12, custo_material: Math.round(custoMaterial * 100) / 100 }
}

function calcJanelaCorrer(largura: number, altura: number): ResultadoCalculo {
  const area = (largura * altura) / 1_000_000
  const perfis = [
    { nome: 'Marco superior', referencia: 'MC-01', quantidade_m: largura / 1000 + 0.05, preco_m: PRECO_PERFIL },
    { nome: 'Marco inferior', referencia: 'MC-02', quantidade_m: largura / 1000 + 0.05, preco_m: PRECO_PERFIL },
    { nome: 'Montante fixo', referencia: 'MT-01', quantidade_m: altura / 1000, preco_m: PRECO_PERFIL },
    { nome: 'Montante móvel', referencia: 'MT-02', quantidade_m: altura / 1000, preco_m: PRECO_PERFIL },
    { nome: 'Peitoril', referencia: 'PT-01', quantidade_m: largura / 1000 + 0.1, preco_m: PRECO_PERFIL },
  ]
  const vidro = { tipo: 'comum_4mm', espessura_mm: 4, area_m2: area * 0.88, preco_m2: PRECO_VIDRO_COMUM }
  const acessorios = [
    { nome: 'Kit roldanas janela', quantidade: 2, preco_unit: 25 },
    { nome: 'Fecho janela', quantidade: 1, preco_unit: 40 },
    { nome: 'Vedação', quantidade: 2, preco_unit: 15 },
  ]
  const custoMaterial = perfis.reduce((s, p) => s + p.quantidade_m * p.preco_m, 0)
    + vidro.area_m2 * vidro.preco_m2
    + acessorios.reduce((s, a) => s + a.quantidade * a.preco_unit, 0)
  return { perfis, vidro, acessorios, peso_estimado_kg: area * 10, custo_material: Math.round(custoMaterial * 100) / 100 }
}

export function calcularEsquadria(tipo: TipoEsquadria, largura_mm: number, altura_mm: number, quantidade: number = 1): ResultadoCalculo {
  const calc = tipo === 'porta_correr' || tipo === 'porta_pivotante' || tipo === 'porta_abrir'
    ? calcPortaCorrer(largura_mm, altura_mm)
    : calcJanelaCorrer(largura_mm, altura_mm)
  return { ...calc, custo_material: Math.round(calc.custo_material * quantidade * 100) / 100 }
}

export function calcularValorVenda(custoMaterial: number, margem: number = 40): number {
  return Math.round((custoMaterial / (1 - margem / 100)) * 100) / 100
}
