from fastapi import APIRouter

from app.api.v1.endpoints import ai, analytics, auth, categories, distractions, sessions, settings, tasks

api_router = APIRouter()
for module in (auth, tasks, sessions, distractions, categories, settings, analytics, ai):
    api_router.include_router(module.router)
