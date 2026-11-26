// Gera o relatório ABNT (NBR 14724) do PixelNOC em .docx
// Uso: npm install --no-save docx@9 && node relatorio/gerar-relatorio.cjs .   (depois abra o .docx no Word e atualize o sumário)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, TableOfContents, Header, PageNumber, LevelFormat, Footer,
} = require('docx');

const REPO = process.argv[2];
const IMG = (f) => fs.readFileSync(f.startsWith('prints/') ? path.join(REPO, 'relatorio', f) : path.join(REPO, 'docs', 'img', f));
// Ordem fixa das figuras no documento (usada nas referências do texto)
const ORDER = ['arq', 'web1h', 'db', 'dns', 'smtp', 'regras', 'email', 'ddos1', 'ddos2', 'ddos3', 'seg', 'mapa', 'dashweb', 'alertacrit', 'missoes', 'filtro', 'login', 'mapa2', 'sim', 'mobmapa', 'mobweb', 'mobregras', 'mobsim', 'logout'];
const FIG = (id) => { const i = ORDER.indexOf(id); if (i < 0) throw new Error('figura desconhecida ' + id); return i + 1; };
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

const FONT = 'Arial';
const CM = 567; // DXA por cm
const LINE15 = 360;
const TEXT_W = (21 - 3 - 2) * CM; // largura útil

const AUTORES = ['PEDRO LUCAS LOPES MONTEIRO (25101532)', 'DANIEL HENRIQUE PONTES DE SOUZA (25101582)', 'LEANDRO FILIPE PEREIRA (25101295)'];
const TITULO = 'PIXELNOC: PLATAFORMA DE MONITORAMENTO DE SERVIÇOS DE REDE PARA DEVOPS';

// ---------- helpers ----------
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o });
function p(content, o = {}) {
  const children = typeof content === 'string' ? parseInline(content) : content;
  return new Paragraph({
    children,
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { line: o.line ?? LINE15, before: o.before ?? 0, after: o.after ?? 0 },
    indent: o.noIndent ? undefined : { firstLine: Math.round(1.25 * CM) },
    keepNext: o.keepNext,
    ...o.extra,
  });
}
// **negrito** e _itálico_ simples
function parseInline(s, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(run(s.slice(last, m.index), base));
    const t = m[0];
    out.push(t.startsWith('**') ? run(t.slice(2, -2), { ...base, bold: true }) : run(t.slice(1, -1), { ...base, italics: true }));
    last = m.index + t.length;
  }
  if (last < s.length) out.push(run(s.slice(last), base));
  return out;
}
const center = (text, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE15, before: o.before ?? 0, after: o.after ?? 0 }, children: [run(text, o.run)] });
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ spacing: { line: LINE15 }, children: [run('')] }));
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT, size: 24, bold: true })], pageBreakBefore: true });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT, size: 24, bold: true })] });
const bullet = (t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE15 }, children: parseInline(t) });

let figN = 0, tabN = 0;
function figure(file, caption, widthCm = 16, id) {
  figN++;
  if (id && FIG(id) !== figN) throw new Error(`figura ${id} esperada na posição ${FIG(id)}, mas está na ${figN}`);
  const buf = IMG(file);
  const { w, h } = pngSize(buf);
  const wpx = Math.round(widthCm * 37.8);
  let hpx = Math.round(wpx * (h / w));
  const maxH = Math.round(20 * 37.8);
  let fw = wpx;
  if (hpx > maxH) { fw = Math.round(maxH * (w / h)); hpx = maxH; }
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60, line: 240 }, children: [run(`Figura ${figN} – ${caption}`, { size: 20 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { line: 240 }, children: [new ImageRun({ type: 'png', data: buf, transformation: { width: fw, height: hpx } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200, line: 240 }, children: [run('Fonte: elaborado pelos autores (2026).', { size: 20 })] }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
function table(caption, header, rows, widthsCm) {
  tabN++;
  const total = widthsCm.reduce((a, b) => a + b, 0);
  const widths = widthsCm.map((w) => Math.round((w / total) * TEXT_W));
  widths[widths.length - 1] += TEXT_W - widths.reduce((a, b) => a + b, 0);
  const cell = (text, i, head) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: { top: border, bottom: border, left: none, right: none },
    children: [new Paragraph({ spacing: { line: 240 }, children: parseInline(text, { size: 20, bold: head || undefined }) })],
  });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60, line: 240 }, children: [run(`Tabela ${tabN} – ${caption}`, { size: 20 })] }),
    new Table({
      width: { size: TEXT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }), ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))],
    }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 200, line: 240 }, children: [run('Fonte: elaborado pelos autores (2026).', { size: 20 })] }),
  ];
}

