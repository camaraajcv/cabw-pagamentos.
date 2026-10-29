#!/usr/bin/env python3
"""Baixa a fonte privada do Painel de Pagamentos (sem publicar dados brutos)."""
import json
import os
from pathlib import Path
import requests
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
response = requests.get(
    f"https://www.googleapis.com/drive/v3/files/{FILE_ID}",
    headers={"Authorization": f"Bearer {credentials.token}"},
    params={"alt": "media"},
    timeout=120,
)
response.raise_for_status()
if len(response.content) < 100:
    raise SystemExit("Arquivo vazio: nenhuma atualizacao executada.")
Path("pagamentos-fonte.csv").write_bytes(response.content)
print(f"Fonte de pagamentos obtida ({len(response.content)} bytes).")
