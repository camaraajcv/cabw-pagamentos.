#!/usr/bin/env python3
"""Ler CSV privado do Drive para o importador LOA CABW."""
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
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import requests
from datetime import datetime, timezone

FILE_ID = "1vSKMEtAoZemky6ZUvtqC0pbTXIZD9zP5"
raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
if not raw:
    raise SystemExit("Defina GOOGLE_SERVICE_ACCOUNT_JSON nos Secrets do repositorio")
try:
    info = json.loads(raw)
except json.JSONDecodeError:
    raise SystemExit(
        "GOOGLE_SERVICE_ACCOUNT_JSON nao e JSON valido. Cole o conteudo "
        "integral do arquivo de chave JSON, inclusive as chaves externas."
    ) from None
if not isinstance(info, dict) or info.get("type") != "service_account":
    raise SystemExit("Necessaria chave JSON de uma conta de servico do Google.")
creds = service_account.Credentials.from_service_account_info(
    info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
)
creds.refresh(Request())
meta = requests.get(
    "https://www.googleapis.com/drive/v3/files/" + FILE_ID,
    params={"fields": "id,name,modifiedTime,size"},
    headers={"Authorization": "Bearer " + creds.token},
    timeout=60,
)
meta.raise_for_status()
metadata = meta.json()
modified = metadata.get("modifiedTime")
if not modified:
    raise SystemExit("LOA: nao foi possivel obter modifiedTime da fonte.")
modified_dt = datetime.fromisoformat(modified.replace("Z", "+00:00"))
age_hours = (datetime.now(timezone.utc) - modified_dt).total_seconds() / 3600
print(f"LOA: fonte {metadata.get('name')} modificada em {modified} ({age_hours:.1f} h atras).")
if age_hours > 30:
    raise SystemExit(f"LOA: FONTE DESATUALIZADA - ultima modificacao {modified}.")
response = requests.get(
    "https://www.googleapis.com/drive/v3/files/" + FILE_ID,
    params={"alt": "media"},
    headers={"Authorization": "Bearer " + creds.token},
    timeout=120,
)
response.raise_for_status()
if len(response.content) < 30:
    raise SystemExit("Fonte vazia; arquivo atual nao sera alterado")
normalized = normalize_source(response.content)
Path("loa-2026/fonte.csv").write_bytes(normalized)
Path("loa-2026/fonte-meta.json").write_text(
    json.dumps(
        {
            "id": metadata.get("id"),
            "name": metadata.get("name"),
            "modifiedTime": modified,
            "size": metadata.get("size"),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ),
    encoding="utf-8",
)
print("Fonte LOA obtida e normalizada (" + str(len(normalized)) + " bytes)")
