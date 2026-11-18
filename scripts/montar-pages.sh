#!/usr/bin/env bash
set -euo pipefail

# O pacote usa os arquivos rastreados no commit, sem os downloads da execução.
mkdir -p site-publicado
git archive HEAD -- \
  index.html fornecedores.js painel.js painel.css painel-loa-theme.css \
  pagamentos-dados.json loa-2026 sdpp |
  tar -xf - -C site-publicado

rm -f site-publicado/loa-2026/fonte.csv \
  site-publicado/loa-2026/fonte-meta.json \
  site-publicado/loa-2026/dados-novos.json