// ---------- pré-textuais ----------
const capa = [
  center('INSTITUTO BRASILEIRO DE ENSINO, DESENVOLVIMENTO E PESQUISA – IDP', { run: { bold: true } }),
  center('CURSO DE GRADUAÇÃO EM ENGENHARIA DE SOFTWARE', { run: { bold: true } }),
  ...blank(3),
  ...AUTORES.map((a) => center(a)),
  ...blank(6),
  center(TITULO, { run: { bold: true } }),
  ...blank(10),
  center('BRASÍLIA'),
  center('2026'),
];

const rosto = [
  new Paragraph({ children: [new PageBreak()] }),
  ...AUTORES.map((a) => center(a)),
  ...blank(6),
  center(TITULO, { run: { bold: true } }),
  ...blank(3),
  new Paragraph({
    indent: { left: 8 * CM }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 240 },
    children: [run('Trabalho final apresentado à disciplina de Redes de Computadores e Internet do Instituto Brasileiro de Ensino, Desenvolvimento e Pesquisa – IDP, como requisito parcial para aprovação.', { size: 20 })],
  }),
  ...blank(1),
  new Paragraph({ indent: { left: 8 * CM }, spacing: { line: 240 }, children: [run('Professora: Lorena Borges', { size: 20 })] }),
  ...blank(7),
  center('BRASÍLIA'),
  center('2026'),
];

const resumo = [
  new Paragraph({ children: [new PageBreak()] }),
  center('RESUMO', { run: { bold: true }, after: 240 }),
  p('Este trabalho apresenta o projeto, a implementação e a validação do PixelNOC, uma plataforma web de monitoramento de serviços de rede voltada a equipes de DevOps. A solução monitora quatro serviços — servidor web (HTTP/HTTPS), banco de dados, DNS e SMTP — coletando, a cada cinco segundos, métricas de disponibilidade, volume de acessos e consultas e parâmetros de desempenho. Parte das medições é feita contra serviços reais da Internet, como a resolução de nomes nos servidores 8.8.8.8 e 1.1.1.1 e o diálogo SMTP com o comando EHLO, e parte contra um ambiente de demonstração controlado, que permite provocar incidentes durante a apresentação. As métricas são armazenadas em SQLite e avaliadas por um motor de regras com três níveis de severidade (verde, amarelo e vermelho) e histerese, que envia notificações por e-mail: imediatas para alertas críticos e agrupadas para alertas de atenção. Como monitoramentos extras de segurança, a plataforma detecta anomalias de tráfego indicativas de DDoS por meio de escore-z, tentativas de força bruta por janela deslizante com bloqueio de IP, alterações em arquivos de configuração por hash SHA-256 e vulnerabilidades conhecidas por serviço, consultando a base pública OSV. O front-end, responsivo, adota uma interface gamificada em pixel art, na qual cada serviço é uma sala de um data center cujo operador reage ao estado do serviço, além de painéis com gráficos detalhados. A plataforma foi validada com 14 testes unitários e 12 testes automatizados de navegação em desktop e celular, além de cenários de incidente executados manualmente.', { noIndent: true, line: 240 }),
  ...blank(1),
  p('**Palavras-chave**: monitoramento de redes; DevOps; alertas; segurança de redes; observabilidade.', { noIndent: true, line: 240 }),
];

const sumario = [
  new Paragraph({ children: [new PageBreak()] }),
  center('SUMÁRIO', { run: { bold: true }, after: 240 }),
  new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
];

// ---------- textuais ----------
const body = [];
const add = (...xs) => xs.flat().forEach((x) => body.push(x));

add(h1('1 INTRODUÇÃO'));
add(p('A disponibilidade dos serviços de rede é requisito básico de qualquer sistema em produção. Em ambientes DevOps, nos quais mudanças são entregues continuamente, a equipe precisa saber que um serviço degradou antes que os usuários percebam. Para isso são usadas plataformas de monitoramento, que coletam métricas, comparam-nas com limites aceitáveis e notificam os responsáveis quando algo sai do normal (BEYER et al., 2016).'));
add(p('O objetivo deste trabalho é projetar, implementar e entregar um site de monitoramento de serviços de rede — servidor web, banco de dados, DNS e SMTP — com dashboards por serviço e visão consolidada, regras de alerta em três níveis com notificação por e-mail, requisitos de segurança e monitoramentos extras, documentação técnica e testes de navegação.'));
add(p('Como diferencial, a interface foi desenhada como um jogo em pixel art: o estado de toda a infraestrutura é representado por um mapa de data center, o que reduz o tempo necessário para entender a situação durante um incidente. A solução recebeu o nome de **PixelNOC**, em referência ao _Network Operations Center_ (NOC), a sala de onde equipes de operação acompanham a rede.'));
add(p('O documento está organizado da seguinte forma: o capítulo 2 apresenta a fundamentação sobre os protocolos monitorados; o capítulo 3 descreve a arquitetura; o capítulo 4 detalha as métricas coletadas por serviço; o capítulo 5 trata das regras de alerta; o capítulo 6, da segurança; o capítulo 7, da interface; o capítulo 8, dos testes; o capítulo 9 resume a documentação operacional; e o capítulo 10 traz as conclusões.'));

