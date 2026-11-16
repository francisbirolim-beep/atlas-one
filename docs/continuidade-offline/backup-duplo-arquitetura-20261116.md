# Atlas One — desenho do backup local + backup online independente

**Estágio:** proposta de engenharia em branch isolada, sem implantação nem agendamento.  
**Objetivo solicitado:** se houver falha no SERVIDOR, restaurar usando a cópia online; se houver falha na nuvem, restaurar pela cópia local, sujeitas à data do último backup recuperável.

## Topologia proposta

1. **Origem operacional**: banco PostgreSQL/Supabase + Supabase Storage, com app online atualmente em funcionamento. Não modificar rotas nem apontar clientes para outro banco nesta etapa.
2. **Destino A — servidor da Esquadrifácio**: pacote integral cifrado em pasta exclusiva, acesso restrito e execução com baixo consumo de CPU/I/O para não prejudicar SQL Server e demais atividades. Destino inicial pode estar no disco C:, mas **não é independente do disco físico do servidor**.
3. **Destino B — nuvem separada**: armazenamento privado de objetos em conta/projeto independente, com criptografia, versionamento, proteção de retenção/imutabilidade quando oferecidos e privilégios separados. Não pressupor contrato, bucket, credencial nem custo já aprovado.
4. **Backup gerenciado Supabase Pro**: camada adicional para o PostgreSQL quando se confirmar a disponibilidade real dos snapshots, mas não substitui o export de bytes do Storage nem a cópia fora da conta/plataforma.
5. **Ambiente de recuperação isolado**: usar snapshots em banco e Storage de teste, com integrações externas desligadas. Nunca restaurar por cima da produção para testar.

## Conteúdo obrigatório da cópia

- Dados e estrutura de **todos** os schemas necessários, migrations, permissões, políticas, funções e funções de negócio, sem exportar segredos em repositório.
- Arquivos físicos de **todos os buckets** Supabase Storage (não só os metadados), com checagem de tamanho/hash e acompanhamento de versões quando aplicável.
- Versão imutável identificadora do código e da configuração de serviços necessários para subir a aplicação, evitando copiar chaves privadas para logs ou GitHub.
- Campos de domínio e fotos de catálogos de **perfis e acessórios**, projetos, medições, comprovantes e anexos, com vínculo aos registros.
- Pendente avaliar se o Neon staging ou qualquer outro sistema é fonte de dados independentes a serem protegidos; não presumir cobertura.

## Etapas da rotina futura

1. Preparar diretório temporário e destino de backup **separado das pastas operacionais**, validando quota e espaço.
2. Executar export consistente de banco e Storage com credenciais exclusivas, minimizando impacto na origem. Evitar bloquear o uso do ERP.
3. Gerar manifesto de arquivos com tamanho, SHA-256 e cobertura declarada; validar inventários por tabela e por bucket.
4. Cifrar o pacote com chave gerenciada fora do pacote; guardar chave de recuperação em local autorizado. A integridade deve ser verificada tanto no pacote local quanto no arquivo transferido.
5. Salvar cópia local sem sobrescrever backups anteriores.
6. Enviar cópia cifrada ao destino remoto com upload resiliente/repetível; marcar OK **somente depois** da confirmação de armazenamento e verificação de leitura.
7. Registrar o estado separado: backup local, envio remoto, hash verificado, data do ponto recuperável e último ensaio de restauração. Falha em uma cópia não deve apagar a outra.
8. Aplicar retenção protegida somente depois de confirmar existência de outro conjunto íntegro; nunca apagar o último backup restaurável.
9. Em ambiente isolado, restaurar o banco e os anexos e testar os módulos reais. O backup não será declarado operacional até essa prova.

## Regras de segurança e não interferência

- Não instalar serviços ou alterar suspensão, firewall, tarefas agendadas, SQL Server ou configurações atuais sem janela e aprovação específica.
- Rodar a transferência em tarefa de baixa prioridade, com banda e I/O limitados, após validação da máquina e sem travar os usuários.
- Não usar a letra K: como destino independente: na inspeção ela representa compartilhamento do próprio SERVIDOR no mesmo disco físico.
- Não escolher senhas ou chaves no código. Não armazenar backup em repositório, arquivo público, chat ou link compartilhável.
- O repositório contém scripts de **validação** de manifesto e hashes, não um exportador de banco nem um uploader de nuvem.
- Um OK de SHA-256 não prova restauração: somente o ensaio isolado completo aprova recuperação.
- Não há replicação bidirecional de tabelas neste desenho: ela é trabalho diferente de backup e pode causar conflitos.

## Pré-condições ainda pendentes antes de executar backups reais

- [ ] Revisão de infraestrutura, banco e segurança por especialista independente qualificado.
- [ ] Confirmar backups administrados Supabase Pro com datas e política de retenção.
- [ ] Escolher provedor online e isolamento da conta, proteção de retenção e orçamento, sem contratar automaticamente.
- [ ] Definir onde guardar a chave de criptografia e como recuperá-la com controle de acesso.
- [ ] Homologar export PostgreSQL + Storage com dados de teste e estimar tempo/tamanho.
- [ ] Definir metas RPO (perda máxima tolerável) e RTO (tempo máximo para restabelecer) com a empresa.
- [ ] Ensaiar restauração isolada e verificar tabelas, arquivos e permissões.
- [ ] Avaliar espaço, desempenho, disponibilidade de rede e execução em segundo plano no SERVIDOR, mantendo outros serviços intactos.
- [ ] Aprovação explícita antes de qualquer alteração em produção.

**Nenhuma cópia nova foi gerada por este documento; nenhum backup em nuvem foi contratado ou ativado.**
