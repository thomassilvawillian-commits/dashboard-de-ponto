# Dashboard de Controle de Ponto

Aplicação web para registrar a jornada de trabalho, acompanhar horas trabalhadas e consultar o banco de horas dos funcionários. O sistema reúne o ponto individual e um painel exclusivo para a gerente de RH, com indicadores mensais e exportação de relatórios.

**Software criado por Willian Thomas.**

## Funcionalidades

### Área do funcionário

- Cadastro e login com nome e PIN de quatro números.
- Registro de entrada, saída para almoço, retorno do almoço e saída.
- Lançamento de horários esquecidos, com motivo opcional.
- Consulta e exclusão dos próprios lançamentos manuais.
- Histórico mensal com horários, horas trabalhadas, atrasos e saldo diário.
- Indicadores de dias completos, faltas, atrasos e saldo do mês.
- Identificação de dias completos, incompletos, de folga e em andamento.

### Painel exclusivo de RH

- Visão geral de todos os funcionários por mês.
- Indicadores de horas trabalhadas, extras, faltantes, saldo mensal e banco acumulado.
- Busca por nome e filtros de funcionários ativos, inativos e com pendências.
- Detalhamento das marcações diárias ao selecionar um funcionário.
- Exportação do resumo mensal e do espelho de ponto em CSV.
- Indicadores e exportações que acompanham a seleção de funcionários.
- Acesso restrito a uma única conta de RH, configurada pelo responsável na planilha.

A interface se adapta a computadores e celulares. O crédito do autor aparece no canto inferior direito, inclusive na tela de login.

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| HTML5 e CSS3 | Estrutura, aparência e adaptação da interface às telas. |
| JavaScript | Interações, apresentação dos dados e geração dos arquivos CSV. |
| Google Apps Script | Autenticação, permissões, registros e cálculos de jornada. |
| Google Sheets | Armazenamento dos cadastros, jornadas e marcações. |
| Google Fonts | Fontes Inter e IBM Plex Mono. |

O navegador se comunica com o Apps Script por meio de `google.script.run`. O servidor consulta a planilha vinculada, valida a sessão e devolve os dados permitidos para cada usuário.

A aplicação funciona como um **app da Web do Google Apps Script**. A instalação é feita pelo editor do Google, sem etapa de build ou instalação de dependências. Abrir apenas o HTML localmente não disponibiliza login, registros ou consultas à planilha.

## Arquivos do projeto

| Arquivo | Conteúdo |
| --- | --- |
| [Codigos/codigo.gs](Codigos/codigo.gs) | Código do servidor: contas, sessões, registros, cálculos e consultas do RH. |
| [Codigos/index.html](Codigos/index.html) | Interface completa, incluindo HTML, CSS e JavaScript. |
| [Ponto_Base.xlsx](Ponto_Base.xlsx) | Modelo inicial da planilha, com as abas `Funcionarios` e `Registros` e dois cadastros fictícios. |
| [PASSO_A_PASSO.md](PASSO_A_PASSO.md) | Guia complementar de configuração e atualização. |
| [README.md](README.md) | Apresentação e documentação do projeto. |

Os arquivos de código ficam na pasta `Codigos`. O README, o tutorial e a planilha-base ficam na raiz do repositório.

## Instalação

### 1. Preparar a planilha

Use o modelo [Ponto_Base.xlsx](Ponto_Base.xlsx): envie-o ao Google Drive, abra no Planilhas Google e escolha **Arquivo → Salvar como Google Planilhas**. Na cópia convertida, exclua as duas linhas de exemplo da aba **Funcionarios**, preservando os cabeçalhos. A aba **Registros** já contém apenas os cabeçalhos. Consulte o [tutorial](PASSO_A_PASSO.md) para seguir as etapas.

Como alternativa, crie uma planilha no Google Sheets com as abas **Funcionarios** e **Registros**, respeitando a grafia dos nomes.

Na primeira linha de **Funcionarios**, use os cabeçalhos abaixo. O bloco está separado por tabulações e pode ser colado na célula A1:

```tsv
ID	Nome	PIN	Nivel	Entrada	SaidaAlmoco	RetornoAlmoco	Saida	JornadaDiariaHoras	DiasTrabalho	Ativo	DataInicio	SaldoInicialMin	DataFim
```

Na primeira linha de **Registros**, use estes cabeçalhos, nesta ordem:

```tsv
Timestamp	FuncionarioID	Nome	Data	Tipo	Origem	Status	Observacao	SolicitacaoID	SolicitadoEm	DecididoPor	DecididoEm
```

