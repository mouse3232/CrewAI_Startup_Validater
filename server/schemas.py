"""
Pydantic schemas for API request / response payloads.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Auth & Users ──────────────────────────────────────────────────────

class FinancialPlanRequest(BaseModel):
    initial_investment_inr: float = Field(0.0, ge=0)
    monthly_revenue_inr: float = Field(0.0, ge=0)
    cogs_percentage: float = Field(0.0, ge=0, le=100)
    fixed_monthly_costs_inr: float = Field(0.0, ge=0)
    monthly_growth_rate_pct: float = Field(5.0)
    tax_rate_pct: float = Field(25.0)  # India standard corporate tax approx
    gst_rate_pct: float = Field(18.0)  # India standard GST

class FinancialPlanResponse(BaseModel):
    months: list[str]
    revenues: list[float]
    cogs: list[float]
    gross_profits: list[float]
    fixed_costs: list[float]
    ebitda: list[float]
    taxes: list[float]
    net_profits: list[float]
    cumulative_cashflow: list[float]
    breakeven_month: int | None
    roi_percentage: float | None

class UserCreate(BaseModel):
    email: str = Field(..., example="founder@startup.com")
    password: str = Field(..., min_length=8)
    name: str = Field(..., example="Jane Doe")

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    role: str

    class Config:
        from_attributes = True

class UserProfileResponse(UserResponse):
    workspaces: List[WorkspaceResponse] = []

# ── System Settings ───────────────────────────────────────────────────

class CoreConcept(BaseModel):
    problem: str
    solution: str

class TargetAudience(BaseModel):
    type: str
    location: str
    tier: List[str] | str
    age_group: str

class RevenueModel(BaseModel):
    type: List[str] | str
    expected_price: str

class StructuredIdeaInput(BaseModel):
    title: str
    core_concept: CoreConcept
    target_audience: TargetAudience
    revenue_model: RevenueModel
    competitor_awareness: str
    market_trends: str
    onboarding_strategy: str
    risk_perception: str
    user_pivot_instructions: Optional[List[str]] = []

class IdeaCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    structured_input: StructuredIdeaInput


class IdeaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    structured_input: dict | None = None


# ── Tabs & Content Blocks (V2 OS) ────────────────────────────────────

class ContentBlockCreate(BaseModel):
    block_type: str = "text"
    content: dict = Field(default_factory=dict)
    order: int = 0

class ContentBlockUpdate(BaseModel):
    block_type: str | None = None
    content: dict | None = None
    order: int | None = None

class ProjectTabCreate(BaseModel):
    name: str = Field(..., min_length=1)
    order: int = 0

class ProjectTabUpdate(BaseModel):
    name: str | None = None
    order: int | None = None

class BlockRevisionResponse(BaseModel):
    id: int
    user_id: int | None
    old_content: dict
    new_content: dict
    created_at: str | None

class ContentBlockResponse(BaseModel):
    id: int
    tab_id: int
    block_type: str
    content: dict
    order: int
    updated_at: str | None

class ProjectTabResponse(BaseModel):
    id: int
    idea_id: int
    name: str
    order: int
    blocks: List[ContentBlockResponse] = []


class IdeaResponse(BaseModel):
    id: int
    title: str
    description: str
    structured_input: dict
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
    section_id: str
    content: str
    color: str = "yellow"
    position_x: int = 0
    position_y: int = 0
    width: int = 220
    height: int = 200
    is_pinned: bool = False
    assigned_user: str | None = None
    deadline: str | None = None

class StickyNoteUpdate(BaseModel):
    content: str | None = None
    color: str | None = None
    is_visible: bool | None = None
    is_pinned: bool | None = None
    position_x: int | None = None
    position_y: int | None = None
    width: int | None = None
    height: int | None = None
    assigned_user: str | None = None
    deadline: str | None = None

class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)

class ChatRebuildRequest(BaseModel):
    user_suggestion: str = Field(..., min_length=5)


# ── Meeting schemas ──────────────────────────────────────────────────
class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1)
    date: str | None = None
    participants: list[str] = []
    notes: str | None = None
    decisions: str | None = None
    tasks_assigned: list[dict] = []
    attachments: list[dict] = []

class MeetingUpdate(BaseModel):
    title: str | None = None
    date: str | None = None
    participants: list[str] | None = None
    notes: str | None = None
    decisions: str | None = None
    tasks_assigned: list[dict] | None = None
    attachments: list[dict] | None = None


# ── Expense schemas ──────────────────────────────────────────────────
class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1)
    category: str | None = None
    estimated_cost: float = 0
    actual_cost: float = 0
    status: str = "planned"
    date: str | None = None
    notes: str | None = None

class ExpenseUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    estimated_cost: float | None = None
    actual_cost: float | None = None
    status: str | None = None
    date: str | None = None
    notes: str | None = None


# ── User Preference schemas ─────────────────────────────────────────
class UserPreferenceUpdate(BaseModel):
    theme: str | None = None
    preferences: dict | None = None
