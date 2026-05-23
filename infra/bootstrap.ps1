# Cria os recursos AWS uma única vez. Requer AWS CLI logado.
# Antes: copie config.example.ps1 para config.ps1 e preencha; coloque a API key no Parameter Store:
#   aws ssm put-parameter --name /prompt-optimizer/anthropic-api-key --type SecureString --value sk-ant-...

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\config.ps1"

Write-Host "==> Criando role $($Config.LambdaRoleName)..."
aws iam create-role `
  --role-name $Config.LambdaRoleName `
  --assume-role-policy-document file://$PSScriptRoot/lambda-trust-policy.json | Out-Null

Write-Host "==> Anexando permissões..."
aws iam put-role-policy `
  --role-name $Config.LambdaRoleName `
  --policy-name "$($Config.LambdaRoleName)-inline" `
  --policy-document file://$PSScriptRoot/lambda-permissions.json

Write-Host "==> Aguardando propagação da role (10s)..."
Start-Sleep -Seconds 10

$accountId = (aws sts get-caller-identity --query Account --output text)
$roleArn = "arn:aws:iam::${accountId}:role/$($Config.LambdaRoleName)"

Push-Location "$PSScriptRoot\..\backend"
try {
  Write-Host "==> Empacotando backend..."
  if (Test-Path lambda.zip) { Remove-Item lambda.zip }
  Compress-Archive -Path *.js, steps, lib, node_modules, package.json -DestinationPath lambda.zip

  Write-Host "==> Criando função Lambda $($Config.LambdaName)..."
  aws lambda create-function `
    --function-name $Config.LambdaName `
    --runtime nodejs20.x `
    --role $roleArn `
    --handler handler.handler `
    --zip-file fileb://lambda.zip `
    --timeout 60 `
    --memory-size 512 `
    --region $Config.AwsRegion `
    --environment "Variables={ANTHROPIC_PARAMETER_NAME=$($Config.ParameterName)}" | Out-Null

  Write-Host "==> Criando Function URL..."
  $url = aws lambda create-function-url-config `
    --function-name $Config.LambdaName `
    --auth-type NONE `
    --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' `
    --region $Config.AwsRegion `
    --query FunctionUrl --output text

  aws lambda add-permission `
    --function-name $Config.LambdaName `
    --statement-id FunctionURLAllowPublic `
    --action lambda:InvokeFunctionUrl `
    --principal '*' `
    --function-url-auth-type NONE `
    --region $Config.AwsRegion | Out-Null

  Write-Host ""
  Write-Host "Lambda Function URL: $url"
  Write-Host "Configure VITE_API_URL=$url no frontend antes de buildar."
}
finally {
  Pop-Location
}
