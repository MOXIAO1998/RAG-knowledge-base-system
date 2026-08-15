"""Authentication routes: login / register / refresh token / current user."""
from __future__ import annotations

from datetime import datetime

import jwt
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.common.response import ApiError, ok
from app.database import get_db
from app.deps import get_client_ip, get_current_user
from app.models import Role, User
from app.schemas import LoginRequest, RefreshRequest, RegisterRequest
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.serializers import user_to_dict
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])

DEFAULT_ROLE = "Regular User"


def _issue_tokens(user: User) -> dict:
    role_names = [r.name for r in user.roles]
    return {
        "token": create_access_token(user.id, role_names),
        "refreshToken": create_refresh_token(user.id),
        "user": user_to_dict(user),
    }


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise ApiError("Incorrect username or password", code=1, status_code=401)
    if user.status != "active":
        raise ApiError("This account has been disabled, please contact the administrator", code=1, status_code=403)

    user.last_login = datetime.now()
    db.commit()
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Login",
        resource="auth",
        ip=get_client_ip(request),
    )
    return ok(_issue_tokens(user), message="Login successful")


@router.post("/register")
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise ApiError("Username already exists", code=1, status_code=409)

    user = User(
        username=body.username,
        email=body.email or "",
        password_hash=hash_password(body.password),
        status="active",
    )
    role = db.query(Role).filter(Role.name == DEFAULT_ROLE).first()
    if role:
        user.roles.append(role)
    db.add(user)
    db.commit()
    db.refresh(user)
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Register",
        resource="auth",
        ip=get_client_ip(request),
    )
    return ok(_issue_tokens(user), message="Registration successful")


@router.post("/refresh")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refreshToken)
    except jwt.ExpiredSignatureError:
        raise ApiError("Login has expired, please log in again", code=1, status_code=401)
    except jwt.PyJWTError:
        raise ApiError("Invalid refresh token", code=1, status_code=401)
    if payload.get("type") != "refresh":
        raise ApiError("Invalid token type", code=1, status_code=401)

    user = db.get(User, int(payload.get("sub", 0)))
    if not user or user.status != "active":
        raise ApiError("User is unavailable", code=1, status_code=401)
    role_names = [r.name for r in user.roles]
    return ok({"token": create_access_token(user.id, role_names)})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(user_to_dict(user))
