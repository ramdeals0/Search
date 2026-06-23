# Deploy Prisma migrations + Fleet Farm seed on Railway.
# Uses the Postgres public proxy URL for local CLI access (Railway internal URLs only work in-cloud).
#
# Prerequisites:
#   npx @railway/cli login
#   cd <repo-root> && npx @railway/cli link -p hospitable-bravery -s Search
#
# Usage (from services/search-api):
#   .\scripts\railway-deploy-db.ps1
#   .\scripts\railway-deploy-db.ps1 -SeedOnly
#   .\scripts\railway-deploy-db.ps1 -SkipResolve

param(
  [switch]$SeedOnly,
  [switch]$SkipResolve
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$envBackup = Join-Path $root ".env.railway-deploy-bak"
if (Test-Path ".env") {
  Move-Item ".env" $envBackup -Force
  Write-Host "Temporarily moved .env aside."
}

function Get-RailwayPublicDatabaseUrl {
  $raw = npx @railway/cli run --service Postgres node -e "console.log(process.env.DATABASE_PUBLIC_URL)" 2>&1
  $line = ($raw | Where-Object { $_ -match "^postgresql://" } | Select-Object -First 1)
  if (-not $line) {
    throw "Could not read DATABASE_PUBLIC_URL from Railway Postgres service."
  }
  return $line.Trim()
}

try {
  $env:DATABASE_URL = Get-RailwayPublicDatabaseUrl
  Write-Host "Using Railway Postgres public proxy for local CLI."

  if (-not $SeedOnly) {
    if (-not $SkipResolve) {
      Write-Host "Marking failed tier1 migration as rolled back..."
      npx prisma migrate resolve --rolled-back 20260610120000_tier1_tier2_search_platform
    }

    Write-Host "Applying migrations..."
    npx prisma migrate deploy
  }

  Write-Host "Seeding Fleet Farm catalog (30k products + platform tables)..."
  $env:TARGET_PRODUCT_COUNT = "30000"
  $env:CATALOG_THEME = "fleet-farm"
  npx prisma db seed

  Write-Host ""
  Write-Host "Success. Redeploy the Search service on Railway:"
  Write-Host "  npx @railway/cli redeploy -s Search -y"
}
finally {
  if (Test-Path $envBackup) {
    Move-Item $envBackup ".env" -Force
    Write-Host "Restored local .env"
  }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
