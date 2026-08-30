#!/bin/zsh

set -e

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required to run ContractLedger AI."
  echo "Press Return to close this window."
  read -r
  exit 1
fi

(
  sleep 2
  open "http://127.0.0.1:3000/"
) &

echo "Starting ContractLedger AI at http://127.0.0.1:3000/"
echo "Keep this window open during the interview. Press Control-C to stop."
echo

npm run dev -- --host 127.0.0.1
