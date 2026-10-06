# Guia de instalação — Dashboard de Controle de Ponto

Este guia configura o aplicativo no **Google Apps Script**, vinculado a uma planilha do **Google Sheets**. As funcionalidades, regras de cálculo e limitações estão no [README](README.md).

**Software criado por Willian Thomas.**

## Arquivos utilizados

| Arquivo | Uso |
| --- | --- |
| [Ponto_Base.xlsx](Ponto_Base.xlsx) | Modelo da planilha, com as abas `Funcionarios` e `Registros`. |
| [Codigos/codigo.gs](Codigos/codigo.gs) | Código do servidor: contas, sessões, marcações e cálculos. |
| [Codigos/index.html](Codigos/index.html) | Interface do dashboard. |

## 1. Preparar a planilha central

1. Acesse o Google Drive com a conta responsável pelo sistema.
2. Em **Novo → Upload de arquivo**, envie `Ponto_Base.xlsx`.
3. Abra o arquivo com o **Planilhas Google** e escolha **Arquivo → Salvar como Google Planilhas**. Continue na nova cópia, convertida para o formato do Google.
4. Renomeie a planilha para **Controle de Ponto**, ou outro nome de sua preferência.
5. Confira as abas **Funcionarios** e **Registros**, mantendo essa grafia.
6. Na aba **Funcionarios**, exclua as duas linhas de exemplo abaixo do cabeçalho. São cadastros fictícios com PINs de demonstração. Preserve a primeira linha.
7. A aba **Registros** deve começar apenas com os cabeçalhos. As marcações serão gravadas pelo aplicativo.
8. Configure o fuso horário da planilha conforme a operação. Para o horário de Brasília, use **America/Sao_Paulo**.

O modelo contém as 11 colunas iniciais de `Funcionarios`. As colunas `DataInicio`, `SaldoInicialMin` e `DataFim` serão adicionadas durante a configuração de RH. Os cabeçalhos completos estão no [README](README.md).

## 2. Adicionar os códigos

1. Na planilha convertida, abra **Extensões → Apps Script**.
2. Abra `Codigos/codigo.gs` em um editor de texto e copie todo o conteúdo.
3. No Apps Script, substitua o conteúdo do arquivo de script existente, como `Código.gs`, pelo código copiado.
4. Clique no **+** ao lado de **Arquivos**, escolha **HTML** e dê ao arquivo o nome **Index**, com a primeira letra maiúscula.
5. Abra `Codigos/index.html` em um editor de texto, copie todo o conteúdo e substitua o conteúdo padrão do arquivo HTML criado no Apps Script.
6. Salve o projeto.

No repositório, o arquivo é `Codigos/index.html`. **Dentro do Apps Script, ele precisa se chamar `Index.html`**, pois o servidor usa `HtmlService.createTemplateFromFile('Index')`.

Se o menu **Extensões** não aparecer, confira se você está na cópia convertida para o formato Google Planilhas.

## 3. Configurar a conta exclusiva de RH

1. Recarregue a planilha.
2. Abra o menu **Controle de Ponto → Configurar conta exclusiva de RH**.
3. Conclua as autorizações solicitadas pelo Google para o projeto.
4. Informe o nome de login da pessoa responsável pelo RH.
5. Defina um PIN de quatro números, repita-o e confirme a configuração.

Se o menu não aparecer, execute a função `onOpen` no editor do Apps Script e volte à planilha.

O menu cria ou atualiza a conta de RH e registra sua autorização no projeto. Somente essa conta tem acesso ao painel de RH. Se outra conta for configurada depois, ela assume esse acesso exclusivo.

Se a conta de RH servir apenas para administração, ajuste sua linha na aba **Funcionarios**: coloque `0` em `JornadaDiariaHoras` e deixe `DiasTrabalho` vazio.

## 4. Publicar o aplicativo

