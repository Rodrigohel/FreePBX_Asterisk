# Handoff: Dashboard FreePBX — Backend Integration

## Instrução principal para a IA/desenvolvedor
**NÃO altere o design.** O arquivo `Dashboard.dc.html` incluído aqui é a referência visual final, aprovada. Sua tarefa é **apenas**:
1. Criar o backend que busca dados reais do FreePBX/Asterisk (via AMI ou ARI, ou API REST do FreePBX).
2. Substituir os dados simulados (mock) por chamadas reais a esse backend.
3. Manter exatamente o layout, cores, tipografia, espaçamentos, ícones e textos como estão.

Não modifique estrutura HTML, estilos inline, classes visuais, nomes de textos/labels, nem o comportamento de UI (tema, filtros de período, hover, animações). Qualquer ajuste puramente visual deve ser recusado ou perguntado antes de aplicado.

## Sobre o arquivo de design
`Dashboard.dc.html` é um protótipo em HTML/React (Design Component) com dados fictícios fixos no código (hardcoded). Ele NÃO se conecta a nenhum servidor. É uma referência de alta fidelidade (hifi): cores, tipografia e espaçamentos finais.

## O que precisa ser construído (backend)
Um serviço que exponha os dados abaixo, atualizados a partir do FreePBX/Asterisk real:

### Endpoints necessários (sugestão de contrato)
- `GET /api/status` → status geral do PBX (operacional/degradado/offline), conexão.
- `GET /api/extensions` → lista de ramais: número, nome, estado (livre/em ligação/tocando/offline), última atividade.
- `GET /api/extensions/summary` → totais: configurados, online, offline.
- `GET /api/calls/active` → chamadas em andamento: ramal, nome, destino, direção, duração, estado.
- `GET /api/calls/summary?range=today|7d|30d` → série temporal de recebidas/realizadas/perdidas/falhas por período, para o gráfico de atividade.
- `GET /api/calls/today-summary` → recebidas, realizadas, perdidas, com falha, tempo médio, tempo total, ramal mais usado.
- `GET /api/alerts` → lista de alertas (severidade, mensagem, hora, status ativo/resolvido).
- `GET /api/server/health` → CPU, memória, disco, load average, status dos serviços (Asterisk, banco, web, painel), uptime.

Dados em tempo real (chamadas ativas, ramais online) devem vir do **AMI (Asterisk Manager Interface)** ou **ARI (Asterisk REST Interface)**. Considerar WebSocket ou polling curto (ex.: 5s) para atualizar o dashboard sem recarregar a página.

### Onde plugar no front-end
No arquivo `Dashboard.dc.html`, a classe `Component` (bloco `c_dc_js`) tem os dados mockados dentro de `renderVals()` (variáveis `indicatorCards`, `extensionRows`, `activeCalls`, `alerts`, `healthMetrics`, `services`, `summaryStats`) e em `this.trendData` (constructor). Substituir essas fontes por `fetch`/estado carregado dos endpoints acima, mantendo exatamente a mesma forma dos objetos (mesmos campos: `title`, `value`, `stateColor`, etc.) — assim nenhuma parte visual precisa mudar.

O botão "Atualizar" (`handleRefresh`) já existe e deve disparar a nova busca de dados em vez do timeout simulado atual.

## Autenticação
Adicionar autenticação de usuário (a UI já mostra um usuário logado "Renata M." — mock). Definir login real e sessão/token antes de expor esse painel publicamente.

## Arquivos
- `Dashboard.dc.html` — protótipo completo (front-end de referência, não copiar literalmente para produção sem adaptar ao stack do projeto).
