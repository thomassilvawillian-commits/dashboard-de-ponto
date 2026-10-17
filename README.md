# Controle de Ponto

Programa gratuito de controle de ponto, espelho mensal e banco de horas, que roda no próprio computador. Não depende de planilha no Google Drive, de internet nem de servidor: basta baixar, extrair e dar dois cliques. O banco de dados é criado automaticamente na pasta do programa. Foi pensado para ser simples de usar por qualquer pessoa, com visual limpo, cores suaves e tema claro ou escuro.

### [⬇ Baixar para Windows](https://github.com/thomassilvawillian-commits/dashboard-de-ponto/releases/latest/download/ControleDePonto-Windows.zip)

Depois de baixar: clique com o botão direito no arquivo, escolha **Extrair tudo** e, na pasta extraída, dê dois cliques em **Abrir Controle de Ponto**. Veja [Como usar](#como-usar).

**Software criado por Willian Thomas.**

> A versão anterior, em Google Apps Script e Planilhas, está preservada em [`legacy/`](legacy/). Os cadastros e marcações dela podem ser importados (veja [Trazer os dados da planilha antiga](#trazer-os-dados-da-planilha-antiga)).

## Telas

| Registro de ponto | Painel do RH |
| --- | --- |
| ![Tela de registro de ponto](docs/telas/registro-de-ponto.png) | ![Painel do RH com a situação da equipe](docs/telas/painel.png) |

| Justificativa de falta | No celular |
| --- | --- |
| ![Espelho com a janela de justificar falta](docs/telas/justificar-falta.png) | <img src="docs/telas/celular.png" alt="Registro de ponto no celular" width="260"> |

As telas acima usam dados de demonstração.

## Como usar

### Instalar

1. Baixe o arquivo [ControleDePonto-Windows.zip](https://github.com/thomassilvawillian-commits/dashboard-de-ponto/releases/latest/download/ControleDePonto-Windows.zip) (cerca de 45 MB). Todas as versões ficam na página de [downloads](https://github.com/thomassilvawillian-commits/dashboard-de-ponto/releases).
2. Clique com o botão direito no arquivo e escolha **Extrair tudo**. Coloque a pasta num lugar fixo, como `Documentos`.
3. Dê dois cliques em **Abrir Controle de Ponto**.
4. Na primeira vez, informe o nome da empresa e crie a conta do administrador (RH).

Não é preciso instalar mais nada: o programa já traz tudo o que precisa. Uma janela preta fica aberta enquanto o sistema estiver em uso; para encerrar, basta fechá-la. Se abrir o atalho de novo com o sistema já aberto, ele apenas mostra a tela outra vez.

Na primeira vez, o Windows pode exibir avisos:

- **"O Windows protegeu o computador":** clique em **Mais informações** e depois em **Executar assim mesmo**. O aviso aparece porque o programa não tem assinatura digital paga.
- **Firewall:** clique em **Permitir** para que celulares e outros computadores da mesma rede possam usar o sistema. Se recusar, ele continua funcionando neste computador.

### Um computador para todos

O uso mais comum é deixar o programa num computador da empresa onde todos registram o ponto. Por isso, a opção **Sair da conta depois de registrar o ponto** vem ligada: 5 segundos após a marcação, o sistema sai da conta para a próxima pessoa. Ela pode ser desligada em *Configurações*.

### Celulares e outros computadores

Com o programa aberto, a janela preta mostra um endereço como `http://192.168.0.10:3000`. Qualquer celular ou computador conectado à **mesma rede Wi-Fi** pode abrir esse endereço no navegador e usar o sistema normalmente. Os dados continuam todos no computador onde o programa está aberto.

### Cópia de segurança

Todos os dados ficam na pasta `dados`, ao lado do atalho. Não apague essa pasta. Para fazer cópia de segurança, feche o programa e copie a pasta `dados` para um pendrive ou para a nuvem. Para restaurar, coloque a pasta de volta.

### Atualizar para uma versão nova

Feche o programa, baixe e extraia a versão nova e copie para ela a pasta `dados` da versão antiga.

### Trazer os dados da planilha antiga

1. Na planilha do Google, escolha **Arquivo → Fazer download → Microsoft Excel (.xlsx)**.
2. Feche o Controle de Ponto.
3. Arraste o arquivo baixado e solte em cima de **Importar planilha antiga**, na pasta do programa.

São importados os colaboradores (com jornada, data de início, saldo inicial e situação), os PINs e as marcações aprovadas. A conta de RH vira **Administrador**. Cada pessoa entra com o mesmo nome e PIN de antes e define uma senha pessoal no primeiro acesso. A importação pode ser repetida: o que já foi importado é ignorado.

## O que o sistema faz

### Para o colaborador

- Registro de ponto com um botão que diz a ação ("Registrar entrada", "Registrar saída"), usando o relógio do servidor e com proteção contra clique duplo.
- Marcações do dia, horas trabalhadas, jornada prevista e saldo do banco de horas.
- Espelho de ponto mensal com marcações, previsto, trabalhado e saldo de cada dia.
- Solicitação de ajuste: incluir um horário esquecido ou desconsiderar uma marcação errada, com motivo.
- **Justificativa de falta sem depender do RH:** no espelho, o próprio colaborador justifica a falta (atestado, consulta, motivo pessoal, folga combinada ou licença). O dia é abonado na hora; o RH vê todas as justificativas em *Feriados e ausências* e pode removê-las.
- Acompanhamento das solicitações (pendente, aprovada, recusada) e impressão do próprio espelho.
- Pode ser adicionado à tela inicial do celular como um aplicativo, com tema claro e escuro.

### Para o RH e os gestores

- **Painel:** quem está trabalhando agora e, para cada pessoa, horas do mês, saldo, banco de horas, faltas e atrasos.
- **Colaboradores:** cadastro completo (cargo, departamento, matrícula, perfil de acesso), senha temporária gerada pelo sistema, desligamento e reativação.
- **Jornadas por vigência:** horas previstas por dia da semana, entrada prevista e intervalo. Uma nova jornada vale a partir da data escolhida e não altera o cálculo do passado.
- **Aprovações:** fila de ajustes solicitados, com aprovação ou recusa e observação.
- **Correção direta:** incluir ou desconsiderar marcações de qualquer dia, sempre com motivo.
- **Feriados:** importação automática dos feriados nacionais (incluindo Sexta-feira Santa) e cadastro dos estaduais e municipais.
- **Ausências:** férias, atestados, licenças, abonos e folgas não geram falta; a compensação desconta do banco.
- **Banco de horas:** saldo inicial, pagamento de extras, descontos e correções lançados como movimentações.
- **Relatórios:** resumo mensal e espelho de ponto em CSV (abre direto no Excel) e espelho para impressão/PDF com campos de assinatura.
- **Configurações:** nome da empresa, fuso horário, tolerâncias, aprovação automática de ajustes e saída automática da conta em computador compartilhado.

### Perfis de acesso

| Perfil | Pode |
| --- | --- |
| Colaborador | Registrar ponto, ver o próprio espelho, justificar faltas e solicitar ajustes de horário. |
| Gestor | Tudo do colaborador, mais painel, espelhos da equipe, aprovações, correções de marcação, ausências e relatórios. |
| Administrador | Tudo do gestor, mais cadastros, jornadas, feriados, banco de horas e configurações. |

Pode haver vários gestores e administradores. O sistema impede remover o último administrador ativo.

## Regras de apuração

| Indicador | Regra |
| --- | --- |
| Horas trabalhadas | Soma dos pares de marcações (entrada → saída, retorno → saída...). Aceita qualquer número de pares no dia. |
| Dia completo | Número par de marcações. Número ímpar em dia passado fica **pendente** e não gera saldo até ser corrigido. |
| Saldo do dia | Trabalhado − previsto. Variações até a **tolerância diária** (padrão 10 min, CLT art. 58 §1º) não geram saldo. |
| Falta | Dia útil passado, dentro do período de apuração, sem marcações, sem feriado, sem ausência e sem justificativa. Debita a jornada do dia. |
| Falta justificada | Justificada pelo colaborador ou registrada pelo RH: não debita o banco de horas. Ajustes de horário continuam passando pela aprovação do RH. |
| Atraso | Primeira marcação depois da entrada prevista, acima da tolerância de atraso (padrão 5 min). |
| Feriado e folga | Não geram débito; trabalho nesses dias vira crédito. |
| Banco acumulado | Saldo inicial + saldos diários desde o início da apuração + movimentações lançadas, até o fim do mês consultado ou hoje. |

Alertas exibidos no espelho e no painel: intervalo menor que 1 hora em jornada acima de 6 horas, jornada acima de 10 horas, descanso menor que 11 horas entre um dia e outro e marcação ímpar.

O sistema apura horas; não calcula valores de folha de pagamento. Turnos que atravessam a meia-noite ainda não são contemplados: as marcações depois da meia-noite caem no dia seguinte.

## Tecnologia

| Parte | Tecnologia |
| --- | --- |
| Servidor | Node.js 22, Express 5, TypeScript, validação com Zod |
| Banco de dados | PostgreSQL embutido via PGlite, gravado na pasta `dados` (ou PostgreSQL externo, opcional) |
| Interface | React 19, React Router, Tailwind CSS 4, ícones Lucide |
| Testes | Vitest e Supertest, executados nos dois bancos |

Programa para Windows: pasta portátil com Node.js incluído, gerada automaticamente pelo GitHub Actions.

Segurança: senhas com scrypt e salt individual, sessão em cookie `HttpOnly`/`SameSite`, bloqueio após 5 tentativas de login em 15 minutos, permissões verificadas no servidor em toda requisição, API que aceita apenas JSON e proteção contra fórmulas em arquivos CSV.

## Para desenvolvedores

Pré-requisito: [Node.js 22](https://nodejs.org).

```bash
npm install
npm run build
npm run desktop -w server     # abre como o programa: dados em ./dados e navegador automático
```

Com dados de demonstração (usuário `admin`, senha `demo1234`):

```bash
DATA_DIR=./data-demo npm run demo -w server
DATA_DIR=./data-demo npm start
```

Para desenvolver com recarga automática, rode `npm run dev:server` e `npm run dev:web` em dois terminais e abra <http://localhost:5173>.

### Gerar o pacote para Windows

```bash
bash scripts/empacotar-windows.sh    # cria release/ControleDePonto-Windows.zip
```

O script compila o projeto, baixa o Node.js para Windows do site oficial (conferindo o SHA-256) e monta a pasta com os atalhos. Ao enviar uma tag de versão (`git tag v2.1.0 && git push origin v2.1.0`), o GitHub Actions gera o pacote e o publica na página de downloads.

### Usar com PostgreSQL (opcional)

O programa usa um PostgreSQL embutido (PGlite), gravado em arquivos na pasta `dados`. Também é possível rodar como servidor com um PostgreSQL externo, definindo `DATABASE_URL`; as tabelas são criadas automaticamente.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL externo. Vazio usa o banco embutido. |
| `DATA_DIR` | `./data` (`dados` no programa) | Pasta do banco embutido. |
| `PORT` | `3000` | Porta HTTP. |
| `SESSION_HOURS` | `12` | Duração da sessão. |
| `NODE_ENV` | — | `production` ativa cookies seguros, que exigem HTTPS. |

O comando de importação também funciona aqui: `npm run importar-planilha -- caminho/planilha.xlsx`.

## Estrutura do projeto

```
server/            API, regras de apuração e banco de dados
  src/domain/      cálculo da jornada, fuso horário e feriados (funções puras)
  src/routes/      rotas da API (autenticação, colaborador, gestão)
  src/services/    acesso aos dados e regras compartilhadas
  src/desktop.ts   modo programa: banco na pasta dados e abertura do navegador
  src/scripts/     importação da planilha e dados de demonstração
  test/            testes de cálculo e da API
web/               interface React
scripts/           geração do pacote para Windows
docs/telas/        capturas de tela usadas neste README
legacy/            versão 1 em Google Apps Script
```

## Testes

```bash
npm test                                             # banco embutido
TEST_DATABASE_URL=postgres://... npm test            # PostgreSQL real (o banco é apagado)
```

O GitHub Actions roda a verificação de tipos, os testes nos dois bancos e o build a cada envio.

## Autor

**Willian Thomas** — desenvolvimento do Controle de Ponto.