add(h1('2 FUNDAMENTAÇÃO TEÓRICA'));
add(h2('2.1 Monitoramento de redes e DevOps'));
add(p('Monitorar consiste em observar periodicamente um sistema para verificar se ele cumpre o comportamento esperado. Beyer et al. (2016) propõem quatro "sinais de ouro" para serviços: latência, tráfego, erros e saturação. As métricas pedidas neste trabalho seguem essa linha: tempo de resposta (latência), requisições ou consultas por segundo (tráfego), taxas de erro e uso de recursos como conexões, fila e CPU (saturação). A disponibilidade, normalmente expressa como percentual de tempo em que o serviço respondeu (_uptime_), resume a experiência do usuário.'));
add(p('Duas formas de coleta são comuns: a verificação ativa, ou sintética, em que o monitor se comporta como um cliente e testa o serviço (por exemplo, um _ping_ ou uma requisição HTTP), e a instrumentação, em que o próprio serviço expõe contadores internos. O PixelNOC usa as duas, além de aceitar métricas enviadas por agentes externos.'));
add(h2('2.2 HTTP e HTTPS'));
add(p('O HTTP é o protocolo da camada de aplicação usado na Web, que funciona no modelo requisição e resposta sobre TCP (KUROSE; ROSS, 2021). Cada resposta traz um código de status: a classe 2xx indica sucesso, 4xx indica erro do cliente (por exemplo, 404 – recurso não encontrado, 403 – acesso proibido) e 5xx indica erro do servidor (FIELDING; NOTTINGHAM; RESCHKE, 2022). O HTTPS é o HTTP transportado dentro de uma sessão TLS, na porta 443. Monitorar a distribuição desses códigos permite separar problemas da aplicação (5xx) de varreduras e links quebrados (4xx).'));
add(h2('2.3 DNS'));
add(p('O DNS é o serviço distribuído que traduz nomes de domínio em endereços IP. As consultas normalmente usam UDP na porta 53 e, quando o servidor não responde dentro do tempo limite, o cliente registra um _timeout_; quando o nome não existe, a resposta é NXDOMAIN (MOCKAPETRIS, 1987). Como quase toda comunicação começa por uma resolução de nome, uma falha de DNS costuma parecer, para o usuário, uma queda geral da Internet.'));
add(h2('2.4 SMTP'));
add(p('O SMTP é o protocolo de envio de e-mails entre servidores (KLENSIN, 2008). Uma sessão começa com a saudação do servidor (código 220), seguida do comando EHLO, ao qual o servidor responde com as extensões suportadas, como STARTTLS e AUTH. Mensagens que não podem ser entregues imediatamente ficam em fila; uma fila crescente indica que o destino está recusando mensagens (códigos 4xx temporários ou 5xx permanentes) ou que a capacidade de envio foi excedida. A porta 587 (_submission_) é usada para envio autenticado.'));
add(h2('2.5 Banco de dados em rede'));
add(p('Bancos de dados relacionais, como o PostgreSQL, atendem clientes via TCP e mantêm um conjunto limitado de conexões, normalmente gerenciado por um _pool_ na aplicação. As métricas de interesse incluem consultas por segundo (QPS), latência, transações desfeitas (_rollback_), consultas lentas (_slow queries_) e crescimento do armazenamento.'));
add(h2('2.6 Segurança'));
add(p('Ataques de negação de serviço distribuída (DDoS) tentam esgotar recursos de rede ou do servidor com volume anormal de requisições. Ataques de força bruta tentam adivinhar credenciais repetindo tentativas de login. A alteração não autorizada de arquivos de configuração é um indicador clássico de comprometimento, e a verificação de integridade por _hash_ criptográfico é a forma usual de detectá-la. Por fim, vulnerabilidades públicas são catalogadas em bases como CVE e OSV, permitindo cruzar as versões instaladas com falhas conhecidas (NIST, 2012).'));

