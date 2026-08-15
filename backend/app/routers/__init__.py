"""Router aggregation: centrally register all business routes."""
from fastapi import APIRouter

from app.routers import (
    admin,
    auth,
    conversations,
    dashboard,
    documents,
    eval,
    kb,
    qa,
    tasks,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(kb.router)
api_router.include_router(documents.router)
api_router.include_router(qa.router)
api_router.include_router(conversations.router)
api_router.include_router(tasks.router)
api_router.include_router(eval.router)
api_router.include_router(admin.router)
api_router.include_router(dashboard.router)
