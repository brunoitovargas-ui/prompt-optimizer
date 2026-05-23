# Prompt Cost Optimizer

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS v4
- Backend: Node.js 20 para AWS Lambda Function URL
- LLM: Anthropic API (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7)
- Infra: AWS (Lambda, S3, CloudFront, Parameter Store)

## Arquitetura

### Princípios
1. Pipeline é uma sequência de steps composáveis
2. Cada step é uma função: (state) => updatedState (enriquece, não muta)
3. Nunca usar tiktoken para Claude — sempre /v1/messages/count_tokens
4. Todas as chamadas Anthropic passam pelo cliente em /backend/lib/anthropicClient.js
5. API key SEMPRE vem de process.env, nunca hardcoded
6. Frontend nunca chama Anthropic diretamente
7. Otimização para one-shot: nada que dependa de repetição (sem cache hash, 
   sem cache semântico, sem prompt caching da Anthropic)
8. Usuário declara o modelo original — sem inferência

### Pipeline v1 (one-shot)
1. analyzeNeed — Haiku: precisa de LLM? Se sim, qual o menor modelo Anthropic suficiente?
2. refinePrompt — Sonnet: reescreve prompt + max_tokens + formato eficiente
3. computeSavings — puro: economia composta + verdict de viabilidade

Tokens do prompt original são contados upfront via /v1/messages/count_tokens
(gratuito) e ficam em state.originalInputTokens para reuso.

### Curto-circuito
- Se analyzeNeed retorna recommendation !== 'llm' com confidence > 0.75,
  pula refinePrompt. Vai direto pro computeSavings.
- Se o modelo sugerido === modelo original E originalInputTokens <= 30,
  pula refinePrompt (não há slack suficiente para o Sonnet pagar a si próprio).

### Pipeline futura (não implementar)
- cacheCheck, verifyQuality, cacheStore

## Estrutura de pastas
/frontend
  /src
    /components   (PromptInput, ModelSelector, IntentInput, ResultPanel, etc.)
    /lib          (api.js)
    App.tsx, main.tsx
/backend
  /steps          (analyzeNeed.js, refinePrompt.js, computeSavings.js)
  /lib            (anthropicClient.js, tokenCounter.js, modelCatalog.js)
  handler.js      (orquestrador para Lambda)
  dev-server.js   (Express local na porta 3001)
  .env.example
/infra
  (scripts de deploy AWS — adicionar depois)

## Convenções
- TypeScript no frontend, JavaScript no backend
- Erros do backend: { error: { code, message } }
- Sucesso: { data: state }
- Componentes React em PascalCase, arquivos JS em camelCase
- Steps são async functions exportadas como default

## Modelos e preços (atualizar quando mudar)
- claude-haiku-4-5:  $0.80 input / $4.00  output por 1M tokens
- claude-sonnet-4-6: $3.00 input / $15.00 output por 1M tokens
- claude-opus-4-7:   $15.00 input / $75.00 output por 1M tokens

## Verdict do computeSavings
- recommended: redução por execução ≥ 3× custo do otimizador
- borderline: paga em 2–5 execuções
- not_worth: paga em > 5 execuções