add(h1('3 ARQUITETURA DA SOLUÇÃO'));
add(p('O PixelNOC é composto por um servidor Node.js, que realiza a coleta, o armazenamento, a avaliação das regras e a notificação, e por um front-end React, que consome uma API REST e recebe atualizações em tempo real via WebSocket. A Figura 1 apresenta a visão geral.'));
add(figure('arquitetura.png', 'Arquitetura do PixelNOC', 16, 'arq'));
add(table('Componentes e tecnologias', ['Componente', 'Tecnologia', 'Responsabilidade'], [
  ['Coletores', 'fetch, dns.Resolver, net.Socket, node:sqlite', 'Medir cada serviço a cada 5 s'],
  ['Ingestão', 'Express (POST /api/ingest)', 'Receber métricas de coletores e agentes externos'],
  ['Armazenamento', 'SQLite embutido', 'Séries temporais, alertas e eventos (retenção de 24 h)'],
  ['Motor de alertas', 'Regras em JSON + máquina de estados', 'Classificar em 3 níveis com histerese'],
  ['Notificação', 'nodemailer', 'E-mail imediato (crítico) e resumo (atenção)'],
  ['Segurança', 'escore-z, janela deslizante, SHA-256, OSV.dev', 'DDoS, força bruta, integridade e vulnerabilidades'],
  ['Tempo real', 'WebSocket (ws) com JWT', 'Enviar métricas e alertas ao navegador'],
  ['Front-end', 'React, TypeScript, Vite, Canvas 2D, Recharts', 'Mapa gamificado e dashboards responsivos'],
], [3.5, 5.5, 7]));
add(h2('3.1 Coleta e ingestão'));
add(p('Os coletores são funções assíncronas executadas em paralelo a cada cinco segundos. Cada uma devolve um conjunto de métricas numéricas e detalhes de diagnóstico, que passam pelo mesmo pipeline de ingestão usado pelos agentes externos. O endpoint POST /api/ingest exige uma chave de API no cabeçalho _x-api-key_, permitindo que servidores reais enviem suas próprias métricas.'));
add(h2('3.2 Ambiente monitorado: o que é real e o que é simulado'));
add(p('Para que a apresentação em sala pudesse mostrar falhas sem depender de infraestrutura externa, adotou-se uma abordagem híbrida, resumida na Tabela 2.'));
add(table('Origem das medições por serviço', ['Serviço', 'Medido de forma real', 'Simulado'], [
  ['Web', 'Health check HTTP no servidor "loja-demo" (porta 4100), códigos de status, RPS, latência e conexões TCP abertas; HTTPS em sites externos', 'Tráfego dos clientes, gerado por script local'],
  ['Banco', 'Carga SQL real (inserts, selects, transações) com medição de QPS, latência, rollbacks, slow queries e tamanho', 'Conexões do pool e latência de disco'],
  ['DNS', 'Resolução de registros A em 8.8.8.8 e 1.1.1.1: tempo, falhas e QPS', 'Nenhum; o cenário de falha usa um IP que não responde (192.0.2.53)'],
  ['SMTP', 'Sessão TCP com smtp.gmail.com:587 (220, EHLO, QUIT) e latência', 'Fila, taxa de entrega e volume de um MTA de demonstração'],
], [2.5, 8, 5.5]));
add(h2('3.3 Armazenamento'));
add(p('As métricas são gravadas em uma tabela no formato longo — metrics(ts, service, metric, value) — indexada por serviço, métrica e tempo. Esse modelo permite acrescentar métricas novas sem alterar o esquema e facilita a agregação por intervalo: a API devolve séries de 15 minutos, 1 hora, 6 horas ou 24 horas, com médias por balde de tempo. Alertas, eventos de segurança e a linha de base dos arquivos de configuração ficam em tabelas próprias.'));

add(h1('4 MÉTRICAS POR SERVIÇO'));
add(p('A Tabela 3 relaciona as métricas recomendadas no enunciado com a implementação.'));
add(table('Métricas implementadas por serviço', ['Serviço', 'Métricas'], [
  ['Web (HTTP/HTTPS)', 'Disponibilidade UP/DOWN por health check; requisições por segundo; latência (servidor, health check e sites externos); taxa de erro e contagem de 4xx e 5xx; conexões ativas; escore-z de anomalia'],
  ['Banco de dados', 'Disponibilidade; QPS; taxa de erros e rollbacks; conexões abertas e uso do pool; CPU, memória, I/O e latência de disco; tamanho (MB) e crescimento (MB/dia); slow queries (> 50 ms)'],
  ['DNS', 'Tempo de resposta de resolução; taxa de falhas; queries por segundo; disponibilidade de cada servidor de nomes'],
  ['SMTP', 'Taxa de entrega; tamanho da fila; latência de envio e da sonda; taxa de erros (rejeições e timeouts); volume por minuto e por hora'],
], [3.5, 12.5]));
add(p('Os painéis de cada serviço exibem essas métricas em gráficos, com seleção do período de análise. As Figuras 2 a 5 mostram os painéis do Web Server, do Banco de Dados, do DNS e do SMTP.'));
add(figure('prints/05-servico-web-periodo-1h.png', 'Painel do Web Server no período de 1 hora', 16, 'web1h'));
add(figure('prints/06-servico-database-15m.png', 'Painel do Banco de Dados nos últimos 15 minutos', 16, 'db'));
add(figure('prints/07-servico-dns-15m.png', 'Painel do DNS nos últimos 15 minutos', 16, 'dns'));
add(figure('prints/08-servico-smtp-15m.png', 'Painel do SMTP nos últimos 15 minutos', 16, 'smtp'));

