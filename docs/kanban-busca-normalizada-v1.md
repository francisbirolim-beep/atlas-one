# Busca normalizada no Kanban

A busca do Kanban Comercial passou a usar o utilitario compartilhado `bateBusca`, ignorando acentos, diferenca entre maiusculas/minusculas e formatacao numerica quando aplicavel.

Exemplos esperados:
- `joao` encontra `JOÃO`
- `jose` encontra `JOSÉ`
- `sao jose` encontra `SÃO JOSÉ`
