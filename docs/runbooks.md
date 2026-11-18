# Runbooks por serviço

Procedimentos operacionais para cada alerta. Formato: **sintoma → diagnóstico → ação → verificação**.

---

## Web Server (HTTP/HTTPS)

### WEB-01 · Web Server indisponível (`web-down`, Nível 3)
1. **Confirmar**: no painel Web, o tile Status está `DOWN` e o gráfico de disponibilidade caiu para 0.
2. **Diagnóstico de rede (do mais baixo ao mais alto nível)**:
   - Camada 3: `ping <host>` — o host responde?
   - Camada 4: `Test-NetConnection <host> -Port 443` (Windows) ou `nc -vz <host> 443` — a porta TCP abre?
   - Camada 7: `curl -I https://<host>/health` — qual o status HTTP?
3. **Ação**: reiniciar o serviço (`systemctl restart nginx`), verificar `journalctl -u nginx`, espaço em disco e certificado TLS.
4. **Verificação**: o alerta resolve sozinho após 2 coletas OK e chega o e-mail "RESOLVIDO".

### WEB-02 · Latência alta (`web-latency`)
1. Comparar `latência` (servidor) com `health check` (cliente). Se só o cliente está lento → rede; se ambos → aplicação.
2. Ver se o RPS subiu junto (carga) e o nº de conexões ativas.
3. Ação: escalar instâncias, habilitar cache, investigar queries lentas no Banco.

### WEB-03 · Taxa de erros / 5xx (`web-errors`, `web-5xx`)
1. Ver o quadro "Códigos HTTP no último ciclo". 4xx = problema do cliente (links quebrados, varredura); 5xx = erro do servidor.
2. 5xx: logs da aplicação, último deploy (fazer rollback se coincidir), dependências (Banco, DNS).
3. 4xx em massa em `/admin` ou URLs estranhas → ver [Playbook DDoS / varredura](playbooks.md#pb-01--ataque-ddos--pico-anormal-de-tráfego).

### WEB-04 · RPS acima do normal / anomalia (`web-rps`, `web-ddos`)
Ver [Playbook PB-01](playbooks.md#pb-01--ataque-ddos--pico-anormal-de-tráfego).

---

## Banco de Dados

### DB-01 · Banco indisponível (`db-down`)
1. `Test-NetConnection <host> -Port 5432`; `pg_isready -h <host>`.
2. Ver logs do PostgreSQL, espaço em disco, processo vivo.
3. Ação: reiniciar serviço; se corrupção, restaurar backup mais recente.

### DB-02 · Slow queries (`db-slow`)
1. Ativar/consultar `log_min_duration_statement` (já em 50 ms no `postgresql.conf` monitorado).
2. `SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;`
3. `EXPLAIN ANALYZE` na pior query; criar índice ou reescrever. Matar query travada com `pg_terminate_backend(pid)`.

### DB-03 · Rollbacks / falhas de transação (`db-rollback`)
1. Ver se coincide com deploy ou com conflito de locks (`pg_locks`).
2. Verificar deadlocks no log; revisar ordem de acesso às tabelas na aplicação.

### DB-04 · Pool quase esgotado / CPU alta (`db-pool`, `db-cpu`)
1. `SELECT state, count(*) FROM pg_stat_activity GROUP BY state;` — muitas `idle in transaction`?
2. Ajustar tamanho do pool na aplicação, `max_connections`, encerrar sessões ociosas.

---

## DNS

### DNS-01 · Nenhum servidor responde (`dns-down`)
1. `nslookup google.com 8.8.8.8` e `nslookup google.com 1.1.1.1`.
2. Se todos falham → problema de saída na rede (firewall bloqueando UDP/53, link caído).
3. Ação: verificar firewall, rota padrão, contatar provedor; usar servidor secundário.

### DNS-02 · Falhas de resolução (`dns-fail`)
1. No painel DNS, a tabela "Servidores de nomes" mostra qual servidor está DOWN e a "Amostra de resoluções" mostra `ETIMEOUT` (servidor não responde) ou `ENOTFOUND`/`NXDOMAIN` (nome não existe).
2. Timeout → retirar o servidor da lista (`DNS_SERVERS`) e acionar o responsável.
3. NXDOMAIN → registro apagado/expirado: verificar a zona (`named-checkzone`) e o registro no provedor.

### DNS-03 · Resolução lenta (`dns-latency`)
1. Comparar servidores; se só um está lento, priorizar o outro.
2. Verificar cache do resolvedor local e carga no servidor BIND (`rndc status`).

---

## SMTP

### SMTP-01 · Servidor não responde (`smtp-down`)
1. `Test-NetConnection smtp.gmail.com -Port 587`.
2. Teste manual: `openssl s_client -starttls smtp -connect smtp.gmail.com:587` e digitar `EHLO teste`.
3. Muitos provedores bloqueiam a porta 25 de saída — usar 587 (submission).

### SMTP-02 · Fila crescendo / entrega baixa (`smtp-queue`, `smtp-delivery`)
1. `postqueue -p` (Postfix) para ver a fila e o motivo do adiamento.
2. Causas comuns: destino recusando (reputação/blacklist), DNS MX falhando, limite de taxa do provedor.
3. Ação: corrigir causa, `postqueue -f` para reenviar; verificar SPF/DKIM/DMARC.

### SMTP-03 · Rejeições e timeouts (`smtp-errors`)
1. Ler os códigos: `4xx` = temporário (vai tentar de novo), `5xx` = permanente.
2. Verificar se o IP está em blacklist (ex.: consulta em listas RBL) e o volume enviado.