add(h1('5 REGRAS DE ALERTA E NOTIFICAÇÃO'));
add(p('Cada regra define a métrica, o operador de comparação, um limite amarelo, um limite vermelho e a quantidade de amostras consecutivas necessárias para disparar. Os três níveis seguem o enunciado:'));
add(bullet('**Nível 1 – Verde (OK)**: nenhuma regra violada; estado normal.'));
add(bullet('**Nível 2 – Amarelo (Atenção)**: degradação que exige observação; notificação por e-mail, agrupada em um resumo a cada 60 segundos para evitar excesso de mensagens.'));
add(bullet('**Nível 3 – Vermelho (Crítico)**: serviço degradado ou indisponível; notificação imediata por e-mail e, quando o problema termina, uma mensagem de "resolvido".'));
add(p('Para evitar alarmes falsos, aplicou-se histerese: um pico isolado não dispara o alerta quando a regra exige duas amostras seguidas, e o retorno ao verde só ocorre após duas amostras normais. Isso evita o chamado _flapping_, em que um alerta abre e fecha repetidamente. Os limites podem ser alterados pela tela de Regras, com efeito imediato. A Tabela 4 mostra alguns exemplos.'));
add(table('Exemplos de regras de alerta', ['Regra', 'Métrica', 'Amarelo', 'Vermelho', 'Amostras'], [
  ['Web indisponível', 'up', '–', '< 1', '1'],
  ['Latência HTTP', 'latency_ms', '> 150 ms', '> 400 ms', '2'],
  ['Erros HTTP', 'error_rate', '> 12 %', '> 25 %', '2'],
  ['Possível DDoS', 'anomaly_z', '> 3', '> 6', '1'],
  ['Slow queries', 'slow_queries', '> 5', '> 20', '2'],
  ['Falhas DNS', 'failure_rate', '> 10 %', '> 30 %', '1'],
  ['Fila SMTP', 'queue_length', '> 30', '> 80', '2'],
  ['Entrega SMTP', 'delivery_rate', '< 90 %', '< 75 %', '2'],
  ['Força bruta', 'failed_logins_5min', '> 5', '> 15', '1'],
], [4, 4, 2.6, 2.6, 2.4]));
add(p('A Figura 6 mostra a tela de Regras, na qual os limiares e as amostras de cada alerta são editados.'));
add(figure('prints/12-aba-regras.png', 'Tela de Regras com os limiares de alerta', 16, 'regras'));
add(p('O envio usa a biblioteca nodemailer. Se nenhum servidor SMTP for configurado, a plataforma cria automaticamente uma conta de teste no serviço Ethereal, e cada alerta exibe um link para a mensagem enviada, o que permite demonstrar o fluxo de e-mail em sala sem expor credenciais reais. Com um servidor SMTP configurado (por exemplo, Gmail com senha de aplicativo), as mensagens chegam à caixa da equipe. A Figura 7 traz um e-mail de alerta aberto pelo link da plataforma.'));
add(figure('prints/21-email-alerta-critico-recebido.png', 'E-mail de alerta recebido pela equipe', 16, 'email'));

