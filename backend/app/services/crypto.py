"""Fernet encryption for sensitive storage credentials."""
import base64
import hashlib
import json

from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_dict(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_dict(token: str) -> dict:
    return json.loads(_fernet().decrypt(token.encode()))
