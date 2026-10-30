#!/usr/bin/env python3
"""Concilia valores efetivamente pagos do CSV de pagamentos com os agrupamentos LOA.

Nao usa percentuais para construir valores pagos. Preserva percentuais da LOA.
Cancela publicacao se houver pagamento sem agrupamento ou total divergente.
"""
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE=Path("loa-2026/dados.json")
NOVO=Path("loa-2026/dados-novos.json")
FONTE=Path("novo-dataset.json")
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
    payments=json.loads(FONTE.read_text(encoding="utf-8"))
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
        if len(target_keys)!=len(targets):
            raise ValueError("Chave duplicada no painel LOA para "+kind)
        for r in targets:
            r["paid"]=round(sums[key_loa(r)]/100,2)
            if kind=="exercicio":
                r["settled"]=r["paid"]
        loatotal=total(targets)
        paymenttotal=sum(cents(r[12]) for r in payment_rows)
        if loatotal!=paymenttotal:
            raise ValueError("Total nao conciliado: "+kind)
        audit[kind]={"linhas":len(payment_rows),"grupos":len(targets),"total":round(loatotal/100,2)}
    previous=current["data"]
    comparison=json.loads(json.dumps(data))
    comparison["updatedAt"]=previous.get("updatedAt")
    if comparison==previous:
        data["updatedAt"]=previous.get("updatedAt")
    else:
        data["updatedAt"]=datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    # Nao modificar registros de meses anteriores. A LOA usa posicoes mensais.
    for field in ("rows","rpRows"):
        original=[r for r in previous[field] if r["month"]!=month]
        updated=[r for r in data[field] if r["month"]!=month]
        if original!=updated:
            raise ValueError("Historico preservado nao coincide: "+field)
    NOVO.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("CONCILIACAO_MONETARIA_APROVADA "+json.dumps({"competencia":month,**audit},ensure_ascii=False))

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("CONCILIACAO_MONETARIA_FALHOU: "+str(exc),file=sys.stderr)
        sys.exit(1)
