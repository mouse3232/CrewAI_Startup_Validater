"""
Pydantic schemas for API request / response payloads.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class IdeaCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)


class IdeaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class IdeaResponse(BaseModel):
    id: int
    title: str
    description: str
    status: str
    created_at: str | None
    updated_at: str | None
    latest_score: float | None
    latest_decision: str | None
    validation_count: int


class ValidationResponse(BaseModel):
    id: int
    idea_id: int
    iteration: int
    agent_outputs: dict
    structured_idea: dict
    final_score: float | None
    decision: str | None
    confidence_index: float | None
    executive_summary: dict
    score_history: list
    refinement_history: list
    created_at: str | None


class ComparisonRequest(BaseModel):
    idea_ids: list[int] = Field(..., min_length=2)


class QARequest(BaseModel):
    section: str
    question: str


class SourceItem(BaseModel):
    type: str = "internal"         # "internal" | "web"
    title: str = ""
    url: str | None = None


class QAResponse(BaseModel):
    answer: str
    sources: list[SourceItem] = []
    model_used: str = ""
    validation_tier: str = "standard"   # "standard" | "web_quick" | "web_deep"
    validation_confidence: float = 0


class RefineSectionRequest(BaseModel):
    section: str
    feedback: str


class WebValidateRequest(BaseModel):
    section: str
    question: str = "Validate this section with real-world market data"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    priority: str = "medium"
    related_section: str | None = None
    assigned_agent: str | None = None
    deadline: str | None = None
    status: str = "planned"
    progress: int = 0

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    related_section: str | None = None
    assigned_agent: str | None = None
    deadline: str | None = None
    status: str | None = None
    progress: int | None = None

class JournalEntryCreate(BaseModel):
    content: str = Field(..., min_length=1)
    task_id: int | None = None
    tags: list[str] = []

class ExperimentCreate(BaseModel):
    hypothesis: str = Field(..., min_length=1)
    metric: str = Field(..., min_length=1)
    target_criteria: str = Field(..., min_length=1)
    timeframe: str | None = None

class ExperimentUpdate(BaseModel):
    hypothesis: str | None = None
    metric: str | None = None
    target_criteria: str | None = None
    timeframe: str | None = None
    outcome: str | None = None
    status: str | None = None

class StickyNoteCreate(BaseModel):
    section_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    is_visible: bool = True
    position_x: int = 0
    position_y: int = 0

class StickyNoteUpdate(BaseModel):
    content: str | None = None
    is_visible: bool | None = None
    position_x: int | None = None
    position_y: int | None = None
