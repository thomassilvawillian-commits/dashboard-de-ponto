#!/usr/bin/env bash
# Gera release/ControleDePonto-Windows.zip: programa portátil para Windows (64 bits),
# com o Node.js incluído. Basta extrair e abrir "Abrir Controle de Ponto".
#
#   npm ci && bash scripts/empacotar-windows.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release"
STAGE="$OUT/ControleDePonto"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "> Compilando"
(cd "$ROOT" && npm run build)

echo "> Montando a pasta do programa"
rm -rf "$STAGE" "$OUT/ControleDePonto-Windows.zip"
mkdir -p "$STAGE/app/server" "$STAGE/app/web" "$STAGE/app/node"
cp -r "$ROOT/server/dist" "$STAGE/app/server/dist"
cp "$ROOT/server/package.json" "$STAGE/app/server/package.json"
cp -r "$ROOT/web/dist" "$STAGE/app/web/dist"
find "$STAGE/app/server/dist" -name '*.map' -delete
(cd "$STAGE/app/server" && npm install --omit=dev --no-package-lock --no-audit --no-fund --loglevel=error)

echo "> Baixando o Node.js $NODE_MAJOR para Windows"
SUMS="$(curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt")"
LINE="$(echo "$SUMS" | grep -E ' node-v[0-9.]+-win-x64\.zip$')"
FILE="$(echo "$LINE" | awk '{print $2}')"
TMP="$(mktemp -d)"
curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$FILE" -o "$TMP/$FILE"
(cd "$TMP" && echo "$LINE" | sha256sum -c --quiet -)
unzip -q -j "$TMP/$FILE" "${FILE%.zip}/node.exe" "${FILE%.zip}/LICENSE" -d "$STAGE/app/node"
rm -rf "$TMP"

crlf() { sed 's/$/\r/' > "$1"; }

crlf "$STAGE/Abrir Controle de Ponto.bat" <<'BAT'
@echo off
chcp 65001 >nul
title Controle de Ponto
cd /d "%~dp0"
set "DATA_DIR=%~dp0dados"
"%~dp0app\node\node.exe" "%~dp0app\server\dist\desktop.js"
if errorlevel 1 (
  echo.
  echo Não foi possível abrir o Controle de Ponto. Tire uma foto desta tela e envie para quem instalou o sistema.
  pause
)
BAT

crlf "$STAGE/Importar planilha antiga.bat" <<'BAT'
@echo off
chcp 65001 >nul
title Importar planilha antiga
cd /d "%~dp0"
if "%~1"=="" (
  echo Arraste o arquivo .xlsx da planilha antiga e solte em cima deste arquivo.
  echo Antes, feche a janela do Controle de Ponto se ela estiver aberta.
  pause
  exit /b
)
set "DATA_DIR=%~dp0dados"
"%~dp0app\node\node.exe" "%~dp0app\server\dist\scripts\importar-planilha.js" "%~1"
pause
BAT

crlf "$STAGE/LEIA-ME.txt" <<'TXT'
CONTROLE DE PONTO
Software criado por Willian Thomas

COMO ABRIR
1. Dê dois cliques em "Abrir Controle de Ponto".
2. O sistema abre sozinho no navegador. Na primeira vez, informe o nome da
   empresa e crie a conta do administrador (RH).
3. Deixe a janela preta aberta enquanto usar o sistema. Para encerrar, feche-a.

Se o Windows mostrar "O Windows protegeu o computador", clique em
"Mais informações" e depois em "Executar assim mesmo".
Se o Windows perguntar sobre o Firewall, clique em "Permitir" para que
celulares e outros computadores da mesma rede Wi-Fi também possam usar.

ONDE FICAM OS DADOS
Tudo fica na pasta "dados", ao lado deste arquivo. Não apague essa pasta.
Para fazer cópia de segurança: feche o sistema e copie a pasta "dados" para
um pendrive ou para a nuvem. Para restaurar, coloque a pasta de volta aqui.

USAR EM OUTROS APARELHOS
Com o sistema aberto neste computador, celulares e outros PCs conectados na
mesma rede podem usar o endereço que aparece na janela preta
(algo como http://192.168.0.10:3000).

TRAZER OS DADOS DA PLANILHA ANTIGA
1. Na planilha do Google, use Arquivo > Fazer download > Microsoft Excel (.xlsx).
2. Feche o Controle de Ponto.
3. Arraste o arquivo baixado e solte em cima de "Importar planilha antiga".
TXT

cp "$ROOT/LICENSE" "$STAGE/" 2>/dev/null || true

echo "> Compactando"
(cd "$OUT" && zip -qr -9 ControleDePonto-Windows.zip ControleDePonto)
echo "Pronto: $OUT/ControleDePonto-Windows.zip ($(du -h "$OUT/ControleDePonto-Windows.zip" | cut -f1))"
