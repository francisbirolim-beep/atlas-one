# Auditoria W.Vetro — lotes de 7 dias

A segunda execução viva confirmou timeout 504 mesmo com lotes de 30 dias, no intervalo 2025-09-17 a 2025-10-16 (34/45).

A partir desta correção:
- histórico: lotes de até 7 dias;
- catálogo de produtos: 3 itens por chamada;
- cópia de imagens: 3 itens por chamada;
- API rejeita período histórico acima de 7 dias;
- em caso de 504, não reiniciar sem limpeza dos agregados históricos da tentativa incompleta.

Antes da próxima execução completa, limpar somente `wvetro_referencias_componentes` e `wvetro_referencias_vidros`, zerar metadados de ocorrência histórica das referências de tipologia e marcar execuções `em_execucao` anteriores como `erro`. Preservar os 109 mapeamentos formais de tipologia, variáveis W.Vetro e todo cadastro técnico Atlas.
