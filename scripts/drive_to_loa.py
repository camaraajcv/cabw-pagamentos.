#!/usr/bin/env python3
"""Ler CSV privado do Drive para o importador LOA CABW."""
import json
import os
from pathlib import Path
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import requests

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
response = requests.get(
    "https://www.googleapis.com/drive/v3/files/" + FILE_ID,
    params={"alt": "media"},
    headers={"Authorization": "Bearer " + creds.token},
    timeout=120,
)
response.raise_for_status()
if len(response.content) < 30:
    raise SystemExit("Fonte vazia; arquivo atual nao sera alterado")
Path("loa-2026/fonte.csv").write_bytes(response.content)
print("CSV obtido com sucesso (" + str(len(response.content)) + " bytes)")
