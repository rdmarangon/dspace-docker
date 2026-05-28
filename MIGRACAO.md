# Guia de Migração — DSpace 6.3 → 9.x

Instruções técnicas para executar a migração e operar o ambiente de testes.

---

## Pré-requisitos

- Docker >= 24 e Docker Compose v2
- Certificados SSL do domínio (`*.crt` e `*.key`)
- Dump SQL do DSpace 6.3 exportado do ambiente de produção
- Assetstore (diretório de arquivos binários do repositório)

---

## Configuração inicial

### 1. Variáveis de ambiente

```bash
cp .env.exemplo .env
```

Edite o `.env` com a senha da base de dados em produção.

### 2. Certificados SSL

Copie os certificados SSL do domínio para o diretório `nginx/certs/` deste repositório:

```bash
cp testedspace.ufjf.br.crt nginx/certs/
cp testedspace.ufjf.br.key nginx/certs/
```

O nginx lê os certificados dentro do container em `/etc/nginx/certs/`. Manter os nomes conforme no exemplo.

---

## Capítulo 1 — Limpeza do ambiente

Execute este bloco sempre que quiser descartar um ciclo de testes anterior e começar do zero.

```bash
# Derruba os containers
docker compose -f docker-compose-7.yml down
docker compose -f docker-compose-9.yml down

# Remove os volumes de dados
rm -rf /docker/volumes/dspace7/postgresql
rm -rf /docker/volumes/dspace/postgresql
rm -rf /docker/volumes/dspace/solr

# Recria os diretórios
mkdir -p /docker/volumes/dspace7/postgresql
mkdir -p /docker/volumes/dspace/postgresql
mkdir -p /docker/volumes/dspace/solr
```

---

## Capítulo 1.5 — Preparar o dump 6.3 antes de restaurar

Execute os passos abaixo no dump exportado de produção antes de iniciar a migração.

### Passo 1 — Remover o path `/jspui` das URLs

Remover o contexto `/jspui`. Remova-o de todas as URLs gravadas no banco:

```bash
sed 's/\/jspui//g' /home/repositorio/dspace_63.sql > /home/repositorio/dspace_63_sem_jspui.sql
```

### Passo 2 — Substituir a URL de produção pela URL de teste _(apenas no ambiente de teste)_

```bash
sed 's/:\/\/repositorio.ufjf.br/:\/\/testedspace.ufjf.br/g' \
    /home/repositorio/dspace_63_sem_jspui.sql > /home/repositorio/dspace_63_alterado.sql
```

Aponte `DB_INIT_SQL_63` no `.env` para o arquivo final (`dspace-alterado.sql`).

---

## Capítulo 2 — Migração 6.3 → 7.6

### Passo 1 — Subir o banco e aguardar a restauração do dump 6.3

```bash
docker compose -f docker-compose-7.yml up -d dspacedb-7
docker logs -f dspacedb-7
```

Aguardar a linha:

```
database system is ready to accept connections
```

O postgres restaura automaticamente o arquivo definido em `DB_INIT_SQL_63` na primeira inicialização do volume.

### Passo 2 — Migrar schema 6.3 → 7

```bash
docker compose -f docker-compose-7.yml run --rm dspace-7-cli \
    /dspace/bin/dspace database migrate ignored
```

> O argumento `ignored` é obrigatório neste contexto. Sem ele, o comando falha ao encontrar migrações já aplicadas parcialmente no banco legado. Veja a discussão na lista oficial: https://groups.google.com/g/dspace-tech/c/s5ucnH5kla8

### Passo 3 — Gerar o dump 7.6

```bash
docker exec -t dspacedb-7 pg_dump -U dspace -d dspace -F p -f /tmp/dspace_76.sql
docker cp dspacedb-7:/tmp/dspace_76.sql /home/repositorio/dspace_76.sql
```

Atualize `DB_INIT_SQL` no `.env` com o caminho `/home/repositorio/dspace_76.sql`.

### Passo 4 — Derrubar o ambiente 7

```bash
docker compose -f docker-compose-7.yml down
```

---

## Capítulo 3 — Deploy DSpace 9 (a partir do dump 7.6)

### Passo 1 — Limpar o volume do Solr

O índice do DSpace 7 é incompatível com o DSpace 9. Limpe o volume antes de subir:

```bash
rm -rf /docker/volumes/dspace/solr/*
```

### Passo 2 — Subir o banco e aguardar a restauração do dump 7.6

```bash
docker compose -f docker-compose-9.yml up -d dspacedb
docker logs -f dspacedb
```

Aguardar a linha:

```
database system is ready to accept connections
```

### Passo 3 — Migrar schema 7 → 9

```bash
docker compose -f docker-compose-9.yml run --rm dspace-cli \
    /dspace/bin/dspace database migrate ignored
```

### Passo 4 — Subir toda a stack

```bash
docker compose -f docker-compose-9.yml up -d
```

### Passo 5 — Acompanhar os logs

```bash
docker compose -f docker-compose-9.yml logs -f
```

Aguardar o DSpace inicializar completamente antes de prosseguir (`Started ServerBootApplication` no log do container `dspace`).

### Passo 6 — Reindexar o Solr _(obrigatório após migração)_

Os itens do repositório não aparecem na busca até que o índice seja reconstruído:

```bash
docker compose -f docker-compose-9.yml run --rm dspace-cli index-discovery -b
```

Este processo pode demorar vários minutos dependendo do tamanho do repositório.

---

## Tarefas agendadas (cron)

Adicione ao crontab do servidor (`crontab -e`) as tarefas abaixo para manter o índice e os sitemaps atualizados:

```
0 3 * * * docker exec dspace /dspace/bin/dspace index-discovery -b >> /var/log/dspace-index.log 2>&1
0 4 * * * docker exec dspace /dspace/bin/dspace generate-sitemaps >> /var/log/dspace-sitemaps.log 2>&1
```

- **3h** — reindexação do Solr (`index-discovery -b`)
- **4h** — geração dos sitemaps, após o índice estar atualizado

Os sitemaps são gravados em `${DSPACE_DIR}/sitemaps` (montado em `/dspace/sitemaps` no container e em `/var/www/sitemaps` no nginx).

---

## Comandos úteis

```bash
# Ver status dos serviços
docker compose -f docker-compose-9.yml ps

# Derrubar tudo
docker compose -f docker-compose-9.yml down

# Reindexar o Solr
docker compose -f docker-compose-9.yml run --rm dspace-cli \
    /dspace/bin/dspace index-discovery -b

# Shell no container backend
docker exec -it dspace bash

# Backup do banco
docker exec dspacedb pg_dump -Fc -U dspace dspace > backup_$(date +%Y%m%d).dump
```
