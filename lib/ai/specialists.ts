import { AIModulo } from './types'

export type AIEspecialista = {
  modulo: AIModulo
  nome: string
  objetivo: string
  permiteCalculoDeterministico: false
}

export const AI_ESPECIALISTAS: AIEspecialista[] = [
  { modulo: 'gestao', nome: 'Atlas Gestão', objetivo: 'Analisar indicadores, gargalos, prioridades e responder perguntas gerenciais com dados permitidos do Atlas.', permiteCalculoDeterministico: false },
  { modulo: 'comercial', nome: 'Atlas Comercial', objetivo: 'Apoiar leads, follow-ups, visitas, oportunidades, regiões e relacionamento comercial.', permiteCalculoDeterministico: false },
  { modulo: 'orcamento', nome: 'Atlas Orçamentista', objetivo: 'Interpretar solicitações e auxiliar a estruturação do orçamento; cálculos permanecem no MEE.', permiteCalculoDeterministico: false },
  { modulo: 'medicao_final', nome: 'Atlas Medição', objetivo: 'Interpretar documentos, fotos, checklists e apontar informações faltantes da medição.', permiteCalculoDeterministico: false },
  { modulo: 'engenharia', nome: 'Atlas Engenharia', objetivo: 'Consultar conhecimento técnico e recomendar soluções sem substituir as regras determinísticas do MEE.', permiteCalculoDeterministico: false },
  { modulo: 'compras', nome: 'Atlas Compras', objetivo: 'Apoiar análise de necessidades, fornecedores, divergências e prioridades de compra.', permiteCalculoDeterministico: false },
  { modulo: 'estoque', nome: 'Atlas Estoque', objetivo: 'Auxiliar identificação de materiais, recebimento por imagem e investigação de divergências.', permiteCalculoDeterministico: false },
  { modulo: 'producao', nome: 'Atlas Produção', objetivo: 'Apoiar acompanhamento de produção, gargalos, prioridades e consultas operacionais.', permiteCalculoDeterministico: false },
  { modulo: 'instalacao', nome: 'Atlas Instalação', objetivo: 'Apoiar checklists, histórico de obra, ocorrências e preparação das instalações.', permiteCalculoDeterministico: false },
  { modulo: 'financeiro', nome: 'Atlas Financeiro', objetivo: 'Explicar indicadores, apoiar cobranças e análises sem substituir cálculos financeiros determinísticos.', permiteCalculoDeterministico: false },
  { modulo: 'marketing', nome: 'Atlas Marketing', objetivo: 'Apoiar planejamento, conteúdo, campanhas e análise de oportunidades de comunicação.', permiteCalculoDeterministico: false },
  { modulo: 'rh', nome: 'Atlas RH', objetivo: 'Apoiar rotinas, treinamento e organização de conhecimento de pessoas.', permiteCalculoDeterministico: false },
  { modulo: 'qualidade', nome: 'Atlas Qualidade', objetivo: 'Apoiar análise de não conformidades, padrões e melhoria contínua.', permiteCalculoDeterministico: false },
  { modulo: 'pd', nome: 'Atlas P&D', objetivo: 'Apoiar pesquisa, organização de hipóteses e desenvolvimento de novas soluções.', permiteCalculoDeterministico: false },
]

export function especialistaDoModulo(modulo: AIModulo) {
  return AI_ESPECIALISTAS.find(item => item.modulo === modulo)
}
