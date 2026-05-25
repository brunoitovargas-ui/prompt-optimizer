# Arquitetura — Prompt Cost Optimizer

## Visão geral

```mermaid
flowchart TB
    User(("👤<br/>Usuário"))

    subgraph aws["☁️ AWS us-east-1"]
        direction TB

        subgraph hosting["Camada de apresentação"]
            Amplify["<b>Amplify Hosting</b><br/>main.d2bi1xssyw0yo0.amplifyapp.com<br/>━━━━━━━━━━<br/>React 18 + Vite + Tailwind v4<br/>CDN global · HTTPS<br/>auto-deploy via GitHub"]
        end

        subgraph edge["Camada de borda"]
            FuncURL["<b>Lambda Function URL</b><br/>qnerz25...lambda-url.us-east-1<br/>━━━━━━━━━━<br/>AuthType NONE<br/>CORS allowlist (Amplify + localhost)<br/>Cap 10 concurrent · Timeout 30s"]
        end

        subgraph compute["Camada de aplicação · Lambda Node 20"]
            Handler["<b>handler.js</b><br/>━━━━━━━━━━<br/>① checkOrigin (allowlist)<br/>② validate input (length, model, tokens)<br/>③ countInputTokens (gate de custo)<br/>④ runPipeline<br/>⑤ logEvent JSON sem PII"]

            subgraph pipeline["Pipeline"]
                direction LR
                Step1["<b>analyzeNeed</b><br/>Haiku 4.5<br/>━━━<br/>precisa LLM?<br/>qual modelo basta?"]
                Step2["<b>refinePrompt</b><br/>Sonnet 4.6<br/>━━━<br/>reescreve<br/>+ maxTokens<br/>+ outputFormat"]
                Step3["<b>computeSavings</b><br/>puro<br/>━━━<br/>economia composta<br/>verdict"]

                Step1 -- "shortCircuit<br/>(não-LLM)" --> Step3
                Step1 -- "ok" --> Step2
                Step2 --> Step3
                Step1 -. "skip refine<br/>(prompt enxuto)" .-> Step3
            end

            Handler --> Step1
        end

        subgraph secrets["Segredos"]
            SSM[("<b>SSM Parameter Store</b><br/>/prompt-optimizer/anthropic-api-key<br/>SecureString · KMS")]
        end

        subgraph obs["Observabilidade"]
            CW[("<b>CloudWatch Logs</b><br/>/aws/lambda/prompt-optimizer<br/>JSON estruturado")]
            Budget["<b>AWS Budget</b><br/>$5/mês<br/>alerta 80% e 100%"]
        end
    end

    subgraph external["🌐 Externo"]
        Anthropic[("<b>Anthropic API</b><br/>api.anthropic.com (EUA)<br/>━━━━━━━<br/>Haiku · Sonnet<br/>spend limit configurado")]
        GitHub[("<b>GitHub</b><br/>brunoitovargas-ui/prompt-optimizer")]
    end

    User -- "HTTPS<br/>GET /" --> Amplify
    Amplify -- "HTTPS POST<br/>Origin allowed" --> FuncURL
    FuncURL --> Handler
    Handler -. "cold start<br/>GetParameter" .-> SSM
    Step1 -. "/v1/messages<br/>count_tokens" .-> Anthropic
    Step2 -. "/v1/messages" .-> Anthropic
    Handler --> CW
    Budget -. "email alert" .-> User
    GitHub -- "push trigger" --> Amplify

    classDef awsSvc fill:#FF9900,stroke:#232F3E,color:#000,stroke-width:1px
    classDef external fill:#7C5CFF,stroke:#000,color:#fff,stroke-width:1px
    classDef user fill:#10B981,stroke:#000,color:#fff,stroke-width:2px
    classDef secret fill:#DC2626,stroke:#000,color:#fff,stroke-width:1px

    class Amplify,FuncURL,Handler,Step1,Step2,Step3,CW,Budget awsSvc
    class Anthropic,GitHub external
    class User user
    class SSM secret
```

## Fluxo crítico de uma requisição

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 Usuário
    participant F as Frontend (Amplify)
    participant L as Lambda
    participant S as SSM
    participant A as Anthropic

    U->>F: Cola prompt, escolhe modelo, clica Otimizar
    F->>L: POST /optimize<br/>Origin: amplifyapp.com
    Note over L: checkOrigin · validate (length ≤ 20k, tokens ≤ 8k)
    L->>A: count_tokens (grátis)
    A-->>L: originalInputTokens
    opt cold start
        L->>S: GetParameter (api-key)
        S-->>L: SecureString
    end
    L->>A: analyzeNeed (Haiku) — ~2-5s
    A-->>L: { recommendation, modelChoice }
    alt recomendação ≠ LLM ou prompt enxuto
        Note over L: pula refinePrompt
    else otimização compensa
        L->>A: refinePrompt (Sonnet) — ~3-8s
        A-->>L: { prompt, maxTokens, outputFormat }
    end
    Note over L: computeSavings (puro)
    L-->>F: { data: { savings, refined, ... } }
    Note over L: logEvent JSON sem prompt
    F->>U: Renderiza verdict, economia, prompt reescrito
```

## Pipeline de deploy

```mermaid
flowchart LR
    Dev["💻 Dev local"]
    GH["GitHub<br/>brunoitovargas-ui/prompt-optimizer"]
    Amp["Amplify Hosting"]
    PS["deploy-backend.ps1"]
    Lambda["Lambda<br/>prompt-optimizer"]

    Dev -- "git push main" --> GH
    GH -- "webhook" --> Amp
    Amp -- "npm run build<br/>publica /dist" --> Amp
    Dev -- "manual" --> PS
    PS -- "npm install --omit=dev<br/>zip + update-function-code" --> Lambda

    classDef awsSvc fill:#FF9900,stroke:#232F3E,color:#000
    classDef external fill:#7C5CFF,stroke:#000,color:#fff
    classDef tool fill:#374151,stroke:#000,color:#fff

    class Amp,Lambda awsSvc
    class GH external
    class Dev,PS tool
```

## Camadas em uma linha

| Camada | Tecnologia | Função |
|---|---|---|
| Apresentação | Amplify Hosting + React/Vite | UI, validação client-side, CDN global |
| Borda | Lambda Function URL + CORS | Endpoint público, CORS + origin allowlist |
| Aplicação | Lambda Node 20 | Pipeline de otimização, validação, logging |
| Segredo | SSM Parameter Store | Chave Anthropic encriptada em repouso |
| LLM | Anthropic API | Análise + reescrita do prompt |
| Observabilidade | CloudWatch + Budgets | Logs JSON e alerta de custo |
| CI/CD | GitHub + Amplify auto-build + PS scripts | Push dispara frontend; backend manual |

## Imagens renderizadas

| Diagrama | Arquivo |
|---|---|
| Arquitetura completa | [`architecture-1.png`](./architecture-1.png) |
| Fluxo de requisição | [`architecture-2.png`](./architecture-2.png) |
| Pipeline de deploy | [`architecture-3.png`](./architecture-3.png) |

## Como regenerar

```powershell
npx -y @mermaid-js/mermaid-cli@latest -i docs/architecture.md -o docs/architecture.png -b transparent
```

## Como visualizar

- **No GitHub**: este arquivo renderiza automaticamente os diagramas Mermaid — abre `docs/architecture.md` no repositório.
- **VSCode**: instale a extensão "Markdown Preview Mermaid Support".
- **Online**: cola o bloco mermaid em https://mermaid.live e exporta SVG/PNG.
