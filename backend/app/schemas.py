"""Request body Pydantic models. Fields use camelCase to align with frontend TypeScript types."""
from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: str = ""
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refreshToken: str


class KbCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    visibility: str = "private"


class KbUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    visibility: str | None = None


class KbMemberCreate(BaseModel):
    userId: int
    accessLevel: str = "read"


class QaRequest(BaseModel):
    query: str
    conversationId: int | None = None
    kbId: int | None = None


class RoleUpsert(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: list[str] | None = None


class UserUpdate(BaseModel):
    status: str | None = None
    roles: list[str] | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: str = ""
    password: str = Field(min_length=1, max_length=128)
    roles: list[str] = Field(default_factory=list)


class EvalRunCreate(BaseModel):
    dataset: str
    kbId: int | None = None
    kbName: str | None = None


class ConfigUpdate(BaseModel):
    # The frontend only submits two groups of adjustable parameters: cache / rateLimit
    cache: dict | None = None
    rateLimit: dict | None = None
