# Preparação de backup externo — NÃO OPERACIONAL

Este diretório contém apenas validação local de pré-requisitos e critérios de aceite.
**Não exporta banco, não lê o conteúdo dos arquivos secretos, não acessa rede, não cifra,
não envia cópias, não agenda execuções e não configura alertas.** `--run` sempre falha.
Nenhum arquivo deste diretório comprova que o Atlas possui backup externo.
Não adicionar este preflight ao cron como se fosse uma rotina de backup.

## Verificação local

```bash
python3 scripts/security-backup/preflight.py --config /caminho/privado/config.json
python3 -m unittest discover -s scripts/security-backup -p 'test_*.py'
```

Copiar `config.example.json` para diretório privado fora do Git. Nunca colocar senhas,
URLs com credenciais, chaves de Storage ou configuração rclone no JSON ou no repositório.
A configuração aponta para arquivos privados: dono atual, modo 0600; diretório 0700.
O preflight não inspeciona valores, validade, versão dos executáveis nem conectividade.
Um código zero significa apenas formato e pré-requisitos locais aceitos. Todas as
verificações externas abaixo continuam obrigatórias.

## Fontes e destinos antes de implementar o exportador

1. Confirmar projeto efetivo, conexão PostgreSQL 17 compatível, SSL verificado e privilégios
   mínimos para dump consistente de todos os schemas necessários. Usar serviço libpq
   e arquivo de senha privado; nunca senha em argumentos ou logs. Validar papéis,
   extensões, funções, políticas e triggers. Um dump apenas de `public` é insuficiente.
2. Revisar procedimento oficial de recuperação Auth: usuários, identidades e configuração.
   Documentar quais sessões/segredos/provedores precisam ser recriados. Não prometer que
   um dump genérico cobre autenticação completa. Guardar segredos de recuperação em cofre separado.
3. Enumerar todos os buckets e todos os objetos com paginação e recursão. Copiar bytes e
   metadados, preservar nomes originais em manifesto e impedir traversal/symlink no disco.
   Comparar inventário antes/depois para detectar mudanças; banco e Storage não possuem
   snapshot atômico conjunto. Definir janela/consistência e não rotular execução divergente
   como sucesso completo. Um backup PostgreSQL não contém os bytes de Storage.
4. Verificar dois destinos em contas independentes: um com retenção protegida contra
   exclusão e outro no OneDrive empresarial. Dois nomes rclone não provam independência.
   Separar permissão de gravar da de apagar histórico. Confirmar espaço e responsáveis.
5. Validar destinatário público age e guardar chave privada de recuperação fora do Atlas,
   com responsável e cópia protegida. O exportador nunca precisa da chave privada.
6. Confirmar monitor externo ao Atlas que detecte falha e ausência de execução. Os canais
   de envio e responsáveis precisam ser autorizados. Nunca registrar sucesso apenas porque
   o processo iniciou ou o preflight passou.

## Contrato mínimo do futuro exportador

- Executar somente após configuração explícita, bloqueio de concorrência, espaço disponível
  e compatibilidade verificados; sem fallback para credenciais/destinos de produção implícitos.
- Dump consistente e leitura de objetos em área privada; falhas interrompem resultado completo.
- Manifesto interno: data UTC, versão do banco, commit, schemas, configurações não secretas,
  buckets/caminhos, contagens, tamanhos e SHA-256 de cada arquivo. Dados do manifesto também
  são privados; incluí-los no pacote cifrado.
- Cifrar pacote com age antes de qualquer upload. Upload de pacote sem cifra é proibido.
- Nome único por execução/data. Enviar aos dois destinos sem `sync`, purge, delete ou limpeza
  automática. Verificar os bytes remotos com download e SHA-256 local (ou hash de conteúdo
  equivalente comprovado), não somente tamanho ou um hash não compatível do provedor.
- Marcar sucesso completo somente após os dois destinos conferidos; registrar sucesso parcial
  por destino e alertar externamente. Não apagar cópia anterior em caso de falha.
- Definir tratamento seguro dos temporários em falha; nunca imprimir stdout/stderr bruto que
  possa conter credenciais. Não prometer apagamento seguro de bytes em SSD.
- Automatizar em executor confiável ligado continuamente. Se usar Mac desligado/suspenso,
  ter monitor de execução perdida e retomada. Definir RPO/RTO e retenção antes de produção.

## Aceite de restauração (obrigatório; ambiente isolado)

- Confirmar fonte e destino fora da produção; desativar WhatsApp, e-mails, cobranças,
  webhooks e automações reais ANTES de importar dados.
- Recuperar uma cópia de CADA destino; conferir SHA-256 e decifrar com chave separada.
- Restaurar banco conforme procedimento compatível Supabase/Postgres, sem executar migrations
  indiscriminadamente nem a rota de restauração interna sobre produção.
- Restaurar Auth/configurações e objetos; comparar contagens, tamanho e hashes com manifesto.
- Testar login com usuário controlado, Cliente 360, orçamento, financeiro, produção, anexos
  e isolamento entre empresas e perfis. Verificar integridade referencial e permissões.
- Medir ponto efetivamente recuperado, perda máxima de dados, duração e limitações. Registrar
  evidência e aprovação antes de anunciar recuperação validada. Repetir periodicamente.
- Não restaurar produção ou contratar serviços como efeito deste preflight.

## Evidência existente e limites

Em 24/10/2026 a organização Supabase foi confirmada Pro, mas os pontos reais de backup nativo
não foram consultados. A documentação informa backup diário com 7 dias no Pro; isso não
substitui conferir os pontos disponíveis. A data 05/09 do diagnóstico refere-se ao backup
INTERNO da aplicação. Os backups nativos também não cobrem bytes dos objetos Storage.

Referência oficial consultada: https://supabase.com/docs/guides/platform/backups
