"""Admin router: user/role management, audit logs, system configuration. All require admin permission."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.common.response import ApiError, ok
from app.database import get_db
from app.deps import get_client_ip, require_permission
from app.models import AuditLog, Role, SystemConfig, User
from app.schemas import ConfigUpdate, RoleUpsert, UserCreate, UserUpdate
from app.security import hash_password
from app.serializers import audit_to_dict, role_to_dict, user_to_dict
from app.services import audit

router = APIRouter(prefix="/admin", tags=["admin"])

# Default system configuration (only the cache and rate-limit groups; model/retrieval config is fixed in backend code)
DEFAULT_CONFIG = {
    "cache": {"ttlSeconds": 3600, "similarityThreshold": 0.95, "maxCacheSize": 10000},
    "rateLimit": {
        "userPerMinute": 30,
        "qaPerMinute": 60,
        "uploadPerMinute": 10,
        "llmConcurrency": 5,
    },
}


# ---------------- User Management ----------------
@router.get("/users")
def list_users(
    db: Session = Depends(get_db), user: User = Depends(require_permission("admin"))
):
    users = db.query(User).order_by(User.id).all()
    return ok([user_to_dict(u) for u in users])


@router.post("/users")
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    if db.query(User).filter(User.username == body.username).first():
        raise ApiError("Username already exists", code=1, status_code=409)
    new_user = User(
        username=body.username,
        email=body.email or "",
        password_hash=hash_password(body.password),
        status="active",
    )
    if body.roles:
        roles = db.query(Role).filter(Role.name.in_(body.roles)).all()
        new_user.roles = roles
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return ok(user_to_dict(new_user), message="User created")


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    target = db.get(User, user_id)
    if not target:
        raise ApiError("User not found", code=1, status_code=404)
    if body.status is not None:
        target.status = body.status
    if body.roles is not None:
        target.roles = db.query(Role).filter(Role.name.in_(body.roles)).all()
    db.commit()
    db.refresh(target)
    return ok(user_to_dict(target), message="User updated")


# ---------------- Role Management ----------------
@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db), user: User = Depends(require_permission("admin"))
):
    roles = db.query(Role).order_by(Role.id).all()
    return ok([role_to_dict(r) for r in roles])


@router.post("/roles")
def create_role(
    body: RoleUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    if not body.name:
        raise ApiError("Role name cannot be empty", code=1, status_code=400)
    if db.query(Role).filter(Role.name == body.name).first():
        raise ApiError("Role name already exists", code=1, status_code=409)
    role = Role(
        name=body.name,
        description=body.description or "",
        permissions=body.permissions or [],
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return ok(role_to_dict(role), message="Role created")


@router.put("/roles/{role_id}")
def update_role(
    role_id: int,
    body: RoleUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    role = db.get(Role, role_id)
    if not role:
        raise ApiError("Role not found", code=1, status_code=404)
    if body.description is not None:
        role.description = body.description
    if body.permissions is not None:
        role.permissions = body.permissions
    db.commit()
    db.refresh(role)
    return ok(role_to_dict(role), message="Role updated")


# ---------------- Audit Logs ----------------
@router.get("/audit-logs")
def list_audit_logs(
    keyword: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if keyword:
        like = f"%{keyword}%"
        q = q.filter((AuditLog.username.like(like)) | (AuditLog.action.like(like)))
    logs = q.limit(min(limit, 2000)).all()
    return ok([audit_to_dict(a) for a in logs])


# ---------------- System Configuration ----------------
def _get_config(db: Session) -> dict:
    row = db.get(SystemConfig, 1)
    if not row:
        row = SystemConfig(id=1, data=DEFAULT_CONFIG)
        db.add(row)
        db.commit()
        db.refresh(row)
    data = dict(row.data or {})
    # Fill in missing groups to ensure the frontend form fields are complete
    for key, val in DEFAULT_CONFIG.items():
        data.setdefault(key, val)
    return {"cache": data["cache"], "rateLimit": data["rateLimit"]}


@router.get("/config")
def get_config(
    db: Session = Depends(get_db), user: User = Depends(require_permission("admin"))
):
    return ok(_get_config(db))


@router.put("/config")
def update_config(
    body: ConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin")),
):
    row = db.get(SystemConfig, 1)
    if not row:
        row = SystemConfig(id=1, data=DEFAULT_CONFIG)
        db.add(row)
    data = dict(row.data or DEFAULT_CONFIG)
    if body.cache is not None:
        data["cache"] = {**data.get("cache", {}), **body.cache}
    if body.rateLimit is not None:
        data["rateLimit"] = {**data.get("rateLimit", {}), **body.rateLimit}
    row.data = data
    db.commit()
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Update system configuration",
        resource="config",
        ip=get_client_ip(request),
    )
    return ok(_get_config(db), message="System configuration saved")
