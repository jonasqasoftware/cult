# CULT — MVP 1 Technical Specification

**Produto:** CULT  
**Versão:** MVP 1  
**Cidade inicial:** Porto Alegre, RS  
**Timezone:** `America/Sao_Paulo`  
**Modelo de distribuição:** Web/PWA, mobile-first  
**Modelo de negócio:** produto proprietário / repositório privado  
**Objetivo principal:** provar que o CULT reduz a fragmentação da descoberta cultural ao reunir eventos de Porto Alegre em uma experiência única, confiável e fácil de usar.

---

# 1. Product hypothesis

## Hipótese principal

> Pessoas usarão o CULT para decidir o que fazer em Porto Alegre porque ele agrega e organiza eventos que hoje estão dispersos em múltiplas fontes.

## Sinal de validação

O MVP é considerado promissor se usuários reais conseguirem executar o fluxo:

`visita → descoberta → detalhe → intenção`

onde intenção é pelo menos uma das ações:

- compartilhar;
- abrir ingresso;
- abrir rota/mapa;
- salvar localmente;
- retornar ao CULT.

---

# 2. Scope do MVP 1

## Incluído

### Discovery
- Hoje
- Amanhã
- Fim de semana
- Acontecendo agora
- Perto de mim
- Gratuitos
- Categoria
- Busca textual

### Página de evento
- título;
- descrição;
- categoria;
- data/hora;
- local;
- bairro/endereço;
- distância, quando houver localização;
- preço;
- gratuidade;
- classificação indicativa, quando disponível;
- acessibilidade, quando disponível;
- imagem;
- fonte(s);
- status;
- última verificação;
- link oficial / ingresso;
- compartilhar;
- como chegar.

### Data platform
- Source Registry
- Raw Event Store
- validação
- normalização
- enriquecimento
- deduplicação
- quality score
- ranking básico
- provenance

### Admin mínimo
- eventos;
- fontes;
- falhas de ingestão;
- candidatos a duplicata;
- revisão manual;
- saúde dos collectors.

---

# 3. Explicitamente fora do MVP

Não construir no MVP 1:

- app iOS nativo;
- app Android nativo;
- ticketing próprio;
- checkout;
- pagamentos;
- rede social;
- amigos;
- comentários/reviews;
- gamificação;
- recomendação por IA;
- chatbot;
- produtor self-service completo;
- campanhas;
- CULT Pro completo;
- CULT Data comercial;
- API pública para terceiros;
- push avançado;
- newsletter;
- marketplace;
- programa de fidelidade.

---

# 4. Fontes iniciais

## 4.1 Ticketmaster

**Tipo:** API  
**Papel:** primeira integração estruturada e prova da arquitetura de connector.

## 4.2 Destino POA

**Tipo:** API se disponível; caso contrário scraper estruturado.  
**Papel:** cobertura cultural local.

## 4.3 Prefeitura de Porto Alegre / agenda oficial

**Tipo:** crawler/feed/API conforme a fonte específica.  
**Papel:** programação pública e institucional.

---

# 5. Source Registry

Toda fonte deve possuir uma definição centralizada.

```ts
export type SourceType = "api" | "crawler" | "feed" | "manual";

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;

  enabled: boolean;
  pollingIntervalMinutes: number;

  authorityScore: number; // 0..1

  commercialUse: "allowed" | "restricted" | "unknown";

  connector: string;

  termsUrl?: string;
  notes?: string;
}
```

Requisitos:
- configuração nunca espalhada no código;
- cada connector usa um `sourceId`;
- `enabled=false` interrompe coleta sem remover dados;
- termos/licenças devem ser documentados;
- secrets nunca aparecem no frontend.

---

# 6. Arquitetura

## Estilo

- Modular Monolith
- Hexagonal Architecture / Ports & Adapters
- pipeline assíncrono de ingestão
- monorepo privado
- API REST
- Web/PWA

## Visão

```text
EXTERNAL SOURCES
Ticketmaster / Destino POA / Prefeitura
          ↓
SOURCE ADAPTERS
          ↓
RAW EVENT STORE
          ↓
VALIDATION
          ↓
NORMALIZATION
          ↓
ENRICHMENT
          ↓
DEDUPLICATION
          ↓
QUALITY SCORE
          ↓
CANONICAL EVENT DB
          ↓
RANKING
          ↓
PRIVATE API
          ↓
WEB / PWA
```

---

# 7. Estrutura do monorepo

