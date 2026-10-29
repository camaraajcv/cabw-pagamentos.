#!/usr/bin/env python3
"""Valida a conversao CABW CSV -> JSON, sem alterar o painel existente."""
import base64, csv, io, json, re, sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]
SOURCE = Path("pagamentos-fonte.csv")
HTML = Path("index.html")

def source_text(raw):
    if raw.lstrip().startswith(b"{"):
        obj = json.loads(raw.decode("utf-8-sig"))
        if "ContentBytes" not in obj:
            raise ValueError("Envelope sem ContentBytes")
        raw = base64.b64decode(obj["ContentBytes"], validate=True)
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    return raw.decode("utf-8-sig")

def value_number(x):
    s = str(x or "").strip().replace(" ", "").replace("\u00a0", "")
    if not s or s == "-": return 0.0
    s = s.replace("R$", "").replace("US$", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    return round(float(s),2)

def convert():
    html = HTML.read_text(encoding="utf-8")
    match = re.search(r'(<script id="dataset" type="application/json">)(.*?)(</script>)',html,re.S)
    if not match: raise ValueError("dataset JSON nao localizado no HTML; cancelar")
    previous = json.loads(match.group(2))
    if set(previous) != {"months","rows"}: raise ValueError("Estrutura JSON inesperada")
    if any(len(r)!=14 for r in previous["rows"]): raise ValueError("Estrutura de linhas inesperada")
    matrix = list(csv.reader(io.StringIO(source_text(SOURCE.read_bytes()))))
    if len(matrix)<4: raise ValueError("CSV incompleto")
    top = [cell for line in matrix[:4] for cell in line]
    period_candidates = [str(v).strip().upper() for v in top if re.fullmatch(r"(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/20\d{2}",str(v).strip().upper())]
    if not period_candidates: raise ValueError("Competencia nao localizada no cabecalho")
    month = period_candidates[-1]
    paid_idx = next((i for line in matrix[:4] for i,cell in enumerate(line) if "DESPESAS PAGAS" in cell.upper()),None)
    if paid_idx is None: raise ValueError("Coluna de pagamentos nao localizada")
    rp_idx = next((i for line in matrix[:4] for i,cell in enumerate(line) if "RESTOS A PAGAR PAGOS" in cell.upper()), None)
    if rp_idx is None: raise ValueError("Coluna de RP pago nao localizada")
    rows=[]
    for line in matrix[3:]:
        if len(line)<=max(paid_idx,rp_idx) or not line[0].strip(): continue
        if not re.search(r"\d{4}NE\d+", line[0], re.I): continue
        get=lambda i: line[i].strip() if len(line)>i else ""
        commitment=get(0)
        budget_year=re.search(r"(20\d{2})NE",commitment,re.I)
        if not budget_year: continue
        for col, kind in ((paid_idx,"exercicio"),(rp_idx,"rap")):
            amount=value_number(line[col])
            if not amount and kind=="rap": continue
            data=[month,get(0),get(2),get(3),get(4),get(5),get(6),get(7),get(9),get(10),get(12),get(13),amount,kind]
            if any(not str(data[i]).strip() for i in (0,1,2,3,4,6,8,10)):
                raise ValueError("Dimensao obrigatoria vazia na linha "+str(len(rows)+4))
            rows.append(data)
    if not rows: raise ValueError("Nenhum pagamento encontrado")
    months=previous["months"]
    if month not in months:
        if months and MONTHS.index(month[:3])<MONTHS.index(months[-1][:3]): raise ValueError("Competencia retroativa")
        months=months+[month]
    preserved=[r for r in previous["rows"] if r[0]!=month]
    old=[r for r in previous["rows"] if r[0]==month]
    # Conferencia auditavel, inclusive total no mes e por tipo.
    types=Counter()
    for r in rows:types[r[13]]+=1
    new_totals={kind:round(sum(r[12] for r in rows if r[13]==kind),2) for kind in ("rap","exercicio")}
    old_totals={kind:round(sum(r[12] for r in old if r[13]==kind),2) for kind in ("rap","exercicio")}
    if old and any(types[kind]==0 for kind in ("rap","exercicio")):
        raise ValueError("Fonte incompleta: RP ou exercicio ausente")
    report={"competencia":month,"linhas_novas":len(rows),"linhas_antigas":len(old),
        "total_novo":round(sum(r[12] for r in rows),2),
        "total_antigo":round(sum(r[12] for r in old),2),
        "tipo_linhas":dict(types),"total_por_tipo":new_totals,"total_anterior_por_tipo":old_totals,"meses_preservados":len(set(r[0] for r in preserved)),
        "atualizado_em":datetime.now(ZoneInfo("America/New_York")).isoformat()}
    if old and sum(r[13]=="exercicio" for r in rows) < sum(r[13]=="exercicio" for r in old)*0.75:
        raise ValueError("Queda anormal da quantidade de linhas do exercicio")
    if len(rows)<len(old)*0.3 and old:
        raise ValueError("Reducao anormal de registros no mes: "+json.dumps(report))
    updated={"months":months,"rows":preserved+rows}
    if [r for r in updated["rows"] if r[0]!=month]!=preserved:
        raise ValueError("Historico anterior modificado")
    Path("validacao-pagamentos.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    Path("novo-dataset.json").write_text(json.dumps(updated,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
    print("SAIDA SOMENTE PARA CONFERENCIA; index.html NAO FOI ALTERADO")

if __name__=="__main__":
    try:convert()
    except Exception as e:
        print("VALIDACAO FALHOU: "+str(e),file=sys.stderr)
        sys.exit(1)
