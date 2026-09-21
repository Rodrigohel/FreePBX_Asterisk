#!/usr/bin/env bash
# Gera um build ADICIONAL do frontend, num diretório à parte
# (frontend/dist-embed), pra embutir este painel via iframe dentro de outro
# sistema (ex.: um "Portal" que serve vários painéis sob /apps/*).
#
# NÃO mexe no build normal (frontend/dist, usado pelo update.sh) nem reinicia
# nenhum serviço — só gera arquivos estáticos num diretório separado.
#
# Uso, de dentro da pasta onde o projeto já está instalado (ex. /opt/pbx-dashboard):
#   ./build-embed.sh
#   BASE_PATH=/apps/outro-nome/ ./build-embed.sh   # pra mudar o subcaminho
set -euo pipefail

c_reset='\033[0m'; c_bold='\033[1m'; c_blue='\033[1;34m'; c_green='\033[1;32m'
log()  { echo -e "\n${c_blue}==>${c_reset} ${c_bold}$1${c_reset}"; }
info() { echo -e "    $1"; }
die()  { echo -e "\033[1;31m[erro]\033[0m $1" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$SCRIPT_DIR/frontend" ] || die "Rode este script de dentro da pasta do projeto (onde está frontend/)."
cd "$SCRIPT_DIR/frontend"

BASE_PATH="${BASE_PATH:-/apps/interfone/}"

log "Buildando frontend em frontend/dist-embed (base: $BASE_PATH)"
VITE_BASE_PATH="$BASE_PATH" npx vite build --outDir dist-embed

echo -e "\n${c_green}Pronto.${c_reset}"
info "Build gerado em: $SCRIPT_DIR/frontend/dist-embed"
info "Copie essa pasta pro Portal, ou aponte o servidor web dele a servir esse caminho como $BASE_PATH."
