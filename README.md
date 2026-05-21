# dspace-docker

Infraestrutura Docker para o Repositório Institucional da UFJF, com suporte à migração do DSpace 6.3 para o DSpace 9.x.

## Visão geral

Este repositório automatiza o processo de migração e disponibiliza um ambiente de testes para validar o DSpace 9 antes do deploy definitivo. O fluxo opera em dois compose files:

| Arquivo                | Finalidade                                                      |
| ---------------------- | --------------------------------------------------------------- |
| `docker-compose-7.yml` | Sobe banco + CLI do DSpace 7 para migrar dump 6.3 → 7.6         |
| `docker-compose-9.yml` | Stack completa do DSpace 9 (nginx, postgres, solr, backend, UI) |

O fluxo de migração passa por três etapas:

1. Restaurar o dump do DSpace 6.3 e migrar o schema para 7.6
2. Gerar um dump 7.6 do banco migrado
3. Restaurar o dump 7.6, migrar o schema para 9.x e subir toda a stack

Para os comandos detalhados, consulte o [Guia de Migração](MIGRACAO.md).

---

## Considerações para o deploy definitivo

O projeto DSpace não disponibiliza imagens Docker homologadas para produção — as imagens existentes são destinadas a desenvolvimento e testes. A equipe deverá avaliar qual arquitetura adotar para o ambiente produtivo. As duas opções principais estão descritas abaixo.

### Opção A — Manter Docker

Viável, mas exige resolver pontos que não foram priorizados no ambiente de testes:

- **Interface Angular:** o container `dspace-ui` atual usa `ng serve`, o servidor de desenvolvimento do Angular CLI. O build estático (`ng build --configuration production`) servido pelo nginx seria o caminho correto, mas foi descartado neste ambiente: sem orquestração (Kubernetes), separar os containers de front e back introduziria complexidade operacional sem ganho equivalente e abriria margem para desacoplamento indesejado entre os dois serviços. A solução atual é consciente dessa limitação.
- **PostgreSQL em container:** o banco de dados do repositório institucional ficaria isolado do ecossistema de backup e monitoramento do servidor. Seria necessário definir política de snapshots de volume, retenção de backups e integração com as ferramentas de monitoramento da TI.

### Opção B — Bare metal com Ansible

Instalação direta no servidor, com automação via Ansible:

- PostgreSQL, Solr e o backend Java (Tomcat) rodam como serviços nativos do OS, integráveis com as políticas de backup e monitoramento já existentes.
- A UI Angular é gerada como build estático e servida pelo nginx, sem adaptações adicionais.
- Playbooks Ansible oferecem reprodutibilidade equivalente ao Docker Compose e documentam o estado esperado do servidor de forma declarativa.
- Alinha com a documentação oficial de instalação do DSpace para ambientes produtivos.

### Reaproveitamento deste repositório

Independente da opção escolhida para produção, os scripts de migração aqui documentados continuam válidos para migrar os dados (6.3 → 7.6 → 9.x) em ambiente isolado antes de qualquer deploy definitivo.
