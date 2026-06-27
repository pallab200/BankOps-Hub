Param(
  [string]$ProjectId,
  [string]$Token
)

if (-not $ProjectId) {
  Write-Host "Usage: .\deploy_firebase.ps1 <PROJECT_ID> [FIREBASE_TOKEN]"
  Write-Host "Or set the FIREBASE_TOKEN environment variable."
  exit 1
}

if (-not $Token) {
  $Token = $env:FIREBASE_TOKEN
}

if ($Token) {
  npx --yes firebase-tools deploy --only hosting --project $ProjectId --token $Token
} else {
  if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "firebase CLI not found. Installing firebase-tools globally..."
    npm install -g firebase-tools
  }
  firebase login
  firebase use --add $ProjectId
  firebase deploy --only hosting --project $ProjectId
}