```text
cult/

├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── packages/
│   ├── domain/
│   ├── database/
│   ├── connectors/
│   ├── canonical-events/
│   ├── deduplication/
│   ├── ranking/
│   ├── config/
│   └── observability/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── product/
│   └── sources/
│
├── openapi/
│   └── cult-api.yaml
│
├── test-data/
│   └── golden-events/
│
├── CLAUDE.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
└── .env.example
```

---

# 8. Stack

## Linguagem
TypeScript, `strict: true`.

## Web
- Next.js
- React
- PWA
- SSR/SSG onde fizer sentido

## API
- Node.js
- Fastify
- REST
- JSON
- OpenAPI

## Persistência
- PostgreSQL
- PostGIS
- `pg_trgm`
- Drizzle ORM

## Mapa
- MapLibre
- OpenStreetMap

## Testes
- Vitest
- Playwright
- testes de contrato dos adapters
- Golden Dataset

## Observabilidade
MVP:
- logs estruturados;
- correlation/request ID;
- métricas básicas;
- health checks.

Evolução:
- OpenTelemetry.

---

# 9. Domain model

## 9.1 Event

```ts
export type EventStatus =
  | "scheduled"
  | "cancelled"
  | "postponed"
  | "rescheduled"
  | "completed";

export interface CanonicalEvent {
  id: string;
  slug: string;

  title: string;
  description?: string;

  categoryId?: string;
  subcategories: string[];

  status: EventStatus;

  occurrences: EventOccurrence[];

  venue?: Venue;
  organizer?: Organizer;
  performers: Performer[];

  price?: EventPrice;

  ageRating?: string;
  accessibility: string[];

  imageUrl?: string;
  ticketUrl?: string;
  canonicalUrl?: string;

  sources: EventSourceReference[];

  qualityScore: number;
  rankingScore: number;

  firstSeenAt: Date;
  lastSeenAt: Date;
  lastVerifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

## 9.2 EventOccurrence

```ts
export interface EventOccurrence {
  id: string;
  eventId: string;

  startsAt: Date;
  endsAt?: Date;

  timezone: "America/Sao_Paulo";

  status: EventStatus;
}
```

A ocorrência é entidade separada para suportar:
- exposições;
- peças recorrentes;
- festivais;
- múltiplas sessões;
- eventos com mudança de data.

## 9.3 Venue

```ts
export interface Venue {
  id: string;
  name: string;

  address?: string;
  neighborhood?: string;
  city: string;
  state: string;
  country: "BR";

  latitude?: number;
  longitude?: number;
}
```

## 9.4 Source reference

```ts
export interface EventSourceReference {
  sourceId: string;
  externalId?: string;
  url: string;

  firstSeenAt: Date;
  lastSeenAt: Date;
  lastVerifiedAt?: Date;

  confidence: number;
}
```

---

# 10. Raw Event Store

Nunca descartar o payload original.

Tabela mínima:

```text
raw_events

id
source_id
external_id
source_url
payload_json
content_hash
fetched_at
processing_status
processing_error
schema_version
```

Requisitos:
- payload bruto persistido antes da normalização;
- hash usado para detectar conteúdo inalterado;
- reprocessamento possível sem nova coleta;
- falha de normalização não remove o payload;
- `(source_id, external_id)` deve ser único quando existir `external_id`.

---

# 11. Event lifecycle

Eventos mudam.

Estados:
- `scheduled`
- `cancelled`
- `postponed`
- `rescheduled`
- `completed`

Mudança detectada deve atualizar o evento existente quando a identidade é preservada.

Exemplo:

```text
21:00 → 20:00
```

não cria outro evento.

Guardar histórico de mudanças relevantes posteriormente; no MVP pelo menos registrar:
- `updated_at`
- fonte
- valor anterior/nova observação em log de ingestão.

---

# 12. Deduplicação

## 12.1 Camada determinística

Verificar:
- source + external_id;
- canonical URL;
- ticket URL;
- venue + exact datetime;
- organizer + exact datetime quando confiável.

## 12.2 Camada probabilística

Comparar:
- título;
- venue;
- datetime;
- distância geográfica;
- performers.

## 12.3 Score inicial

Hipótese inicial:

```text
title_similarity   40%
venue_similarity   20%
datetime_score     20%
geo_score          10%
performer_score    10%
```

Faixas iniciais:
- `>= 0.95`: merge automático apenas se não houver conflito crítico;
- `0.80 .. 0.9499`: candidato a revisão;
- `< 0.80`: eventos distintos.

Os thresholds devem ser calibrados com dados reais.

---

# 13. Golden Dataset

Criar conjunto de regressão com 30–50 casos.

Tipos mínimos:
- show simples;
- teatro;
- exposição;
- evento gratuito;
- evento sem imagem;
- evento sem preço;
- evento recorrente;
- evento cancelado;
- evento remarcado;
- duplicata exata;
- duplicata com título diferente;
- venue grafado de forma diferente;
- artista grafado de forma diferente.

Objetivo:

```text
3 SourceEvents
      ↓
