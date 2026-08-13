# Padrão de pesquisa do Atlas One

Toda pesquisa textual do Atlas deve seguir o mesmo comportamento:

- ignorar acentos/diacríticos (`joao` encontra `JOÃO`, `sao` encontra `SÃO`);
- ignorar diferença entre maiúsculas e minúsculas;
- filtrar enquanto a pessoa digita, sem botão Pesquisar/Enter;
- aceitar correspondência parcial (`orc` encontra `ORÇAMENTO`);
- para campos numéricos, comparar somente dígitos quando aplicável;
- preferir `bateBusca`/`normalizarBusca` de `lib/texto.ts`, evitando implementações locais com `toLowerCase().includes(...)`.
