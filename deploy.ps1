# Deploy a produccion en Vercel (cuenta rentalholidayses-5222)
# Uso: .\deploy.ps1
# Requiere: $env:VERCEL_TOKEN configurado (no hardcodear el token)

$TOKEN = $env:VERCEL_TOKEN
$SCOPE = "rentalholidayses-5222s-projects"

if (-not $TOKEN) {
  Write-Host "ERROR: define VERCEL_TOKEN antes de ejecutar" -ForegroundColor Red
  exit 1
}

Write-Host "Desplegando en produccion..." -ForegroundColor Cyan
npx vercel --prod --scope $SCOPE --token $TOKEN --yes

Write-Host ""
Write-Host "Despliegue completado. URL de produccion:" -ForegroundColor Green
Write-Host "  https://base-datos-pagos-rh-xi.vercel.app" -ForegroundColor Yellow