O código espera que as duas abas já existam. Os cadastros e as marcações são preenchidos pelo sistema após a configuração.

Se estiver atualizando uma instalação existente, preserve as linhas de dados e confira os cabeçalhos. A configuração de RH acrescenta as colunas `DataInicio`, `SaldoInicialMin` e `DataFim` quando estiverem ausentes.

Configure o fuso horário da planilha de acordo com a operação. Para o horário de Brasília, use **America/Sao_Paulo**. O servidor usa o fuso da planilha para validar horários e apurar a jornada.

### 2. Adicionar o código no Apps Script

1. Na planilha, abra **Extensões → Apps Script**.
2. Copie o conteúdo de `Codigos/codigo.gs` para o arquivo de script do projeto, como `Código.gs`.
3. Crie um arquivo HTML chamado **Index** e cole todo o conteúdo de `Codigos/index.html`.
4. Salve o projeto.

O nome do arquivo HTML no editor deve ser **Index**, pois a função `doGet()` carrega `HtmlService.createTemplateFromFile('Index')`.

### 3. Configurar a conta de RH

1. Recarregue a planilha.
2. Abra **Controle de Ponto → Configurar conta exclusiva de RH**.
3. Autorize a execução, se solicitado pelo Google.
4. Informe o nome de login da gerente, defina um PIN de quatro números e confirme.
5. Confirme a configuração da conta.

Se o menu não aparecer, execute `onOpen` no editor do Apps Script e volte à planilha.

A configuração cria a conta ou atualiza uma conta com o mesmo nome. Se outra conta for configurada posteriormente, a anterior perde a autorização para consultar o painel de RH. O cadastro pela tela **Criar conta** concede apenas o perfil de funcionário.

### 4. Conferir as jornadas

Os novos cadastros recebem a jornada padrão de **8 horas, de segunda a sexta-feira**, com entrada às 09:00, almoço das 12:00 às 13:00 e saída às 18:00. Ajuste a aba **Funcionarios** para refletir a jornada de cada pessoa.

| Campo | Configuração |
| --- | --- |
| `ID` | Identificador único do funcionário, gerado no cadastro. |
| `Entrada`, `SaidaAlmoco`, `RetornoAlmoco`, `Saida` | Horários de referência, como `09:00`. |
| `JornadaDiariaHoras` | Carga diária esperada em horas, como `8`. |
| `DiasTrabalho` | Dias previstos separados por vírgulas, como `SEG,TER,QUA,QUI,SEX`. |
| `Ativo` | `1` permite acesso; `0` indica cadastro inativo. |
| `DataInicio` | Primeiro dia de apuração, em `AAAA-MM-DD`. |
| `SaldoInicialMin` | Saldo anterior em minutos: `120` representa +2h; `-90` representa −1h30. |
| `DataFim` | Último dia de apuração, em `AAAA-MM-DD`; deixe vazio enquanto não houver término. |

Para cadastros antigos, revise a data inicial sugerida a partir das marcações aprovadas. Sem marcações, a configuração usa o dia atual. Para um funcionário inativo sem `DataFim`, a apuração termina na última marcação aprovada disponível.

Se a conta de RH servir apenas para administração, configure `JornadaDiariaHoras` como `0` e deixe `DiasTrabalho` vazio, para que ela não acumule débitos por ausência de registros.

### 5. Publicar o app

1. No Apps Script, abra **Implantar → Nova implantação**.
2. Selecione o tipo **App da Web**.
3. Configure a execução como a conta responsável pelo script e pela planilha.
4. Defina quem poderá acessar de acordo com o público do sistema e as permissões da organização.
5. Clique em **Implantar**, conclua as autorizações e copie a URL do app.

Distribua o link do aplicativo aos funcionários. O acesso de edição à planilha e ao script deve ficar com os responsáveis pela administração dos dados e das contas.

