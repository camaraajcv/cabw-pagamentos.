#!/usr/bin/env python3
"""Atualiza apenas o bloco JSON do painel mantendo HTML e CSS existentes."""
import json, re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
html_file=Path("index.html")
html=html_file.read_text(encoding="utf-8")
dataset=Path("novo-dataset.json").read_text(encoding="utf-8")
parsed=json.loads(dataset)
assert parsed["rows"] and parsed["months"]
old_match=re.search(r'<script id="dataset" type="application/json">(.*?)</script>',html,re.S)
if not old_match: raise SystemExit("Dataset atual nao encontrado")
old=json.loads(old_match.group(1))
if old==parsed:
    print("Dados identicos ao painel: nao ha necessidade de nova publicacao.")
    raise SystemExit(0)
pat=r'(<script id="dataset" type="application/json">)(.*?)(</script>)'
result,n=re.subn(pat,lambda m:m.group(1)+dataset+m.group(3),html,count=1,flags=re.S)
if n!=1:raise SystemExit("Bloco de dados nao encontrado exatamente uma vez.")
date=datetime.now(ZoneInfo("America/New_York")).strftime("%d/%m/%Y as %H:%M")
result,c=re.subn(r'Dados atualizados em \d{2}/\d{2}/\d{4} às \d{2}:\d{2}',"Dados atualizados em "+date.replace(" as "," às "),result,count=1)
if c!=1:raise SystemExit("Campo de atualizacao nao encontrado.")
if result.count('<script id="dataset"')!=1:raise SystemExit("HTML inconsistente")
if len(result)<100000:raise SystemExit("HTML inesperadamente pequeno")
html_file.write_text(result,encoding="utf-8")
print("Dataset atualizado sem mudar codigo, graficos e CSS.")
