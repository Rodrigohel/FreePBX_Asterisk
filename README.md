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
  ser servido pelo Nginx/Apache que já roda no servidor.

Hospedagem externa só seria necessária se você quisesse expor o painel
publicamente fora da rede do PBX — não é um requisito da solução.

## Login é obrigatório?

Só para ver o **painel completo**. A página abre num painel público (você
escolhe quais cards aparecem ali — veja "Painel público" abaixo); para ver
tudo (ramais com nome, chamadas com número de destino, alertas, saúde do
servidor) é preciso logar, clicando em "Entrar" no canto superior. O
primeiro usuário é criado manualmente com `npm run seed:user` (veja o
passo a passo abaixo) — não existe usuário padrão pré-cadastrado por
segurança.

## Personalização (nome da empresa, ramal, usuário exibido)

| O que mudar | Onde | Como aplicar |
|---|---|---|
| Nome da empresa (ex.: "Acme Distribuidora") | `frontend/.env` → `VITE_COMPANY_NAME` | editar e rodar `npm run build` de novo |
| Nome do PBX (ex.: "PBX Matriz") | `frontend/.env` → `VITE_PBX_NAME` | editar e rodar `npm run build` de novo |
| Nome exibido do usuário logado (ex.: "Renata M.") e as iniciais do avatar | não é fixo — é o nome de quem faz login | definido/alterado com `npm run seed:user` (pergunta "Nome de exibição"), rodando de novo com o mesmo usuário para atualizar |
| Usuário/senha de login | tabela `users` (SQLite) | `npm run seed:user` cria ou atualiza a senha de um usuário |
| Logo da empresa (ícone padrão → sua marca) | `frontend/public/logo.png` + `frontend/.env` → `VITE_LOGO_URL` | ver seção "Logo da empresa" abaixo |
| Quais cards aparecem no painel público (sem login) | `backend/.env` → `PUBLIC_SHOW_*` | ver seção "Painel público" abaixo — só reiniciar o backend |

**Importante:** como o frontend é buildado como arquivos estáticos, qualquer
mudança em `frontend/.env` só aparece depois de rodar `npm run build`
novamente (e, se estiver usando Nginx, não precisa reiniciar nada — os
arquivos novos já substituem os antigos na pasta `dist`).

## Painel público (sem login)

A página abre, por padrão, num **painel público**: qualquer visitante vê um
subconjunto de cards sem precisar de senha, com um botão **"Entrar"** no
canto superior direito que abre o login em um pop-up — depois de logar, a
mesma página vira o painel completo (com "Sair" no lugar de "Entrar").

Você decide **quais cards ficam públicos** editando `backend/.env` (não
precisa mexer em código nem no frontend) — cada card tem sua própria chave
`PUBLIC_SHOW_*`, `true` ou `false`:

```bash
PUBLIC_DASHBOARD_ENABLED=true   # false = a página só mostra a tela de login

PUBLIC_SHOW_STATUS=true              # selo "Operacional/Degradado"
PUBLIC_SHOW_HERO_BANNER=true         # banner de resumo do topo
PUBLIC_SHOW_EXTENSIONS_SUMMARY=true  # contadores: configurados/online/offline
PUBLIC_SHOW_ACTIVE_CALLS_COUNT=true  # só a quantidade de chamadas ativas
PUBLIC_SHOW_ACTIVITY_CHART=true      # gráfico de atividade telefônica
PUBLIC_SHOW_TODAY_SUMMARY=false      # resumo de chamadas de hoje

# Estes revelam informação mais sensível — avalie antes de ligar:
PUBLIC_SHOW_EXTENSIONS_LIST=false    # nomes de cada ramal
PUBLIC_SHOW_ACTIVE_CALLS_LIST=false  # números/nomes de quem está ligando
PUBLIC_SHOW_ALERTS=false             # mensagens de alerta (podem citar detalhes internos)
PUBLIC_SHOW_SERVER_HEALTH=false      # CPU/memória/disco/serviços do servidor
```

Depois de mudar o `.env`, basta reiniciar o backend
(`sudo systemctl restart pbx-dashboard-backend` em produção, ou parar e
rodar `npm start` de novo em desenvolvimento) — não precisa rebuildar o
frontend, ele lê a configuração do backend a cada carregamento.

## Logo da empresa

Para trocar o ícone padrão pelo logo da sua empresa (aparece no painel
público, no painel logado e na tela de login):

1. Coloque o arquivo de imagem em `frontend/public/logo.png` (ou `.svg`).
2. No `frontend/.env`, defina `VITE_LOGO_URL=/logo.png`.
3. Rode `npm run build` de novo (é um valor "gravado" no build estático).

## Instalação no Debian — passo a passo (do zero)

Estes passos assumem um servidor Debian que **já tem o FreePBX/Asterisk
instalado e funcionando**, e que você tem acesso root/sudo via SSH.