add(h1('6 SEGURANÇA E MONITORAMENTOS EXTRAS'));
add(h2('6.1 Detecção de anomalias de tráfego (DDoS)'));
add(p('O detector mantém uma janela móvel com as últimas 60 medições de requisições por segundo e calcula a média e o desvio padrão. Para cada nova medição é calculado o escore-z, isto é, quantos desvios padrão o valor está acima da média. Valores acima de 3 geram alerta amarelo e acima de 6, vermelho. Pontos considerados anômalos não entram na janela, para que um ataque prolongado não passe a ser visto como normal; e, ao reiniciar, a linha de base é reconstruída a partir do histórico gravado, descartando picos. Nos testes, o ataque simulado elevou o tráfego de cerca de 21 para 400 requisições por segundo, com escore-z próximo de 30. As Figuras 8 a 10 registram o disparo do cenário, a reação do mapa e as missões abertas.'));
add(figure('prints/15-cenario-ataque-ddos-1-disparo.png', 'Disparo do ataque DDoS no Simulador', 16, 'ddos1'));
add(figure('prints/16-cenario-ataque-ddos-2-mapa.png', 'Mapa durante o ataque DDoS', 16, 'ddos2'));
add(figure('prints/17-cenario-ataque-ddos-4-missoes.png', 'Missões abertas pelo ataque DDoS', 16, 'ddos3'));
add(h2('6.2 Falhas de autenticação e força bruta'));
add(p('Cada tentativa de login malsucedida é registrada com IP de origem e conta. Uma janela deslizante de cinco minutos conta as falhas por IP e por conta: cinco falhas do mesmo IP bloqueiam esse endereço por dez minutos, e oito falhas contra a mesma conta, vindas de IPs diferentes, sinalizam um ataque distribuído contra aquela conta. A tela de Segurança lista os IPs, a situação de bloqueio e as contas visadas.'));
add(h2('6.3 Alterações de configuração'));
add(p('Os arquivos de configuração monitorados (nginx.conf, postgresql.conf, named.conf.options e postfix-main.cf) têm seu hash SHA-256 calculado a cada três segundos e comparado com a linha de base armazenada. Qualquer diferença gera um evento com o hash anterior, o novo hash e as linhas alteradas, além de um alerta que permanece aberto até ser reconhecido por um operador.'));
add(h2('6.4 Vulnerabilidades conhecidas por serviço'));
add(p('Cada serviço possui um inventário com o software e a versão instalada. A plataforma consulta a API pública OSV.dev, mantida pelo Google, que agrega avisos de segurança de diversas fontes, inclusive do Debian. Na execução de teste, a consulta retornou avisos reais para as versões cadastradas do nginx, do PostgreSQL 13 e do BIND 9, cada um com os CVEs relacionados e a versão que corrige o problema. As dependências da própria plataforma também são verificadas. A Figura 11 apresenta a tela de Segurança, que reúne esses resultados.'));
add(figure('prints/10-aba-seguranca.png', 'Tela de Segurança da plataforma', 16, 'seg'));
add(h2('6.5 Proteções da própria plataforma'));
add(p('A API exige token JWT; o login tem limite de requisições por minuto; o servidor usa cabeçalhos de segurança HTTP (helmet); o WebSocket só aceita conexões autenticadas; e a ingestão externa exige chave de API.'));

add(h1('7 INTERFACE GAMIFICADA'));
add(p(`A visão consolidada é um mapa em pixel art desenhado em Canvas 2D com arte original, gerada em código. Cada serviço ocupa uma sala, e o operador de cada sala exibe a métrica principal em um balão de fala. O estado do serviço muda a cena: em amarelo, a sala pisca e o operador mostra um sinal de exclamação; em vermelho, uma sirene gira e o operador corre; quando o serviço cai, a sala apaga e solta fumaça. Os eventos de segurança também são representados: insetos invadem a sala dos servidores durante um DDoS, figuras encapuzadas aparecem na porta da guarita durante a força bruta e um papel voa até o guarda quando uma configuração muda (Figura ${FIG('mapa')}).`));
add(figure('desktop-mapa.png', 'Visão consolidada do PixelNOC', 16, 'mapa'));
add(p(`Ao clicar em uma sala, abre-se o dashboard do serviço, com indicadores atuais, alertas ativos e gráficos de todas as métricas, em períodos de 15 minutos a 24 horas (Figura ${FIG('dashweb')}). Barras de "vida" no topo mostram a disponibilidade de cada serviço na última hora, e os alertas aparecem como "missões" em um quadro próprio, com link para o e-mail enviado. O layout é responsivo e se reorganiza em uma coluna no celular.`));
add(figure('desktop-servico-web.png', 'Dashboard do serviço Web', 16, 'dashweb'));
add(figure('alerta-critico.png', 'Quadro de missões com alerta crítico', 16, 'alertacrit'));
add(p(`As Figuras ${FIG('missoes')} e ${FIG('filtro')} mostram o quadro de missões sem alertas ativos e o histórico filtrado por alertas críticos.`));
add(figure('prints/09-aba-missoes-sem-alertas.png', 'Quadro de missões sem alertas ativos', 16, 'missoes'));
add(figure('prints/44-missoes-filtro-criticos.png', 'Histórico de missões filtrado por alertas críticos', 16, 'filtro'));

