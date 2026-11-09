#!/usr/bin/env python3
"""Baixa a fonte privada do Painel de Pagamentos (sem publicar dados brutos)."""
import json
import os
import base64
import csv
import io
from openpyxl import load_workbook

def normalize_source(payload: bytes) -> bytes:
    raw = payload
    stripped = raw.lstrip()
    if stripped.startswith(b"{"):
        wrapper = json.loads(raw.decode("utf-8-sig"))
        content_b64 = wrapper.get("ContentBytes")
        if not isinstance(content_b64, str):
            raise SystemExit("Envelope do Power Automate sem ContentBytes.")
        raw = base64.b64decode(content_b64)
    if raw.startswith(b"PK\x03\x04"):
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        out = io.StringIO(newline="")
        writer = csv.writer(out, lineterminator="\n")
        for row in ws.iter_rows(values_only=True):
            writer.writerow(["" if v is None else v for v in row])
        return out.getvalue().encode("utf-8-sig")
    return raw

from pathlib import Path
import requests
from datetime import datetime, timezone, timedelta, time
from zoneinfo import ZoneInfo
from google.oauth2 import service_account
from google.auth.transport.requests import Request

FILE_ID = "1NB6-4hs5mnUJbUatqIhTBoLl3Lw8s3Lu"
secret = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
if not secret:
    raise SystemExit("Configure GOOGLE_SERVICE_ACCOUNT_JSON nos GitHub Actions Secrets.")
try:
    info = json.loads(secret)
except json.JSONDecodeError:
    raise SystemExit("O secret GOOGLE_SERVICE_ACCOUNT_JSON nao e JSON valido.") from None
if info.get("type") != "service_account":
    raise SystemExit("A chave deve ser do tipo service_account.")
credentials = service_account.Credentials.from_service_account_info(
    info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
)
credentials.refresh(Request())
meta = requests.get(
    f"https://www.googleapis.com/drive/v3/files/{FILE_ID}",
    headers={"Authorization": f"Bearer {credentials.token}"},
    params={"fields": "id,name,modifiedTime,size"},
    timeout=60,
)
meta.raise_for_status()
metadata = meta.json()
modified = metadata.get("modifiedTime")
if not modified:
    raise SystemExit("Pagamentos: nao foi possivel obter modifiedTime da fonte.")
def age_in_weekdays_hours(start: datetime, end: datetime) -> float:
    """Conta horas de segunda a sexta no fuso da CABW, ignorando o fim de semana."""
    tz = ZoneInfo("America/New_York")
    cursor = start.astimezone(tz)
    end_local = end.astimezone(tz)
    seconds = 0.0
    while cursor < end_local:
        next_midnight = datetime.combine(
            cursor.date() + timedelta(days=1), time.min, tzinfo=tz
        )
        segment_end = min(next_midnight, end_local)
        if cursor.weekday() < 5:
            seconds += (
                segment_end.astimezone(timezone.utc)
                - cursor.astimezone(timezone.utc)
            ).total_seconds()
        cursor = next_midnight
    return seconds / 3600


modified_dt = datetime.fromisoformat(modified.replace("Z", "+00:00"))
now = datetime.now(timezone.utc)
age_hours = (now - modified_dt).total_seconds() / 3600
if age_hours < -0.1:
    raise SystemExit("Pagamentos: horario de modificacao da fonte esta no futuro.")
weekday_hours = age_in_weekdays_hours(modified_dt, now)
print(
    f"Pagamentos: fonte {metadata.get('name')} modificada em {modified} "
    f"({age_hours:.1f} h corridas; {weekday_hours:.1f} h de segunda a sexta)."
)
if weekday_hours > 30:
    raise SystemExit(
        f"Pagamentos: FONTE DESATUALIZADA - ultima modificacao {modified}; "
        f"{weekday_hours:.1f} h em dias uteis (limite: 30 h)."
    )
response = requests.get(
    f"https://www.googleapis.com/drive/v3/files/{FILE_ID}",
    headers={"Authorization": f"Bearer {credentials.token}"},
    params={"alt": "media"},
    timeout=120,
)
response.raise_for_status()
if len(response.content) < 100:
    raise SystemExit("Arquivo vazio: nenhuma atualizacao executada.")
normalized = normalize_source(response.content)
Path("pagamentos-fonte.csv").write_bytes(normalized)
print(f"Fonte de pagamentos obtida e normalizada ({len(normalized)} bytes).")
