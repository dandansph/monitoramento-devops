# Playbooks de incidentes

Cada playbook segue as fases: **Detecção → Triagem → Contenção → Erradicação → Recuperação → Pós-incidente**.

Severidade e tempo de resposta esperado:

| Nível | Cor | Notificação | Resposta |
|---|---|---|---|
| 1 | Verde | — | — |
| 2 | Amarelo | e-mail (resumo a cada 60 s) | até 30 min, em horário comercial |
| 3 | Vermelho | e-mail imediato | imediata (plantão) |

---

## PB-01 · Ataque DDoS / pico anormal de tráfego

**Detecção**: alerta `web-ddos` (z-score > 3 amarelo, > 6 vermelho) e/ou `web-rps`. No mapa, insetos invadem a Sala dos Servidores. Evento `ddos_suspeito` na Guarita.

**Triagem**
- É tráfego legítimo (campanha, notícia) ou ataque? Ver se o pico vem de poucos IPs, se os caminhos são estranhos (`/busca?q=xxxxx`, `/admin`) e se a taxa de 4xx subiu.
- Impacto: latência e health check estão degradados? Serviço caiu?

**Contenção**
- Ativar/apertar rate-limit no proxy (`limit_req zone=porip` no `nginx.conf` monitorado).
- Bloquear IPs/faixas de origem no firewall ou WAF; acionar proteção do provedor/CDN.

**Erradicação / Recuperação**
- Manter regras até o tráfego voltar à linha de base (z-score < 3 por 2 coletas → alerta resolve).
- Escalar instâncias se necessário.

**Pós-incidente**: registrar início/fim (histórico de Missões), IPs, volume máximo; revisar limiares.

---

## PB-02 · Força bruta no login

**Detecção**: alerta `sec-bruteforce` (> 5 falhas em 5 min = amarelo; > 15 = vermelho). Eventos `login_falho` e IP marcado como **BLOQUEADO** na Guarita. Encapuzados na porta no mapa.

**Triagem**: quantos IPs? Quais contas (a tabela "Contas visadas")? Houve algum login bem-sucedido do mesmo IP depois das falhas?

**Contenção**: o PixelNOC já bloqueia o IP por 10 min após 5 falhas. Bloquear permanentemente no firewall os IPs persistentes; forçar troca de senha das contas visadas.

**Erradicação**: habilitar MFA, senhas fortes, remover contas padrão (`admin`, `root`).

**Pós-incidente**: se houve login bem-sucedido suspeito, tratar como comprometimento (revogar tokens — trocar `JWT_SECRET` invalida todas as sessões).

---

## PB-03 · Alteração de arquivo de configuração

**Detecção**: alerta `sec-config` e evento `config_alterada` com hash antigo → novo e o diff das linhas.

**Triagem**: a mudança estava prevista (janela de manutenção, ticket)? Quem alterou? O diff enfraquece a segurança (ex.: `server_tokens on`, `allow-recursion any`, relay aberto)?

**Contenção**: se não autorizada, restaurar a versão anterior (controle de versão/backup) e recarregar o serviço (`nginx -t && systemctl reload nginx`).

**Recuperação**: reconhecer o alerta na tela de Missões (vira nova linha de base).

**Pós-incidente**: revisar acessos ao servidor; adotar gestão de configuração (Git + revisão).

---

## PB-04 · Serviço crítico fora do ar

**Detecção**: qualquer regra `*-down` (Nível 3, e-mail imediato). Sala apagada e soltando fumaça no mapa.

**Triagem**: só um serviço ou vários? Vários ao mesmo tempo → suspeitar de rede/DNS/host comum.

**Ação**: seguir o runbook do serviço (`WEB-01`, `DB-01`, `DNS-01`, `SMTP-01`), comunicar os usuários, registrar horário.

**Recuperação**: confirmar e-mail "RESOLVIDO" e disponibilidade voltando a 1 no gráfico. Calcular indisponibilidade pelo uptime.

---

## PB-05 · Vulnerabilidade conhecida em serviço

**Detecção**: card "Vulnerabilidades conhecidas por serviço" (fonte OSV.dev) com avisos para a versão instalada.

**Triagem**: ler o aviso (DSA/DLA/CVE), ver se o componente vulnerável é usado e se está exposto.

**Ação**: atualizar o pacote para a versão "corrigido em ..." indicada; se não for possível, mitigar (desabilitar módulo, restringir acesso).

**Verificação**: atualizar a versão no inventário (`server/src/security/vulns.js`) e clicar em **Reverificar**.