1. No Apps Script, abra **Implantar → Nova implantação**.
2. Selecione o tipo **App da Web**.
3. Configure **Executar como** para a conta responsável pelo script e pela planilha.
4. Defina quem poderá acessar conforme o público do sistema e as opções disponíveis na conta Google ou na organização.
5. Clique em **Implantar**, conclua as autorizações solicitadas e copie a URL do app da Web.
6. Abra essa URL para acessar o dashboard.

O link compartilhado com os usuários é o do **app da Web**. O acesso de edição à planilha e ao script deve ficar com os responsáveis pela administração.

## 5. Cadastrar funcionários e revisar jornadas

1. No link do aplicativo, cada funcionário pode usar **Criar conta**.
2. O cadastro pede nome, PIN de quatro números e confirmação do PIN.
3. Revise a jornada de cada pessoa na aba **Funcionarios** antes do uso regular.

Novas contas recebem o perfil `FUNCIONARIO`, jornada de oito horas, de segunda a sexta-feira, entrada às 09:00, almoço das 12:00 às 13:00 e saída às 18:00. A data inicial de apuração é o dia do cadastro.

| Campo | Como configurar |
| --- | --- |
| `ID` | Identificador gerado pelo sistema; mantenha-o para preservar o vínculo com as marcações. |
| `Nome` | Nome usado no login. |
| `PIN` | Novos cadastros armazenam um hash; use o fluxo de criação de conta. |
| `Nivel` | O cadastro comum recebe `FUNCIONARIO`; o acesso de RH é configurado pelo menu da planilha. |
| `Entrada`, `SaidaAlmoco`, `RetornoAlmoco`, `Saida` | Horários de referência, como `09:00`. |
| `JornadaDiariaHoras` | Jornada esperada em horas, como `8`. |
| `DiasTrabalho` | Dias separados por vírgulas, como `SEG,TER,QUA,QUI,SEX`. |
| `Ativo` | `1` para permitir acesso; `0` para desativar o cadastro. |
| `DataInicio` | Primeiro dia de apuração, em `AAAA-MM-DD`. |
| `SaldoInicialMin` | Saldo anterior em minutos: `120` significa +2h; `-90` significa −1h30. |
| `DataFim` | Último dia de apuração, em `AAAA-MM-DD`; deixe vazio enquanto não houver término. |

## 6. Usar o dashboard

- O funcionário entra com nome e PIN e registra **entrada → saída para almoço → retorno do almoço → saída**. O horário é registrado pelo servidor.
- Em **Meu ponto**, pode consultar seu mês e usar **Registrar horário esquecido**, informando data, marcação e horário, com motivo opcional.
- Lançamentos manuais válidos são aprovados imediatamente e entram nos cálculos. O funcionário também pode excluir seus próprios lançamentos manuais.
- A conta de RH acessa o **Painel de RH**, consulta funcionários e meses e pode baixar o **resumo** e o **espelho do mês** em CSV.
- A sessão fica no navegador por meio de `sessionStorage` e tem validade máxima de seis horas, podendo expirar antes.

As regras de faltas, pendências e banco de horas estão detalhadas no [README](README.md). Antes de liberar para a equipe, confira uma jornada conhecida, os totais, os relatórios e o acesso de cada perfil.

## 7. Atualizar uma instalação existente

1. Preserve os cadastros e as marcações da planilha em uso.
2. Substitua o conteúdo dos arquivos alterados no Apps Script e salve.
3. Abra **Implantar → Gerenciar implantações**.
4. Selecione a implantação ativa e clique no ícone de edição.
5. Escolha **Nova versão** e clique em **Implantar**.
6. Reabra o link e confira a alteração.

Atualizar a implantação existente mantém a URL. Salvar o código no editor, sozinho, não atualiza a versão publicada.

## Referências oficiais

- [Converter um arquivo Excel para o Google Planilhas](https://support.google.com/docs/answer/9331167?hl=pt-BR).
- [Publicar apps da Web no Google Apps Script](https://developers.google.com/apps-script/guides/web).
- [Criar e gerenciar implantações](https://developers.google.com/apps-script/concepts/deployments).
