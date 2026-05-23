# Infra AWS

## Pré-requisitos

- AWS CLI configurada (`aws configure`) com credenciais que possam criar IAM, Lambda, S3, CloudFront, SSM.
- Bucket S3 já criado para o frontend (ou crie via console — esta pasta não automatiza isso por causa do certificado CloudFront).
- Distribuição CloudFront apontando para esse bucket.
- Parâmetro SSM com a API key:

  ```powershell
  aws ssm put-parameter `
    --name /prompt-optimizer/anthropic-api-key `
    --type SecureString `
    --value sk-ant-...
  ```

## Setup

1. Copie `config.example.ps1` para `config.ps1` e preencha (nome do bucket, ID da distribuição).
2. Garanta que `backend/node_modules` está instalado em modo produção:
   ```powershell
   cd backend; npm ci --omit=dev
   ```
3. Rode o bootstrap (uma vez):
   ```powershell
   .\infra\bootstrap.ps1
   ```
   Anote a Function URL que ele imprime.

## Deploys

- Backend:
  ```powershell
  .\infra\deploy-backend.ps1
  ```
- Frontend (passe a Function URL como `VITE_API_URL`):
  ```powershell
  $env:VITE_API_URL = 'https://xxxx.lambda-url.us-east-1.on.aws/'
  .\infra\deploy-frontend.ps1
  ```

## Notas

- A Lambda lê `ANTHROPIC_PARAMETER_NAME` (env var setada pelo bootstrap) e busca a key no SSM no cold start. Em dev local o `.env` com `ANTHROPIC_API_KEY` continua valendo.
- `config.ps1` está no `.gitignore` da pasta `infra`.
