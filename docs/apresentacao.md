# Roteiro da apresentação (~10 minutos)

**Antes de começar (5 min antes)**
- `npm run dev` e deixar rodando **pelo menos 2 minutos** (o detector de DDoS precisa aprender a linha de base).
- Abrir http://localhost:5173, fazer login, ligar o som (ícone 🔇 → 🔊).
- Deixar uma segunda aba aberta na tela de Missões.
- Testar o projetor em tela cheia (F11). O mapa se adapta à largura.

---

### 1. Abertura — o problema (1 min) · *Pessoa A*
"Em DevOps, quem descobre que o site caiu não pode ser o cliente. Fizemos o PixelNOC: uma plataforma
que monitora Web, Banco, DNS e SMTP, gera alertas em 3 níveis e avisa por e-mail — com cara de jogo
para que qualquer pessoa entenda o estado da infraestrutura em 1 segundo."

### 2. Tour pela visão consolidada (1,5 min) · *Pessoa A*
- Mapa: cada sala é um serviço; o operador mostra a métrica principal no balão.
- Barras de "HP" no topo = disponibilidade da última hora. Espadas = missões (alertas) ativas.
- Mostrar que os dados são **reais**: DNS resolvendo em 8.8.8.8/1.1.1.1, sonda SMTP falando `EHLO` com o Gmail, HTTPS em sites reais.

### 3. Dashboard de um serviço (1,5 min) · *Pessoa B*
- Clicar na **Sala dos Servidores**: RPS, latência, taxa de erro, 4xx/5xx, conexões ativas.
- Trocar o período (15m → 1h).
- Clicar no **DNS**: tabela por servidor e amostra de resoluções — falar de UDP/53 e registro A.

### 4. Incidente ao vivo: DDoS (2 min) · *Pessoa B*
- Simulador → **Ataque DDoS**. Voltar ao Mapa.
- Insetos invadem a sala, sirene vermelha, alarme toca.
- Explicar: média móvel + desvio padrão → z-score; acima de 6 = Nível 3.
- Abrir Missões → clicar **ver e-mail enviado** (mostra o e-mail crítico).
- Ler rapidamente o [Playbook PB-01](playbooks.md).

### 5. Segurança (2 min) · *Pessoa A*
- Simulador → **Força bruta**: encapuzados na porta; na Guarita, IPs ficam BLOQUEADOS após 5 falhas.
- Simulador → **Alterar configuração**: papel voa até o guarda; mostrar o diff `server_tokens off → on`.
- Card de **vulnerabilidades**: avisos reais da base OSV.dev para nginx, PostgreSQL, BIND e Postfix.

### 6. Resiliência e documentação (1 min) · *Pessoa B*
- Simulador → **Derrubar Web**: sala apaga e solta fumaça, e-mail CRÍTICO; parar → e-mail RESOLVIDO.
- Mostrar Regras (limiares editáveis) e citar histerese (evita alarme falso).
- Citar docs: arquitetura, runbooks, playbooks, testes automatizados (14 unitários + 12 de navegação).

### 7. Fechamento (30 s)
"Monitoramento não é só gráfico: é detectar, avisar a pessoa certa e ter o procedimento pronto."

---

## Perguntas prováveis

- **Por que SQLite?** Embutido, zero instalação, suficiente para a escala da demo; o modelo `metrics(ts, service, metric, value)` migra fácil para TimescaleDB/InfluxDB.
- **Por que não Prometheus/Grafana?** O trabalho pede front-end próprio; a arquitetura é a mesma (coletores → TSDB → regras → Alertmanager → e-mail).
- **O que é real e o que é simulado?** Ver tabela em [arquitetura.md](arquitetura.md#coleta-por-serviço-camadas-de-rede).
- **Como evitar alarme falso?** Amostras consecutivas (`for`) para disparar e 2 amostras boas para resolver.
- **E se o próprio monitor cair?** Rodar em outra máquina/rede, e um "dead man's switch" externo verificando `/api/health`.

## Plano B (se a internet da sala falhar)
Web, Banco e todos os cenários do simulador funcionam offline. DNS, SMTP e sites externos ficarão DOWN —
use isso a favor: "olha a plataforma detectando a queda do link".
