"""FastAPI dependencies: current user resolution, RBAC permission checks, client info."""
from __future__ import annotations

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.common.response import ApiError
from app.database import get_db
from app.models import User
from app.security import decode_token
from app.serializers import merge_permissions


def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the currently logged-in user from the Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError("Not logged in or missing token", code=401, status_code=401)
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise ApiError("Login has expired, please log in again", code=401, status_code=401)
    except jwt.PyJWTError:
        raise ApiError("Invalid token", code=401, status_code=401)

    if payload.get("type") != "access":
        raise ApiError("Wrong token type", code=401, status_code=401)

    user_id = int(payload.get("sub", 0))
    user = db.get(User, user_id)
    if not user:
        raise ApiError("User does not exist", code=401, status_code=401)
    if user.status != "active":
        raise ApiError("This account has been disabled", code=403, status_code=403)
    return user


def current_permissions(user: User) -> list[str]:
    return merge_permissions(list(user.roles))


def require_permission(permission: str):
    """Generate a dependency that checks for the specified permission."""

    def checker(user: User = Depends(get_current_user)) -> User:
        perms = current_permissions(user)
        # admin is treated as super permission, allowing everything through
        if "admin" in perms or permission in perms:
            return user
        raise ApiError("Insufficient permissions", code=403, status_code=403)

    return checker


def is_admin(user: User) -> bool:
    return "admin" in current_permissions(user)
