# Copie para config.ps1 e ajuste os valores.
# config.ps1 NÃO deve ser commitado.

$Config = @{
  AwsRegion          = 'us-east-1'
  LambdaName         = 'prompt-optimizer'
  LambdaRoleName     = 'prompt-optimizer-role'
  ParameterName      = '/prompt-optimizer/anthropic-api-key'
  FrontendBucket     = 'prompt-optimizer-frontend-CHANGE-ME'
  CloudFrontDistId   = 'CHANGE-ME'
}
