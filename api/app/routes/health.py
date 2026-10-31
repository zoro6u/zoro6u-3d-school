from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings

router = APIRouter()


@router.get("/health")
def health(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, object]:
    """The frontend polls this: llm=false switches the teacher to the scripted offline tour."""
    return {"status": "ok", "llm": settings.llm_enabled, "provider": settings.llm_provider, "model": settings.anthropic_model}
