"""Unified response wrappers, business exceptions, and common utilities.

Response contract (aligned with design doc §12.2):
- Success: {"code": 0, "data": ..., "message": "success"}
- Failure: {"code": non-zero, "message": "..."}
"""
from __future__ import annotations

from datetime import datetime
from typing import Any


def ok(data: Any = None, message: str = "success") -> dict:
    return {"code": 0, "message": message, "data": data}


def fail(message: str, code: int = 1) -> dict:
    return {"code": code, "message": message, "data": None}


class ApiError(Exception):
    """Business exception: converted to a unified failure response by the global exception handler."""

    def __init__(self, message: str, code: int = 1, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def fmt_dt(dt: datetime | None) -> str:
    """Format uniformly into the frontend display format 'YYYY-MM-DD HH:mm:ss'."""
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")
