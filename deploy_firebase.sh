#!/usr/bin/env bash
set -e
PROJECT_ID="$1"
if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy_firebase.sh <PROJECT_ID>"
  exit 1
fi
if ! command -v firebase >/dev/null 2>&1; then
  npm install -g firebase-tools
fi
firebase login
firebase use --add "$PROJECT_ID"
firebase deploy --only hosting --project "$PROJECT_ID"
