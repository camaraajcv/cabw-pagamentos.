#!/usr/bin/env python3
"""Concilia valores efetivamente pagos do CSV de pagamentos com os agrupamentos LOA.

Nao usa percentuais para construir valores pagos. Preserva percentuais da LOA.
Cancela publicacao se houver pagamento sem agrupamento ou total divergente.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

BASE=Path("loa-2026/dados.json")
NOVO=Path("loa-2026/dados-novos.json")
FONTE=Path("novo-dataset.json")
HTML=Path("index.html")
META=Path("loa-2026/fonte-meta.json")
MONTHS=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]

def cents(n):
    return round(float(n)*100)

def key_loa(r):
    return tuple(str(r[k]).strip() for k in ("ug","action","nd","pi"))

def key_pay(r):
    return tuple(str(r[i]).strip() for i in (6,4,8,10))

def total(rows,field="paid"):
    return sum(cents(r[field]) for r in rows)

def main():
    current=json.loads(BASE.read_text(encoding="utf-8"))
    obj=json.loads(NOVO.read_text(encoding="utf-8"))
    if FONTE.exists():
        payments=json.loads(FONTE.read_text(encoding="utf-8"))
    else:
        html=HTML.read_text(encoding="utf-8")
        m=re.search(r'<script id="dataset" type="application/json">(.*?)</script>',html,re.S)
        if not m:
            raise ValueError("Dataset de pagamentos nao localizado no index.html")
        payments=json.loads(m.group(1))
    data=obj["data"]
    month=data["reference"]
    match=re.fullmatch(r"(20\d{2})-(0[1-9]|1[0-2])",month)
    if not match:
        raise ValueError("Competencia LOA invalida")
    label=MONTHS[int(match.group(2))-1]+"/"+match.group(1)
    if label not in payments["months"]:
        raise ValueError("Competencia ausente no arquivo de pagamentos: "+label)
    audit={}
    for kind, field in (("exercicio","rows"),("rap","rpRows")):
        payment_rows=[r for r in payments["rows"] if r[0]==label and r[13]==kind]
        targets=[r for r in data[field] if r["month"]==month]
        if not payment_rows or not targets:
            raise ValueError("Sem dados de "+kind+" na competencia "+month)
        target_keys={key_loa(r) for r in targets}
        sums=defaultdict(int)
        for r in payment_rows:
            if len(r)!=14 or not re.fullmatch(r"\d{6}",str(r[8])):
                raise ValueError("Registro de pagamento inconsistente")
            k=key_pay(r)
            if k not in target_keys:
                raise ValueError("Pagamento sem agrupamento LOA: "+kind+" / "+str(k))
            sums[k]+=cents(r[12])
        grouped=defaultdict(list)
        for r in targets:
            grouped[key_loa(r)].append(r)
        for k, matching in grouped.items():
            primary=next((r for r in matching if cents(r["paid"])!=0),matching[0])
            for r in matching:
                r["paid"]=round(sums[k]/100,2) if r is primary else 0
                if kind=="exercicio":
                    r["settled"]=r["paid"]
        loatotal=total(targets)
        paymenttotal=sum(cents(r[12]) for r in payment_rows)
        if loatotal!=paymenttotal:
            raise ValueError("Total nao conciliado: "+kind)
        audit[kind]={"linhas":len(payment_rows),"grupos":len(targets),"total":round(loatotal/100,2)}
    previous=current["data"]
    if not META.exists():
        raise ValueError("Metadados da fonte LOA nao localizados")
    source_meta=json.loads(META.read_text(encoding="utf-8"))
    source_modified=source_meta.get("modifiedTime")
    if not source_modified:
        raise ValueError("modifiedTime da fonte LOA ausente")
    # O painel passa a exibir a data real da fonte no Drive, nao a data do ultimo commit.
    data["updatedAt"]=source_modified
    # Nao modificar registros de meses anteriores. A LOA usa posicoes mensais.
    for field in ("rows","rpRows"):
        original=[r for r in previous[field] if r["month"]!=month]
        updated=[r for r in data[field] if r["month"]!=month]
        if original!=updated:
            raise ValueError("Historico preservado nao coincide: "+field)
    NOVO.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("CONCILIACAO_MONETARIA_APROVADA "+json.dumps({"competencia":month,"fonte":source_modified,**audit},ensure_ascii=False))

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("CONCILIACAO_MONETARIA_FALHOU: "+str(exc),file=sys.stderr)
        sys.exit(1)
