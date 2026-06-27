#!/usr/bin/env bash
set -e
PROJECT_ID="$1"
TOKEN="$2"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy_firebase.sh <PROJECT_ID> [FIREBASE_TOKEN]"
  echo "You can also set the FIREBASE_TOKEN environment variable."
  exit 1
fi

# prefer explicit token arg, else environment
if [ -z "$TOKEN" ]; then
  TOKEN="${FIREBASE_TOKEN:-}"
fi

# If a CI token is provided, run non-interactive deploy using npx
if [ -n "$TOKEN" ]; then
  npx --yes firebase-tools deploy --only hosting --project "$PROJECT_ID" --token "$TOKEN"
else
  # fallback to interactive deploy using installed firebase CLI
  if ! command -v firebase >/dev/null 2>&1; then
    echo "firebase CLI not found; installing firebase-tools globally..."
    npm install -g firebase-tools
  fi
  firebase login
  firebase use --add "$PROJECT_ID"
  firebase deploy --only hosting --project "$PROJECT_ID"
fi
