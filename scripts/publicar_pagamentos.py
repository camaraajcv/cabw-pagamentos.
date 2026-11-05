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
pat=r'(<script id="dataset" type="application/json">)(.*?)(</script>)'
result,n=re.subn(pat,lambda m:m.group(1)+dataset+m.group(3),html,count=1,flags=re.S)
if n!=1:raise SystemExit("Bloco de dados nao encontrado exatamente uma vez.")
now=datetime.now(ZoneInfo("America/New_York"))
date=now.strftime("%d/%m/%Y as %H:%M")
latest=parsed["months"][-1]
months_pt={"JAN":"Janeiro","FEV":"Fevereiro","MAR":"Março","ABR":"Abril","MAI":"Maio","JUN":"Junho","JUL":"Julho","AGO":"Agosto","SET":"Setembro","OUT":"Outubro","NOV":"Novembro","DEZ":"Dezembro"}
month_name=months_pt.get(latest[:3],latest[:3])
result,c=re.subn(r"(?:Dados atualizados|Última carga) em \d{2}/\d{2}/\d{4} às \d{2}:\d{2}", "Última carga em "+date.replace(" as "," às "),result,count=1)
if c!=1:raise SystemExit("Campo de atualizacao nao encontrado.")
# Sempre abrir o painel na competencia mais recente do dataset.
options="".join(f'<option value="{m}"'+(' selected="selected"' if m==latest else '')+f'>{m}</option>' for m in parsed["months"])
result,nsel=re.subn(r'(<select aria-label="Mês de referência" id="month">).*?(</select>)',lambda m:m.group(1)+options+m.group(2),result,count=1,flags=re.S)
if nsel!=1:raise SystemExit("Seletor de mes nao localizado.")
# Atualizar o texto visivel que antes ficava preso em outubro.
result=re.sub(r'<noscript><div class="note">Resumo acumulado de .*?</div></noscript>',
              f'<noscript><div class="note">Resumo acumulado de {month_name.lower()} de {latest[-4:]}. Ative o JavaScript do navegador para selecionar outros meses e usar os filtros.</div></noscript>',
              result,count=1,flags=re.S)
result=re.sub(r'<div class="note">Pagamentos realizados acumulados até o mês de referência\..*?</div>',
              f'<div class="note">Pagamentos realizados acumulados até o mês de referência. {month_name} é a posição mais recente, atualizada em {now.strftime("%d/%m/%Y")}.</div>',
              result,count=1,flags=re.S)
if result.count('<script id="dataset"')!=1:raise SystemExit("HTML inconsistente")
if len(result)<100000:raise SystemExit("HTML inesperadamente pequeno")
html_file.write_text(result,encoding="utf-8")
print("Dataset atualizado sem mudar codigo, graficos e CSS.")
