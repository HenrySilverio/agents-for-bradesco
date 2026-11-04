#!/usr/bin/env bash
# HenriSpec - instalador para Git Bash, Linux e macOS. Toda a lógica está em instalar.mjs.
#
#   bash <pasta-do-pacote>/instalar.sh repo [caminho] [--dry-run] [--forcar] [--sem-github]
#   bash <pasta-do-pacote>/instalar.sh global          [--dry-run] [--forcar]
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node 18+ não encontrado no PATH. O validador e o verificador do toolkit também precisam dele." >&2
  exit 2
fi

MAIOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAIOR" -lt 18 ]; then
  echo "Node $MAIOR encontrado; o toolkit precisa de 18 ou mais." >&2
  exit 2
fi

exec node "$AQUI/instalar.mjs" "$@"
