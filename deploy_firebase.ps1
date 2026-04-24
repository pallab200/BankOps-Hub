Param(
  [string]$ProjectId
)
if (-not $ProjectId) {
  Write-Host "Usage: .\deploy_firebase.ps1 <PROJECT_ID>"
  exit 1
}
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  npm install -g firebase-tools
}
firebase login
firebase use --add $ProjectId
firebase deploy --only hosting --project $ProjectId
