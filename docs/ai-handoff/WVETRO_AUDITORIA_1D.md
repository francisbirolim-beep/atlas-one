# Auditoria W.Vetro — execução diária por fonte

Checkpoint temporário de implementação. A auditoria histórica passa a processar um único dia por requisição e separa Pedidos de Orçamentos em chamadas distintas para reduzir timeout 504 em períodos de maior volume. O cadastro técnico Atlas, os 109 mapeamentos de tipologia e as referências de variáveis permanecem preservados.