add(h1('8 TESTES'));
add(p('Foram feitos três tipos de teste. Os testes unitários (Vitest) cobrem a lógica de classificação e histerese dos alertas, o detector de anomalias, o detector de força bruta e o diff de configuração, totalizando 14 casos aprovados. Os testes de navegação e uso (Playwright) simulam um usuário em dois perfis de tela, desktop (1440 × 900) e celular (Pixel 7), conforme a Tabela 5.'));
add(table('Testes automatizados de navegação', ['ID', 'Caso de teste', 'Resultado esperado', 'Desktop', 'Celular'], [
  ['CT01', 'Acessar página protegida sem login', 'Redireciona para o login', 'Aprovado', 'Aprovado'],
  ['CT02', 'Login com senha errada', 'Mensagem de erro e falha registrada', 'Aprovado', 'Aprovado'],
  ['CT03', 'Visão consolidada', '6 salas, 4 cartões, indicador "ao vivo"', 'Aprovado', 'Aprovado'],
  ['CT04', 'Dashboard de cada serviço', 'Painel abre com gráficos e fecha com ESC', 'Aprovado', 'Aprovado'],
  ['CT05', 'Navegação pelas 5 abas', 'Cada página carrega', 'Aprovado', 'Aprovado'],
  ['CT06', 'Derrubar o Web Server', 'Alerta crítico em até 30 s', 'Aprovado', 'N/A'],
  ['CT07', 'Editar limiar de regra', 'Confirmação "Regras salvas"', 'Aprovado', 'N/A'],
], [1.3, 4.2, 5.5, 2.5, 2.5]));
add(p(`As Figuras ${FIG('login')} a ${FIG('logout')} documentam a execução dos testes: o redirecionamento ao login (CT01), a visão consolidada (CT03), o Simulador de incidentes usado nos cenários e as telas em celular, encerrando com a saída da sessão.`));
add(figure('prints/01-login-rota-protegida-redireciona.png', 'Redirecionamento ao login ao acessar página protegida', 16, 'login'));
add(figure('prints/03-mapa-visao-consolidada.png', 'Visão consolidada após o login', 16, 'mapa2'));
add(figure('prints/14-aba-simulador.png', 'Simulador de incidentes', 16, 'sim'));
add(figure('prints/46-mobile-mapa.png', 'Visão consolidada em celular', 7, 'mobmapa'));
add(figure('prints/47-mobile-servico-web.png', 'Painel do Web Server em celular', 7, 'mobweb'));
add(figure('prints/50-mobile-aba-regras.png', 'Tela de Regras em celular', 7, 'mobregras'));
add(figure('prints/51-mobile-aba-simulador.png', 'Simulador de incidentes em celular', 7, 'mobsim'));
add(figure('prints/52-logout.png', 'Tela de login após encerrar a sessão', 16, 'logout'));
add(p('Por fim, cada cenário do simulador (DDoS, queda do servidor web, erros 5xx, banco lento, falha de DNS, fila de e-mail, força bruta e alteração de configuração) foi executado manualmente, verificando o alerta, o e-mail e a reação do mapa. Durante o cenário de DDoS observou-se um efeito colateral real: o gerador de ataque, ao abrir uma conexão TCP nova por requisição, esgotou as portas efêmeras do sistema operacional, e o envio de e-mail falhou com o erro EADDRINUSE. O problema foi corrigido com conexões persistentes (_keep-alive_) e ilustra bem como um ataque volumétrico afeta a pilha TCP do próprio host.'));

add(h1('9 DOCUMENTAÇÃO OPERACIONAL'));
add(p('O repositório inclui a documentação exigida, em formato Markdown, na pasta docs:'));
add(bullet('**Arquitetura** (arquitetura.md): componentes, fluxo de dados, modelo de dados e API.'));
add(bullet('**Guia de instalação** (instalacao.md): requisitos (Node.js 22.13 ou superior), instalação com npm install, execução com npm run dev, configuração do e-mail e solução de problemas.'));
add(bullet('**Runbooks** (runbooks.md): para cada alerta de cada serviço, o caminho sintoma, diagnóstico, ação e verificação. O diagnóstico de rede segue as camadas, do ping (camada 3) ao teste de porta TCP (camada 4) e à requisição HTTP (camada 7).'));
add(bullet('**Playbooks de incidentes** (playbooks.md): DDoS, força bruta, alteração de configuração, serviço fora do ar e vulnerabilidade conhecida, organizados nas fases de detecção, triagem, contenção, erradicação, recuperação e pós-incidente propostas pelo NIST (2012).'));
add(bullet('**Testes** (testes.md) e **roteiro da apresentação** (apresentacao.md).'));