> ⚠️ **Nunca use `systemctl restart asterisk` (ou `stop`/`start`) direto**
> num FreePBX Distro/Sangoma. O script `/etc/init.d/asterisk` que o systemd
> chama por trás tem uma checagem de "já está rodando" que pode travar e
> **impedir o Asterisk de voltar** depois de parar — derrubando o telefone
> da empresa até alguém perceber e corrigir manualmente (`fwconsole start`
> ou limpar `/var/run/asterisk/`). Use sempre **`fwconsole restart`** (ou
> `fwconsole stop` / `fwconsole start`), que é o comando de controle do
> próprio FreePBX e lida com isso corretamente. Qualquer mudança em
> `asterisk.conf`, `manager.conf`/`manager_custom.conf` etc. que precise de
> restart completo (não só `asterisk -rx "... reload"`) deve usar
> `fwconsole restart`.

### 1. Instalar o Node.js 20 (LTS)

O Node.js que vem no repositório padrão do Debian costuma ser antigo demais.
Use o repositório oficial da NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v20.x
```

### 2. Copiar o projeto para o servidor

```bash
sudo mkdir -p /opt/pbx-dashboard
sudo chown $USER:$USER /opt/pbx-dashboard
git clone -b claude/design-integration-bvawvw https://github.com/Rodrigohel/FreePBX_Asterisk.git /opt/pbx-dashboard
cd /opt/pbx-dashboard
```

> O código está na branch `claude/design-integration-bvawvw` (ainda não
> mesclado na `main`). Se depois isso for mesclado, o `-b ...` deixa de ser
> necessário.

Se preferir copiar direto da sua máquina (sem Git no servidor), rode isto
**no seu computador**, apontando para a pasta do projeto:

```bash
rsync -avz --exclude node_modules --exclude dist ./ usuario@ip-do-servidor:/opt/pbx-dashboard/
```

### 3. Criar o usuário AMI no FreePBX

No painel do FreePBX: **Settings → Asterisk Manager Users** → adicionar um
usuário novo (ex.: `dashboard`), com uma senha forte. Ou edite diretamente
`/etc/asterisk/manager_custom.conf` (esse arquivo, ao contrário de
`manager.conf`, sobrevive ao "Apply Config" do FreePBX):

```ini
[dashboard]
secret = troque-esta-senha
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate,agi,cc,security,message
write = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate,agi,cc,security,message
```

Depois recarregue: `asterisk -rx "manager reload"`.

> ⚠️ **Por que `write` também precisa dessas classes, mesmo sendo um usuário
> só de consulta:** em algumas versões do Asterisk (confirmado no 22.10.1),
> ações de **listagem** como `PJSIPShowEndpoints` e `CoreShowChannels` —
> que não alteram nada, só leem — na prática checam a permissão de
> **escrita** (`write`), não a de leitura, apesar da documentação do
> Asterisk (`manager show command PJSIPShowEndpoints`) mostrar
> `[Privilege] system,all` sem deixar claro qual lado. Com `write` vazio ou
> mais restrito que `read`, essas ações retornam
> `Response: Error / Message: Permission denied` mesmo com `read = all` —
> o painel então cai silenciosamente para dados simulados
> (`"source":"mock","error":"Permission denied"` na resposta da API) sem
> nenhum erro óbvio nos logs. Se isso acontecer, confirme com
> `asterisk -rx "manager show command <NomeDaAção>"` qual privilégio a ação
> exige e garanta que o mesmo nome de classe esteja tanto em `read` quanto
> em `write` para esse usuário.

### 4. Configurar e subir o backend

```bash
cd /opt/pbx-dashboard/backend
npm install
cp .env.example .env
nano .env   # preencha AMI_USER/AMI_PASSWORD, CDR_USER/CDR_PASSWORD, JWT_SECRET, etc.
npm run seed:user   # cria o usuário do painel (pede login, nome de exibição e senha)
npm start            # testa manualmente — Ctrl+C para parar depois de confirmar que funciona
```

Confirme que respondeu algo em `http://IP-DO-SERVIDOR:3001/health`.

### 5. Configurar e buildar o frontend

```bash
cd /opt/pbx-dashboard/frontend
npm install
cp .env.example .env
nano .env
# VITE_API_URL=http://IP-DO-SERVIDOR:3001   (ou o domínio/proxy que for usar)
# VITE_WS_URL=ws://IP-DO-SERVIDOR:3001/ws
# VITE_COMPANY_NAME=Nome da sua empresa
# VITE_PBX_NAME=Nome do seu PBX
npm run build
```

Isso gera os arquivos estáticos em `frontend/dist`.

### 6. Deixar o backend rodando sempre (systemd)

Crie o serviço:

```bash
sudo nano /etc/systemd/system/pbx-dashboard-backend.service
```

```ini
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

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pbx-dashboard-backend
sudo systemctl status pbx-dashboard-backend
```