Consulte também o [guia oficial de apps da Web do Google Apps Script](https://developers.google.com/apps-script/guides/web).

## Uso diário

O funcionário acessa o link, entra com seu nome e PIN e usa o botão de registro para a próxima marcação do dia. A sequência é **entrada → saída para almoço → retorno do almoço → saída**.

Para incluir uma marcação esquecida, selecione **Registrar horário esquecido**, informe data, tipo e horário e confirme. O servidor verifica duplicidade, horário futuro e ordem das marcações. Nesta versão, lançamentos manuais válidos são gravados como aprovados imediatamente; não há uma etapa de aprovação pela gerente.

A gerente entra pelo mesmo link. O **Painel de RH** abre automaticamente e a aba **Meu ponto** continua disponível. No painel, selecione o mês, use a busca ou os filtros e clique no nome de uma pessoa para conferir os registros diários. O botão **Atualizar** consulta novamente os dados da planilha.

## Relatórios

| Botão | Arquivo | Conteúdo |
| --- | --- | --- |
| **Baixar resumo** | `resumo_rh_AAAA-MM.csv` | Uma linha por funcionário, com horas, saldos, faltas e pendências. |
| **Espelho do mês** | `espelho_rh_AAAA-MM.csv` | Marcações e resultados diários dos funcionários selecionados. |

Os arquivos usam ponto e vírgula como separador e UTF-8 com BOM. Podem ser abertos ou importados no Excel, Google Sheets e outros editores de planilhas. As durações são exportadas como texto, por exemplo `8h30` e `-1h00`.

## Regras do banco de horas

| Indicador | Regra aplicada |
| --- | --- |
| Horas trabalhadas | Soma dos intervalos encerrados entre entrada e saída para almoço, e entre retorno e saída. |
| Horas extras | Diferenças positivas entre horas trabalhadas e jornada esperada, em dias com quatro marcações válidas. |
| Horas faltantes | Diferenças negativas em dias completos e jornada prevista de dias encerrados sem registros. |
| Saldo do mês | Total de horas extras menos total de horas faltantes do mês selecionado. |
| Banco acumulado | Saldo inicial mais os saldos desde `DataInicio`, até o fim do mês selecionado, limitado ao dia atual e a `DataFim`. |
| Pendências | Dias com registros incompletos, duplicados ou fora de ordem; não geram crédito ou débito até a correção. |

- Dias futuros e datas fora do período de apuração não geram faltas.
- O dia atual sem registros fica em andamento; com quatro marcações válidas, já pode ser apurado.
- Em um dia incompleto, pares válidos encerrados podem somar horas trabalhadas, mas o saldo permanece pendente.
- Trabalho com quatro marcações válidas em dia de folga entra como hora extra.
- O cálculo considera apenas registros com status `APROVADO`.

**Exemplo:** 2h extras e 1h faltante resultam em saldo mensal de +1h. Com saldo anterior de +3h e sem outros movimentos, o banco acumulado fica em +4h.

## Autenticação e permissões

- Novos PINs são armazenados como hash SHA-256 com salt individual, em vez do valor original.
- A autenticação mantém compatibilidade com PINs antigos em texto; não há migração automática desses registros no login.
- A sessão usa um token aleatório e tem validade máxima de seis horas. O cache pode expirar antes e exigir novo login.
- O servidor valida a sessão, a situação ativa do cadastro e a permissão de RH em cada consulta protegida.
- O acesso de RH exige `Nivel = RH` e correspondência com o ID definido na propriedade `PONTO_GERENTE_RH_ID` do script.
- Há limitação de tentativas de login por nome, com bloqueio após cinco falhas dentro da janela de até 15 minutos, enquanto o contador permanecer no cache.

O PIN de quatro números é uma forma simples de autenticação. A visibilidade do aplicativo também depende das permissões escolhidas na implantação do Google.

## Limites da versão atual

- A jornada completa exige quatro marcações no mesmo dia, com um intervalo de almoço.
- Feriados, férias, abonos e afastamentos não recebem tratamento automático.
- Turnos que atravessam a meia-noite não são contemplados.
- O sistema apura tempo excedente e faltante; não calcula valores de pagamento, adicionais ou descontos na folha.
- Compensações pagas e baixas no banco de horas não têm um fluxo próprio.
- Alterações na jornada cadastrada afetam o histórico recalculado; não existe uma tabela de jornadas por período.
- Alterações administrativas em cadastros e jornadas são feitas na planilha.

## Atualizar uma instalação

1. Substitua o conteúdo dos arquivos alterados no Apps Script e salve.
2. Abra **Implantar → Gerenciar implantações**.
3. Selecione a implantação ativa e clique no ícone de edição.
4. Escolha **Nova versão** e clique em **Implantar**.
5. Reabra o link do aplicativo e confira a alteração.

Atualizar a implantação existente mantém a mesma URL. Salvar o código no editor, sozinho, não atualiza a versão publicada. Veja a [documentação oficial de implantações](https://developers.google.com/apps-script/concepts/deployments).

Depois de instalar ou atualizar, confira um dia de jornada conhecido, compare os totais mensais, teste os dois relatórios e verifique o acesso com uma conta comum e com a conta de RH.

## Autor

**Willian Thomas** — desenvolvimento do Dashboard de Controle de Ponto.

Crédito exibido na aplicação: **Software criado por Willian Thomas**.
