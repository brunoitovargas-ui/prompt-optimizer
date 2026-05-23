# Buildá frontend e sincroniza com S3 + invalida CloudFront.
# Defina $env:VITE_API_URL antes (Function URL da Lambda).
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\config.ps1"

if (-not $env:VITE_API_URL) {
  throw 'VITE_API_URL não definida. Exporte com a Function URL da Lambda antes de buildar.'
}

Push-Location "$PSScriptRoot\..\frontend"
try {
  Write-Host "==> Build do frontend..."
  npm run build

  Write-Host "==> Sincronizando S3 ($($Config.FrontendBucket))..."
  aws s3 sync dist/ "s3://$($Config.FrontendBucket)/" --delete --region $Config.AwsRegion

  Write-Host "==> Invalidando CloudFront ($($Config.CloudFrontDistId))..."
  aws cloudfront create-invalidation `
    --distribution-id $Config.CloudFrontDistId `
    --paths '/*' | Out-Null

  Write-Host "Done."
}
finally {
  Pop-Location
}
