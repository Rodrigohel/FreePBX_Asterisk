#!/usr/bin/env bash
# Atualiza este painel já instalado: busca a versão mais nova do código,
# reinstala dependências, rebuilda o frontend e reinicia só o processo Node
# do painel (pbx-dashboard-backend).
#
# NÃO faz instalação do zero (isso continua manual, veja o README — envolve
# criar o usuário no AMI do FreePBX e configurar Apache/Nginx, passos que
# não devem ser automatizados sem revisão) e, de propósito, NUNCA mexe no
# Asterisk/FreePBX em si (nem reinicia, nem reconfigura o manager) — só no
# serviço Node deste painel.
#
# Uso, de dentro da pasta onde o projeto já está instalado (ex. /opt/pbx-dashboard):
#   sudo ./update.sh
set -euo pipefail

c_reset='\033[0m'; c_bold='\033[1m'; c_blue='\033[1;34m'; c_yellow='\033[1;33m'; c_green='\033[1;32m'
log()  { echo -e "\n${c_blue}==>${c_reset} ${c_bold}$1${c_reset}"; }
info() { echo -e "    $1"; }
warn() { echo -e "${c_yellow}[aviso]${c_reset} $1"; }
die()  { echo -e "\033[1;31m[erro]\033[0m $1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como root: sudo ./update.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$SCRIPT_DIR/backend" ] && [ -d "$SCRIPT_DIR/frontend" ] || \
  die "Rode este script de dentro da pasta do projeto (onde estão backend/ e frontend/)."
cd "$SCRIPT_DIR"

SERVICE_NAME="${SERVICE_NAME:-pbx-dashboard-backend}"

if [ -d .git ]; then
  log "1/4 — Buscando a versão mais recente"
  git config --global --add safe.directory "$SCRIPT_DIR" 2>/dev/null || true
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if ! git pull --ff-only origin "$BRANCH"; then
    die "Não consegui atualizar (histórico local diverge do remoto). Resolva manualmente com 'git status'/'git log' antes de rodar de novo."
  fi
  info "Atualizado para $(git rev-parse --short HEAD) (branch $BRANCH)."
else
  warn "Pasta não é um checkout git — pulando 'git pull' (rode isso a partir de um clone do repositório para atualizar o código automaticamente)."
fi

log "2/4 — Backend: instalando dependências"
(cd backend && npm install --omit=dev --no-audit --no-fund --silent)

log "3/4 — Frontend: instalando dependências e rebuildando"
(cd frontend && npm install --no-audit --no-fund --silent && npm run build --silent)
info "Build gerado em frontend/dist."

log "4/4 — Reiniciando o serviço"
if systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1; then
  systemctl restart "$SERVICE_NAME"
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "\n${c_green}Atualizado e reiniciado com sucesso.${c_reset}"
  else
    die "O serviço não subiu depois do restart — veja os logs com: journalctl -u $SERVICE_NAME -n 50"
  fi
else
  warn "Serviço systemd '$SERVICE_NAME' não encontrado — o código foi atualizado e buildado, mas você precisa reiniciar o processo manualmente (ou configurar o systemd, veja o README)."
fi