1 CanonicalEvent
```

quando forem o mesmo evento.

---

# 14. Data Quality Score

Score 0..1.

Fatores MVP:
- título;
- data;
- venue;
- geolocalização;
- descrição;
- preço;
- imagem;
- fonte oficial;
- múltiplas fontes.

Implementar de forma explicável, não ML.

Exemplo inicial:

```text
title            0.15
date             0.20
venue            0.15
geo              0.10
description      0.10
price            0.05
image            0.05
official_source  0.10
multiple_sources 0.10
```

A soma deve resultar em 1.0.

---

# 15. Ranking MVP

O ranking não pode ser `ORDER BY created_at`.

Score inicial:

```text
ranking_score =
  freshness_score      * 0.30 +
  quality_score        * 0.30 +
  source_confidence    * 0.20 +
  proximity_score      * 0.20
```

Sem personalização no MVP.

Critérios:
- eventos cancelados não aparecem em discovery normal;
- eventos expirados não aparecem em “Hoje”;
- eventos com baixa qualidade podem ser rebaixados;
- evento promovido não existe no MVP.

---

# 16. API

## Endpoints MVP

```http
GET /health
GET /ready

GET /v1/events
GET /v1/events/{slug}
GET /v1/categories
```

## Filtros de `/v1/events`

- `q`
- `category`
- `start`
- `end`
- `free`
- `lat`
- `lng`
- `radius`
- `status`
- `cursor`
- `limit`

## Exemplos

```http
GET /v1/events?free=true
```

```http
GET /v1/events?start=2026-08-29&end=2026-08-30
```

```http
GET /v1/events?lat=-30.0346&lng=-51.2177&radius=3000
```

## Paginação
Cursor-based.

---

# 17. Erros

Usar RFC 9457 / `application/problem+json`.

Exemplo:

```json
{
  "type": "/problems/invalid-radius",
  "title": "Invalid search radius",
  "status": 400,
  "detail": "radius must be between 1 and 50000",
  "instance": "/requests/01H..."
}
```

---

# 18. Web / PWA

## Regras

- mobile-first;
- funciona sem login;
- páginas de evento indexáveis;
- URL individual por evento;
- mapa lazy-loaded;
- interface principal também disponível em lista;
- acessibilidade desde o início;
- imagens responsivas;
- compartilhamento por link.

## Home MVP

Atalhos:
- Hoje
- Amanhã
- Fim de semana
- Agora
- Perto de mim
- Gratuitos

Busca:
- evento
- artista
- local

Categorias:
- Música
- Teatro
- Cinema
- Exposições
- Festas
- Feiras
- Literatura
- Oficinas

---

# 19. SEO

Cada página de evento:
- title;
- description;
- OpenGraph;
- canonical URL;
- Schema.org/Event;
- sitemap;
- status/indexação coerentes.

Evento expirado mantém URL, mas mostra claramente que terminou.

---

# 20. Localização e privacidade

- pedir permissão somente quando usuário acionar “Perto de mim”;
- não exigir localização para uso do site;
- não persistir coordenadas pessoais no MVP;
- usar apenas para a consulta corrente;
- documentar política de privacidade.

---

# 21. Analytics do produto

Eventos mínimos:

```text
page_view
event_view
search
filter_used
nearby_used
map_opened
share
ticket_click
maps_click
```

Não armazenar dado pessoal desnecessário.

---

# 22. Analytics de dados

Métricas mínimas:

```text
events_ingested_total{source}
source_errors_total{source}
normalization_failures_total{source}
duplicate_candidates_total
duplicates_merged_total
events_without_venue_total
events_without_geo_total
events_without_price_total
events_without_image_total
source_last_success_timestamp
```

---

# 23. Admin MVP

## Events
- lista;
- busca;
- status;
- quality score;
- sources;
- editar campos essenciais.

## Sources
- enabled;
- última execução;
- última execução bem-sucedida;
- quantidade coletada;
- erros.

## Duplicates
- Event A;
- Event B;
- scores;
- merge;
- keep separate.

## Failures
- source;
- raw event;
- erro;
- reprocessar.

---

# 24. Segurança

- repositório privado;
- backend credentials somente server-side;
- nenhuma API key secreta em `NEXT_PUBLIC_*`;
- validação de payload externo;
- limites de tamanho;
- timeouts;
- retry com backoff;
- rate limiting;
- SSRF protection para fetches derivados de fontes;
- sanitização de HTML externo;
- audit log para ações administrativas relevantes.

---

# 25. Jobs e resiliência

Cada connector deve suportar:

```text
timeout
retry
exponential backoff
jitter
rate limit
lock de execução
last_success_at
last_failure_at
```

Falhas devem ir para uma fila/tabela de reprocessamento.

No MVP não é obrigatório Kafka.

---

# 26. Ambientes

- local
- staging
- production

Regras:
- banco separado;
- secrets separados;
- staging com dados de teste quando possível;
- migrations automáticas somente com segurança e rollback definido.

---

# 27. CI/CD

Pull request deve executar:

```text
lint
typecheck
unit tests
integration tests
contract tests
migration check
build
```

Deploy somente após pipeline verde.

---

# 28. Test strategy

## Unit
- normalizers
- canonical mapping
- quality score
- ranking score
- dedup score

## Integration
- DB repositories
- PostGIS queries
- API routes
- worker pipeline

## Contract
- fixtures reais versionadas por connector
- detecção de breaking payloads

## E2E
Fluxos mínimos:

1. abrir home;
2. filtrar Hoje;
3. abrir evento;
4. compartilhar;
5. abrir ingresso;
6. usar Perto de mim.

---

# 29. Definition of Done

Uma feature só está pronta quando:
- código em TypeScript strict;
- teste adequado criado;
- erro tratado;
- logs mínimos adicionados;
- documentação atualizada;
- contrato OpenAPI atualizado quando necessário;
- sem segredo exposto;
- comportamento mobile validado;
- acessibilidade básica validada;
- revisão aprovada.

---

# 30. Milestones

## M0 — Foundation
- monorepo
- pnpm
- TypeScript
- lint
- formatter
- Vitest
- Docker
- PostgreSQL/PostGIS
- CI

## M1 — Domain
- entities
- ports
- source registry
- raw event
- canonical event

## M2 — Ticketmaster vertical slice
Objetivo:

```text
Ticketmaster
    ↓
