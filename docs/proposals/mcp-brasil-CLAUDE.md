# mcp-brasil

Servidor MCP (Model Context Protocol) que expõe dados públicos brasileiros
como ferramentas para Claude. Instalável no Claude Code via
`claude mcp add brasil npx mcp-brasil`. Roda local, sem AWS.

## Stack
- Linguagem: TypeScript (Node.js 20)
- Runtime SDK: @modelcontextprotocol/sdk
- HTTP cliente: `fetch` nativo
- Build/dev: tsx + tsup (para gerar binário)
- Test: vitest
- Distribuição: pacote npm público

## Arquitetura

### Princípios
1. Cada tool é **pura**: input → output, sem estado entre chamadas
2. Tools **nunca lançam exceção** — sempre retornam `{ ok: true, data }` ou
   `{ ok: false, error: { code, message, source } }`
3. **Schemas estritos** (JSON Schema) — Claude precisa de definição precisa
   para escolher a tool e preencher argumentos
4. Descrições das tools escritas **para LLM, não para humano** — primeira
   linha clara e curta importa mais que doc longa
5. **Cache in-memory por TTL** (default 1h) — APIs brasileiras são lentas
   e estáveis; cache melhora dev experience drasticamente
6. **Transport stdio** como default (para Claude Code); HTTP opcional para
   futuro deploy serverless
7. **Zero dependências runtime** além do SDK MCP — instalação via `npx` é
   feature, não detalhe; dependências grandes quebram isso
8. Versionar o **pacote inteiro**, não tool por tool — semver no package.json

### Tools v1
| Tool | Fonte | TTL cache |
|---|---|---|
| `cep_lookup` | brasilapi.com.br/api/cep/v2/{cep} | 24h |
| `cnpj_lookup` | brasilapi.com.br/api/cnpj/v1/{cnpj} | 1h |
| `bank_search` | brasilapi.com.br/api/banks/v1 | 24h |
| `holiday_list` | brasilapi.com.br/api/feriados/v1/{ano} | 24h |
| `municipality_list` | brasilapi.com.br/api/ibge/municipios/v1/{uf} | 24h |
| `tax_rates` | brasilapi.com.br/api/taxas/v1 | 1h |
| `cep_distance` | composto (2× cep_lookup + haversine) | derivado |

### Não entram na v1
- Câmara dos Deputados (API mais lenta, design diferente, merece v2)
- Receita Federal direta (CAPTCHA, scraping — proibido por ToS)
- Serasa/Score (dados sensíveis — never)
- Coisas que dependem de auth do usuário

## Estrutura de pastas
```
/src
  index.ts              # entrypoint stdio (shebang #!/usr/bin/env node)
  server.ts             # configura MCP server + registra tools
  /tools
    cep.ts
    cnpj.ts
    bank.ts
    holiday.ts
    municipality.ts
    tax.ts
  /lib
    cache.ts            # TTL cache in-memory
    brasilapi.ts        # cliente HTTP base
    schemas.ts          # tipos compartilhados
/test
  /tools (vitest, mockando fetch)
package.json            # bin field aponta para dist/index.js
tsconfig.json
README.md
```

## Convenções

### Tool module shape
Cada arquivo em `/src/tools` exporta default:
```ts
export default {
  definition: {
    name: 'cep_lookup',
    description: 'Busca endereço por CEP brasileiro. Retorna estado, cidade, bairro, logradouro.',
    inputSchema: { /* JSON Schema */ },
  },
  handler: async (input) => ({ ok: true, data: { ... } }),
};
```

### Resposta padrão
```ts
type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; source?: string } };
```

### Erro
- `code`: enum curto (`'invalid_input'`, `'not_found'`, `'upstream_error'`, `'rate_limited'`)
- `message`: descrição humana curta
- `source`: opcional, qual upstream falhou ('brasilapi', etc.)

## Cache
- Armazenamento: `Map<string, { value, expiresAt }>`
- Chave: `<toolName>:<JSON.stringify(input)>`
- TTL padrão definido por tool (ver tabela acima)
- Não persiste entre restarts (intencional)
- Sem invalidação manual no v1 — restart é solução

## Build e distribuição
- `tsup` gera `dist/index.js` com shebang preservado
- `package.json`:
  ```json
  {
    "bin": { "mcp-brasil": "./dist/index.js" },
    "files": ["dist"],
    "engines": { "node": ">=20" }
  }
  ```
- Publicar com `npm publish --access public`

## Como o usuário instala (README aponta isso)
```
claude mcp add brasil npx mcp-brasil
```

A partir daí, dentro do Claude Code:
> "qual cidade do CEP 01310-100?"
> Claude chama `cep_lookup` → responde "Bela Vista, São Paulo/SP".

## Restrições deliberadas (v1)
- **Sem HTTP transport** — só stdio (suficiente para Claude Code, e mais
  simples). HTTP entra no v2 se houver demanda real.
- **Sem auth** — todas as APIs são públicas, sem rate limit pessoal
- **Sem logging persistente** — apenas `console.error` para debugging local
  (stdio transport reserva stdout para o protocolo)
- **Sem telemetria** — privacidade primeiro

## Próximos passos depois do v1 funcionar
- Tools adicionais: Câmara dos Deputados, Senado, Banco Central séries SGS
- HTTP transport para hospedar no Lambda Function URL (reuso do que
  aprendemos no prompt-optimizer)
- Tool composta com IA: `analisar_cnpj` que combina cnpj_lookup + dados
  abertos de licitações + parece um relatório

## Não-objetivos (explícitos)
- Não é um wrapper genérico para APIs brasileiras — só dados públicos úteis
  em conversa com Claude
- Não substitui SDKs oficiais — quem quer scraping pesado usa libs próprias
- Não promete uptime ou SLA — depende do BrasilAPI estar de pé
