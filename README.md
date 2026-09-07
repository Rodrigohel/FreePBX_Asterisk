# Dashboard PBX — FreePBX/Asterisk

Painel de monitoramento em tempo real para FreePBX/Asterisk: ramais, chamadas
ativas, atividade telefônica, alertas e saúde do servidor.

O design visual (`design/Dashboard.dc.html`) foi fornecido pronto e **não foi
alterado** — veja `design/HANDOFF.md` para as instruções originais de
handoff. Este repositório contém a implementação separada de:

- **`backend/`** — API REST + WebSocket em Node.js/Express que busca dados
  reais do Asterisk via **AMI** (ramais, chamadas ativas) e do **CDR**
  (histórico de chamadas), com autenticação por usuário/senha (JWT).
- **`frontend/`** — aplicação React (Vite) que reproduz fielmente o layout,
  cores, tipografia e comportamento do design de referência, consumindo a
  API acima em vez de dados simulados.
- **`design/`** — arquivo de design original (intocado) e o handoff recebido.

## Onde isso roda

Não é necessário nenhum serviço de hospedagem externo. A arquitetura foi
pensada para rodar **no mesmo servidor Debian onde o FreePBX já está
instalado**:

- o backend conecta no AMI via `127.0.0.1:5038` e no MySQL/MariaDB local
  (`asteriskcdrdb`) — tudo em rede local, sem expor portas do Asterisk;
- o backend roda como processo Node próprio (porta configurável, padrão
  `3001`), separado da interface administrativa do FreePBX;
- o frontend é build estático (`frontend/dist` após `npm run build`) e pode
  ser servido pelo Nginx/Apache que já roda no servidor, com um `location`
  fazendo proxy para o backend.

Hospedagem externa só seria necessária se você quisesse expor o painel
publicamente fora da rede do PBX — não é um requisito da solução.

## Requisitos

- Node.js 18+
- Acesso ao AMI do Asterisk (usuário/senha configurados em `manager.conf` /
  interface do FreePBX)
- Acesso de leitura ao banco `asteriskcdrdb` (e opcionalmente `asterisk`,
  para nomes de ramal)

## Configuração do AMI no FreePBX

Em **Settings → Asterisk Manager Users** (ou `/etc/asterisk/manager.conf`),
crie um usuário somente leitura para o dashboard, por exemplo:

```ini
[dashboard]
secret = troque-esta-senha
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,agent,user
write =
```

## Backend

```bash
cd backend
npm install
cp .env.example .env   # edite AMI_*, CDR_*, JWT_SECRET etc.
npm run seed:user      # cria o primeiro usuário do painel (login interativo)
npm start               # ou: npm run dev (com --watch)
```

O backend sobe em `http://localhost:3001` (padrão) com:

- `GET /health` — healthcheck simples, sem autenticação.
- `POST /api/auth/login` — autenticação (usuário/senha → JWT).
- `GET /api/status`, `/api/extensions`, `/api/extensions/summary`,
  `/api/calls/active`, `/api/calls/summary?range=today|7d|30d`,
  `/api/calls/today-summary`, `/api/alerts`, `/api/server/health` —
  protegidos por `Authorization: Bearer <token>`.
- WebSocket em `/ws` — push de `calls:active` e `extensions` a cada 5s,
  para atualização em tempo real sem esperar o polling do frontend.

**Modo mock:** se o AMI ou o CDR estiverem indisponíveis (ou com
`FORCE_MOCK=true` no `.env`), cada endpoint cai automaticamente para dados
simulados no mesmo formato dos dados reais — útil para desenvolver o
frontend sem um PBX real à mão. O topo do dashboard indica quando os dados
são simulados.

### Ajustes que podem ser necessários no seu ambiente

- `backend/src/services/extensionsService.js` — a query de nome amigável do
  ramal assume uma tabela `users(extension, name)` no banco `asterisk`;
  ajuste ao schema real da sua instalação (varia entre versões do FreePBX).
- `backend/src/services/callsService.js` — a classificação
  recebida/realizada usa `dcontext LIKE 'from-internal%'`; se seu dialplan
  usa contextos customizados, ajuste os `WHERE`.
- `backend/src/services/alertsService.js` — limites de alerta (ramal
  offline, disco cheio) são configuráveis via `.env`
  (`ALERT_EXTENSION_OFFLINE_MINUTES`, `ALERT_DISK_USAGE_PERCENT`).

## Frontend

```bash
cd frontend
npm install
cp .env.example .env    # aponte VITE_API_URL para o backend
npm run dev              # desenvolvimento, http://localhost:5173
npm run build             # gera frontend/dist para produção
```

Em produção, sirva `frontend/dist` como arquivos estáticos (Nginx/Apache) e
configure um proxy reverso de `/api` e `/ws` para o backend, ou aponte
`VITE_API_URL`/`VITE_WS_URL` diretamente para o host:porta do backend antes
do build.

## Autenticação

O primeiro usuário do painel é criado com `npm run seed:user` (pede
usuário, nome de exibição e senha). Rode novamente para criar mais usuários
ou redefinir uma senha. As senhas são armazenadas com hash bcrypt em SQLite
(`backend/data/dashboard.db`, criado automaticamente).

## Deploy sugerido (systemd + Nginx, no mesmo Debian do FreePBX)

```ini
# /etc/systemd/system/pbx-dashboard-backend.service
[Unit]
Description=Dashboard PBX - backend
After=network.target asterisk.service

[Service]
WorkingDirectory=/opt/pbx-dashboard/backend
ExecStart=/usr/bin/node src/server.js
EnvironmentFile=/opt/pbx-dashboard/backend/.env
Restart=on-failure
User=asterisk

[Install]
WantedBy=multi-user.target
```

```nginx
location /pbx-dashboard/ {
    alias /opt/pbx-dashboard/frontend/dist/;
    try_files $uri $uri/ /pbx-dashboard/index.html;
}
location /pbx-dashboard/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
}
location /pbx-dashboard/ws {
    proxy_pass http://127.0.0.1:3001/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $upgrade;
    proxy_set_header Connection "upgrade";
}
```

(Ajuste os caminhos base do Vite/roteamento se servir fora da raiz `/`.)
