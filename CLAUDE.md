# Instruções para o Claude neste repositório

## Sempre informar o comando de atualização do servidor

Ao final de **toda** modificação que for mergeada/pushada pra `main`, informe ao
usuário os comandos que ele precisa rodar no servidor de produção
(`/opt/pbx-dashboard`, ajustar se for outro caminho) pra aplicar a mudança —
ele não tem atualização automática, e o trabalho feito aqui só existe no
GitHub até alguém rodar isso lá:

```bash
cd /opt/pbx-dashboard
sudo ./update.sh
```

Isso cobre qualquer mudança de backend e/ou do build normal do frontend
(`frontend/dist`).

Se a mudança também afetar o build de embed (iframe no Portal, variáveis
`VITE_API_URL`/`VITE_BASE_PATH`/`VITE_EMBEDDED`, ou o próprio
`build-embed.sh`), informe também:

```bash
./build-embed.sh
```

Não pressupor que o usuário vai lembrar de perguntar — incluir isso mesmo em
mudanças pequenas (correção de um campo, ajuste visual, etc.), sempre que a
mudança já estiver mergeada/pushada.
