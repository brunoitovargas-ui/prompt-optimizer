# Re-empacota o backend e atualiza o código da Lambda.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\config.ps1"

Push-Location "$PSScriptRoot\..\backend"
try {
  Write-Host "==> Instalando deps de produção..."
  npm ci --omit=dev

  Write-Host "==> Empacotando..."
  if (Test-Path lambda.zip) { Remove-Item lambda.zip }
  Compress-Archive -Path *.js, steps, lib, node_modules, package.json -DestinationPath lambda.zip

  Write-Host "==> Atualizando Lambda $($Config.LambdaName)..."
  aws lambda update-function-code `
    --function-name $Config.LambdaName `
    --zip-file fileb://lambda.zip `
    --region $Config.AwsRegion | Out-Null

  Write-Host "Done."
}
finally {
  Pop-Location
}
