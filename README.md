# dspace-docker

Infraestrutura Docker para migração do DSpace 6.3 para o DSpace 9.x do Repositório Institucional da UFJF.

**Escopo:** este repositório é exclusivamente para a fase de migração. O deploy em produção é gerenciado pelo `dspace-ansible`

## Visão geral

O fluxo opera em dois compose files:

| Arquivo                | Finalidade                                                      |
| ---------------------- | --------------------------------------------------------------- |
| `docker-compose-7.yml` | Sobe banco + CLI do DSpace 7 para migrar dump 6.3 → 7.6         |
| `docker-compose-9.yml` | Stack completa do DSpace 9 para migrar dump 7.6 → 9.x e validar |

O fluxo de migração passa por três etapas:

1. Restaurar o dump do DSpace 6.3 e migrar o schema para 7.6
2. Gerar um dump 7.6 do banco migrado
3. Restaurar o dump 7.6, migrar o schema para 9.x e subir toda a stack

Para os comandos detalhados, consulte o [Guia de Migração](MIGRACAO.md).

---

## Saída esperada

Ao final da migração, o dump em formato custom do PostgreSQL:

```bash
pg_dump -Fc -U dspace dspace > dspace.dump
```

Esse arquivo é o único insumo necessário para o `dspace-ansible` provisionar e colocar o repositório em produção.