RawEvent
    ↓
Normalizer
    ↓
CanonicalEvent
    ↓
PostgreSQL
    ↓
GET /v1/events
```

## M3 — Destino POA
Adicionar segundo connector.

## M4 — Prefeitura POA
Adicionar terceiro connector.

## M5 — Deduplication
Unificar múltiplas representações.

## M6 — Discovery API
Filtros + busca + proximidade.

## M7 — Web/PWA
Home + list + event page + map.

## M8 — Admin
Sources + duplicates + failures.

## M9 — Staging / beta
Usuários reais.

---

# 31. Critérios de sucesso técnico do MVP

- três fontes funcionando;
- ingestão idempotente;
- raw payload preservado;
- provenance presente em 100% dos eventos;
- falha de uma fonte não impede outras;
- deduplicação funcional;
- consulta por proximidade via PostGIS;
- API documentada;
- Web mobile-first;
- E2E do principal funil verde;
- staging funcional.

---

# 32. Critérios de sucesso do produto

Medir:
- taxa de event detail;
- search-to-event-view;
- share rate;
- ticket click rate;
- maps click rate;
- retorno em 7 dias;
- uso de “Hoje”, “Fim de semana”, “Perto de mim” e “Grátis”.

---

# 33. Primeira instrução de implementação para Claude Code

> Implemente somente o Milestone M0. Não avance para M1. Crie o monorepo privado do CULT com pnpm workspaces, TypeScript strict, apps `api`, `web` e `worker`, packages vazios conforme a especificação, lint, formatter, Vitest, Docker Compose com PostgreSQL + PostGIS, scripts de desenvolvimento e CI. Não implemente domínio, connectors ou UI de produto ainda. Ao final, rode lint, typecheck, testes e builds e documente quaisquer decisões novas em ADR antes de adotá-las.
