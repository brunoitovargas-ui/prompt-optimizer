# Recibo Reader

App pessoal de gestão de gastos: usuário tira foto de uma nota fiscal/recibo,
Claude extrai estrutura (data, estabelecimento, itens, valores, total,
categoria), salva, e mostra dashboard de gastos por mês/categoria.

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS v4 (PWA via vite-plugin-pwa)
- Backend: Node.js 20 em AWS Lambda
- Storage: S3 (imagens) + DynamoDB (metadados estruturados)
- LLM: Anthropic API (claude-sonnet-4-6 com Vision)
- Infra: AWS (Lambda, S3, DynamoDB, Amplify Hosting, Parameter Store)

## Arquitetura

### Princípios
1. Imagem **nunca** passa pelo Lambda — frontend faz PUT direto no S3 via
   presigned URL gerada pelo backend
2. Receipt id é hash SHA-256 da imagem → idempotência: re-upload da mesma
   foto não duplica registro
3. Persistência separada: blobs no S3, estrutura no DynamoDB; nada de
   serializar JPEG em base64 em colunas
4. Categorias **fechadas** no backend (lista fixa) para evitar fragmentação
   livre tipo "Comida/Alimentação/Restaurante"
5. Vision API: passar imagem como base64 inline se < 5MB; senão como URL S3
6. DynamoDB single-table design — uma tabela `receipts`, GSI para queries
   por categoria
7. Pipeline composável como no prompt-optimizer (steps async puros)
8. Sem login no MVP — userId fixo "me"; adicionar Cognito depois se virar
   multi-usuário

### Pipeline
1. **requestUpload** — `POST /uploads`: backend gera presigned PUT URL +
   receiptId provisório. Frontend faz PUT direto no S3.
2. **extractReceipt** — `POST /receipts/{id}/extract`: backend lê imagem,
   chama Sonnet com tool `extract_receipt`, recebe JSON estruturado.
3. **saveReceipt** — gravação no DynamoDB com pk/sk + GSI.
4. **listReceipts / summarize** — queries do frontend para dashboard.

### Tool `extract_receipt` (schema do Sonnet)
```
{
  date: string (ISO),
  merchant: string,
  total: number,
  currency: 'BRL',
  category: enum (lista fechada — ver abaixo),
  items: [{ name, qty, unitPrice, total }],
  confidence: number (0..1),
  notes?: string (algo ilegível, valor estimado, etc.)
}
```

### Categorias (MVP, fixas)
`alimentacao` · `transporte` · `moradia` · `saude` · `lazer` · `vestuario`
`educacao` · `servicos` · `outros`

### DynamoDB schema (single-table)
- **pk**: `USER#<userId>`
- **sk**: `RECEIPT#<isoDate>#<receiptId>`
- attrs: `merchant`, `total`, `category`, `items`, `imageKey`, `confidence`
- **GSI1**: pk=`USER#<u>#CAT#<category>`, sk=`<isoDate>` (para filtro por
  categoria em ordem cronológica)

## Estrutura de pastas
```
/frontend
  /src
    /components  (PhotoCapture, ReceiptList, Dashboard, CategoryChart)
    /lib         (api.ts, presignedUpload.ts)
    /pwa         (manifest, service worker)
    App.tsx, main.tsx
/backend
  /steps         (extractReceipt.js, saveReceipt.js, listReceipts.js, summarize.js)
  /lib           (anthropicClient.js, s3Client.js, dynamoClient.js, modelCatalog.js)
  handlers       (handler-extract.js, handler-list.js, handler-presign.js)
  dev-server.js
/infra
  scripts AWS (criar bucket, table, GSI, IAM policies, etc.)
```

## Convenções
- TypeScript no frontend, JavaScript no backend (consistência com projeto anterior)
- Erros: `{ error: { code, message } }`. Sucesso: `{ data }`.
- Componentes React em PascalCase, arquivos JS em camelCase
- Steps são async functions exportadas como default
- Imagens no S3 com chave `receipts/<userId>/<receiptId>.jpg`
- Datas sempre ISO 8601 UTC; o frontend converte para timezone do user na
  exibição

## Modelos e preços
Reuso do `modelCatalog.js` do prompt-optimizer (haiku/sonnet/opus 4.x).
Vision usa **sonnet-4-6** por padrão; haiku-4-5 vale testar para recibos
simples (postos de gasolina, supermercado pequeno).

## Restrições deliberadas (MVP)
- Single user (sem auth) — adicionar Cognito como segundo passo
- Sem OCR fallback — se Vision falhar com baixa confidence, mostra para o
  usuário corrigir manualmente
- Sem export contábil (CSV/OFX) no MVP — adicionar depois
- Sem categoria custom — só as 9 fixas

## Próximos passos depois do MVP funcionar
- Cognito para multi-usuário
- Auto-categorização aprendendo do histórico (few-shot no system prompt)
- Export CSV mensal
- Alerta de gasto acima do orçamento por categoria
- Reconhecimento de NFC-e via QR code (sem precisar de Vision)