add(h1('10 CONCLUSÃO'));
add(p('O PixelNOC atende aos requisitos do trabalho: monitora web, banco de dados, DNS e SMTP com as métricas recomendadas; armazena as séries históricas; classifica o estado em três níveis com notificação por e-mail; e inclui detecção de DDoS, de força bruta, de alteração de configuração e de vulnerabilidades conhecidas. A combinação de medições reais na Internet com um ambiente de demonstração controlado mostrou-se adequada para validar o funcionamento e para apresentar incidentes ao vivo.'));
add(p('O desenvolvimento permitiu aplicar na prática conceitos da disciplina: a diferença entre falhas de camada de transporte (conexão recusada ou tempo esgotado) e de aplicação (códigos HTTP 5xx, respostas SMTP 4xx e 5xx, NXDOMAIN no DNS), o papel do DNS como dependência de todos os serviços e o impacto de um ataque volumétrico sobre a pilha TCP.'));
add(p('Como trabalhos futuros, sugerem-se: substituir o SQLite por um banco de séries temporais, como TimescaleDB ou InfluxDB; coletar métricas diretamente de servidores nginx, PostgreSQL, BIND e Postfix por meio de agentes; enviar notificações por outros canais, como Telegram ou Slack; e executar o monitor em uma rede separada, para que ele continue funcionando quando a rede monitorada falhar.'));

// ---------- pós-textuais ----------
const ref = (t) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 240, after: 240 }, children: parseInline(t) });
add(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, pageBreakBefore: true, children: [new TextRun({ text: 'REFERÊNCIAS', font: FONT, size: 24, bold: true })] }));
[
  'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **NBR 14724**: informação e documentação: trabalhos acadêmicos: apresentação. Rio de Janeiro: ABNT, 2011.',
  'BEYER, B.; JONES, C.; PETOFF, J.; MURPHY, N. R. **Site reliability engineering**: how Google runs production systems. Sebastopol: O\'Reilly Media, 2016.',
  'FIELDING, R.; NOTTINGHAM, M.; RESCHKE, J. **RFC 9110**: HTTP semantics. [S. l.]: IETF, 2022. Disponível em: https://www.rfc-editor.org/rfc/rfc9110. Acesso em: 17 nov. 2026.',
  'KIM, G.; HUMBLE, J.; DEBOIS, P.; WILLIS, J. **The DevOps handbook**: how to create world-class agility, reliability, and security in technology organizations. Portland: IT Revolution Press, 2016.',
  'KLENSIN, J. **RFC 5321**: simple mail transfer protocol. [S. l.]: IETF, 2008. Disponível em: https://www.rfc-editor.org/rfc/rfc5321. Acesso em: 17 nov. 2026.',
  'KUROSE, J. F.; ROSS, K. W. **Redes de computadores e a Internet**: uma abordagem top-down. 8. ed. São Paulo: Pearson, 2021.',
  'MOCKAPETRIS, P. **RFC 1035**: domain names: implementation and specification. [S. l.]: IETF, 1987. Disponível em: https://www.rfc-editor.org/rfc/rfc1035. Acesso em: 17 nov. 2026.',
  'NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY. **SP 800-61 Rev. 2**: computer security incident handling guide. Gaithersburg: NIST, 2012.',
  'OSV. **Open Source Vulnerabilities**: a distributed vulnerability database for open source. [S. l.], 2026. Disponível em: https://osv.dev. Acesso em: 17 nov. 2026.',
  'TANENBAUM, A. S.; FEAMSTER, N.; WETHERALL, D. **Redes de computadores**. 6. ed. Porto Alegre: Bookman, 2021.',
].forEach((r) => add(ref(r)));

add(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, pageBreakBefore: true, children: [new TextRun({ text: 'APÊNDICE A – TELAS DA PLATAFORMA', font: FONT, size: 24, bold: true })] }));
add(figure('desktop-servico-database.png', 'Dashboard do Banco de Dados', 15));
add(figure('desktop-servico-dns.png', 'Dashboard do DNS', 15));
add(figure('desktop-servico-smtp.png', 'Dashboard do SMTP', 15));
add(figure('desktop-aba-seguranca.png', 'Tela de Segurança', 15));
add(figure('desktop-aba-simulador.png', 'Simulador de incidentes', 15));
add(figure('desktop-aba-regras.png', 'Edição das regras de alerta', 15));
add(figure('mobile-mapa.png', 'Visão consolidada em celular', 7));

// ---------- documento ----------
const page = { size: { width: 21 * CM, height: 29.7 * CM }, margin: { top: 3 * CM, left: 3 * CM, bottom: 2 * CM, right: 2 * CM, header: Math.round(2 * CM), footer: 0 } };
const doc = new Document({
  creator: 'PixelNOC',
  title: TITULO,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 0, after: 360, line: LINE15 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 360, after: 240, line: LINE15 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [
    { properties: { page }, children: [...capa, ...rosto, ...resumo, ...sumario] },
    {
      // ABNT: páginas contadas a partir da folha de rosto (capa não conta) → introdução = 4
      properties: { page: { ...page, pageNumbers: { start: 4 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      footers: { default: new Footer({ children: [] }) },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(REPO, 'relatorio', 'Relatorio-PixelNOC-ABNT.docx');
  fs.writeFileSync(out, buf);
  console.log('ok', out, figN, 'figuras', tabN, 'tabelas');
});
