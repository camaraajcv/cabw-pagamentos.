#!/usr/bin/env python3
"""Publica o painel de pagamentos usando a mesma estrutura visual do LOA 2026."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

dataset_path=Path("novo-dataset.json")
template_path=Path("painel-template.html")
html_file=Path("index.html")

dataset=dataset_path.read_text(encoding="utf-8")
parsed=json.loads(dataset)
if not parsed.get("rows") or not parsed.get("months"):
    raise SystemExit("Dataset de pagamentos vazio ou invalido.")
if not template_path.exists():
    raise SystemExit("Template visual do painel nao localizado.")

template=template_path.read_text(encoding="utf-8")
if template.count("__DATASET__")!=1:
    raise SystemExit("Placeholder de dataset invalido no template.")
if template.count("__UPDATED_AT__")!=1:
    raise SystemExit("Placeholder de atualizacao invalido no template.")

now=datetime.now(ZoneInfo("America/New_York"))
updated="Atualizada em "+now.strftime("%d/%m/%Y %H:%M")
result=template.replace("__DATASET__",dataset).replace("__UPDATED_AT__",updated)

if result.count('<script id="dataset" type="application/json">')!=1:
    raise SystemExit("HTML final sem dataset unico.")
if "./loa-2026/style.css" not in result or "./painel.js" not in result:
    raise SystemExit("HTML final nao esta ligado ao CSS/JS do novo painel.")

html_file.write_text(result,encoding="utf-8")
Path("pagamentos-dados.json").write_text(dataset,encoding="utf-8")
print("Painel publicado usando estrutura e CSS do LOA 2026.")