### 7. Servir o frontend pelo servidor web que já roda no FreePBX

Descubra qual servidor web está ativo (o FreePBX Distro normalmente usa
**Apache**; instalações manuais em Debian puro às vezes usam Nginx):

```bash
systemctl is-active apache2 nginx httpd 2>/dev/null
```

**Se for Apache:**

```bash
sudo nano /etc/apache2/conf-available/pbx-dashboard.conf
```

```apache
Alias /pbx-dashboard /opt/pbx-dashboard/frontend/dist

<Directory /opt/pbx-dashboard/frontend/dist>
    Options -Indexes
    AllowOverride None
    Require all granted
    FallbackResource /pbx-dashboard/index.html
</Directory>

ProxyPass /pbx-dashboard/api/ http://127.0.0.1:3001/api/
ProxyPassReverse /pbx-dashboard/api/ http://127.0.0.1:3001/api/

ProxyPass /pbx-dashboard/ws ws://127.0.0.1:3001/ws
ProxyPassReverse /pbx-dashboard/ws ws://127.0.0.1:3001/ws
```

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel
sudo a2enconf pbx-dashboard
sudo systemctl reload apache2
```

**Se for Nginx**, edite o site existente (geralmente em
`/etc/nginx/sites-available/`) e acrescente dentro do bloco
`server { ... }`:

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

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Acesse `http://IP-OU-DOMINIO-DO-SERVIDOR/pbx-dashboard/` no navegador — deve
aparecer o painel público, com o botão "Entrar" no canto superior direito.

> Se preferir servir na raiz do domínio (sem o prefixo `/pbx-dashboard/`),
> ajuste as regras acima para `/`, `/api/` e `/ws`, e refaça o build do
> frontend com `VITE_API_URL`/`VITE_WS_URL` apontando para esse domínio.

## Atualizando

Depois da instalação inicial (acima, manual, feita uma vez só), as
próximas atualizações são só:

```bash
cd /opt/pbx-dashboard   # ou onde você instalou
sudo ./update.sh
```

Isso busca a versão mais nova do código (`git pull`), reinstala
dependências, rebuilda o frontend e reinicia só o processo Node deste
painel (`pbx-dashboard-backend`) — **nunca mexe no Asterisk/FreePBX, no
Apache/Nginx nem no usuário do AMI**, então é seguro rodar a qualquer
momento sem risco de derrubar o telefone da empresa.

## Build adicional para embutir noutro sistema (iframe)

Se este painel precisa ser embutido via `<iframe>` dentro de outro sistema
(ex.: um "Portal" que serve vários painéis sob `/apps/*`), gere um build
separado — **não** mexe no `frontend/dist` usado pelo `update.sh` acima:

```bash
cd /opt/pbx-dashboard   # ou onde você instalou
./build-embed.sh
# ou, pra mudar o subcaminho (padrão: /apps/interfone/):
BASE_PATH=/apps/outro-nome/ ./build-embed.sh
```

Gera `frontend/dist-embed/`, pronto pra copiar pro Portal ou servir
diretamente desse caminho.

## Endpoints do backend

O backend sobe em `http://localhost:3001` (padrão) com:

- `GET /health` — healthcheck simples, sem autenticação.
- `POST /api/auth/login` — autenticação (usuário/senha → JWT).
- `GET /api/public/dashboard` — painel público, sem autenticação; retorna
  somente os cards ligados em `PUBLIC_SHOW_*` (ver seção "Painel público").
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

## Ajustes que podem ser necessários no seu ambiente

- `backend/src/services/extensionsService.js` — a query de nome amigável do
  ramal assume uma tabela `users(extension, name)` no banco `asterisk`;
  ajuste ao schema real da sua instalação (varia entre versões do FreePBX).
- `backend/src/services/callsService.js` — a classificação
  recebida/realizada usa `dcontext LIKE 'from-internal%'`; se seu dialplan
  usa contextos customizados, ajuste os `WHERE`.
- `backend/src/services/alertsService.js` — limites de alerta (ramal
  offline, disco cheio) são configuráveis via `.env`
  (`ALERT_EXTENSION_OFFLINE_MINUTES`, `ALERT_DISK_USAGE_PERCENT`).

## Desenvolvimento local (sem Debian/produção)

```bash
# backend
cd backend && npm install && cp .env.example .env && npm run seed:user && npm run dev

# frontend, em outro terminal
cd frontend && npm install && cp .env.example .env && npm run dev
```

Acesse `http://localhost:5173`.

## Autenticação — detalhes

O primeiro usuário do painel é criado com `npm run seed:user` (pede
usuário, nome de exibição e senha). Rode novamente para criar mais usuários
ou redefinir a senha/nome de um já existente. As senhas são armazenadas com
hash bcrypt em SQLite (`backend/data/dashboard.db`, criado automaticamente).
