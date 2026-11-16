# Atlas One — pacote criptografado para teste isolado

**Estado em 2026-11-16:** ferramenta de transporte e verificação; **NÃO produz backup do Supabase**, não agenda execução e não muda o Atlas em produção.

## Destinos confirmados

- SERVIDOR (Windows 11): pasta do OneDrive contendo `BACKUP ATLAS` encontrada.
- Mac: pasta `BACKUP ATLAS` no OneDrive-Pessoal encontrada.
- Um arquivo fictício criado no SERVIDOR chegou ao Mac e foi conferido. Isso valida a sincronização **entre esses dispositivos naquele momento**, mas não atesta retenção, recuperação nem independência contra exclusão sincronizada.

## Ferramenta

`atlas-package.mjs`: Node 20+ sem dependências, AES-256-GCM com IV aleatório de 96 bits por arquivo, autenticação por tag, cópia com política de não sobrescrever e verificação de hashes. A chave de 32 bytes é fornecida de arquivo **fora da pasta sincronizada**; nunca registrar a chave no GitHub.

- `seal SOURCE ARQUIVO_LOCAL.atlas.enc ARQUIVO_ONEDRIVE.atlas.enc ARQUIVO_CHAVE`
- `verify ARQUIVO.atlas.enc ARQUIVO_CHAVE`
- `restore ARQUIVO.atlas.enc DESTINO_FICTICIO ARQUIVO_CHAVE`

**Importante:** o verificador confere a cópia visível ao sistema de arquivos e sua tag de autenticação. Não pode afirmar que houve upload completo ao serviço remoto sem confirmação independente.

## Etapas obrigatórias antes de dados reais

1. Determinar credenciais e métodos **somente leitura** para exportação consistente do PostgreSQL completo e de todos os objetos em Storage; **não usar** o backup interno de 11 tabelas.
2. Confirmar que dados do Storage (bytes de 14 buckets) e metadados, autenticação, funções, políticas e configurações necessárias serão recuperáveis. O dump SQL sozinho é insuficiente.
3. Definir armazenamento/custódia da chave de recuperação em local independente do servidor, OneDrive e Mac, com controles de acesso e procedimento documentado. Uma única chave no servidor é um ponto único de falha.
4. Implementar exportação streaming com carga limitada, arquivos de manifesto, snapshots não sobrescritos, retenção e alertas; ensaiar em ambiente isolado.
5. Revalidar sincronismo OneDrive e confirmar remotamente a cópia; testar recuperação fora do SERVIDOR com banco e Storage separados, integrações externas desabilitadas.
6. Passar por revisão independente de segurança e banco; ativar agendamento apenas após a validação e aprovação da operação.

Nada foi publicado na branch main nem nos serviços de produção.
