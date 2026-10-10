# Revisão final de formatação e migrações não aplicadas — 10/10/2026

Etapa sem mudanças no banco de produção. Foram lidos os SQLs das versões aplicadas e conferidos seus hashes MD5.

- 126 migrações cuja versão e SQL correspondiam após remover espaços foram substituídas pelo texto exato salvo no histórico do Supabase.
- 2 migrações adicionais, de Cotação e compatibilidade de Instalação, tinham diferenças em comentários e formatação; foram igualmente alinhadas ao texto exato aplicado.
- Os 128 arquivos originais foram preservados integralmente na pasta supabase/migrations-review/20261010-formatacao-e-simultaneas, com SHA-256, MD5 e blob Git original.
- As 87 migrações com diferenças materiais já reconciliadas anteriormente e as 56 versões previamente recuperadas não foram alteradas.
- As 44 versões locais nunca comprovadas como aplicadas continuam fora da pasta ativa e não foram executadas. Classificação por conteúdo, nome e hash consta do manifesto JSON.
- O diretório ativo inclui 316 versões únicas como no histórico observado nesta auditoria.

**Importante:** Arquivos classificados como equivalentes são apenas candidatos a limpeza técnica. Nenhum deles deve ser aplicado, apagado ou marcado como executado automaticamente. Comparar o conteúdo preservado com o SQL aplicado não substitui testar a reconstrução de uma base nova em ambiente isolado.

## Reversão

Reverter o commit deste PR restaura os arquivos antigos; nenhum rollback de banco é necessário. Os hashes de recuperação estão no manifesto e no teste automatizado.
