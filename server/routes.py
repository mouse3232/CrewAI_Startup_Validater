"""
API Routes — CRUD + validation + comparison + SSE streaming.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from server.database import get_db
from server.db_models import Idea, Validation, ChartData, Task, JournalEntry, Experiment, StickyNote, ChatMessage, ProjectTab, ContentBlock, BlockRevision, AgentSession, AgentMessage
from server.schemas import (
    IdeaCreate, IdeaUpdate,
    QARequest, QAResponse,
    RefineSectionRequest,
    WebValidateRequest,
    TaskCreate, TaskUpdate,
    JournalEntryCreate,
    ExperimentCreate, ExperimentUpdate,
    StickyNoteCreate, StickyNoteUpdate,
    ChatMessageCreate, ChatRebuildRequest,
    ProjectTabCreate, ProjectTabUpdate, ProjectTabResponse,
    ContentBlockCreate, ContentBlockUpdate, ContentBlockResponse,
    FinancialPlanRequest, FinancialPlanResponse,
    MeetingCreate, MeetingUpdate,
    ExpenseCreate, ExpenseUpdate,
    UserPreferenceUpdate,
)
from crew_runner import run_validation, regenerate_validation_summary, generate_risk_analysis, generate_market_financial_analysis
from core.groq_client import GroqClient
from core.token_tracker import tracker
from core.model_router import get_model_config, get_active_models, USER_DISABLED_MODELS
from core.engine_config import get_engine, switch_engine
from core.methodology import get_methodology
from core.scoring_engine import (
    compute_weighted_breakdown, compute_scenario_scores, compute_sensitivity
)
from core.web_validator import detect_intent, quick_validate, deep_validate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ── Auth & Users ──────────────────────────────────────────────────────
from fastapi.security import OAuth2PasswordRequestForm
from server.auth import get_password_hash, verify_password, create_access_token, get_current_user, get_current_user_optional, ACCESS_TOKEN_EXPIRE_MINUTES
from server.db_models import User, Workspace, WorkspaceMember
from server.schemas import UserCreate, UserResponse, Token, UserProfileResponse
from datetime import timedelta

@router.post("/auth/register", response_model=Token)
async def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Create user
    hashed_password = get_password_hash(user_in.password)
    db_user = User(email=user_in.email, name=user_in.name, password_hash=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create default workspace for user
    workspace = Workspace(name=f"{db_user.name}'s Workspace")
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    
    # Add user as owner of workspace
    membership = WorkspaceMember(workspace_id=workspace.id, user_id=db_user.id, role="owner")
    db.add(membership)
    db.commit()
    
    # Generate token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/auth/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me", response_model=UserProfileResponse)
async def read_users_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Build complete profile including workspaces
    profile_data = {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "workspaces": []
    }
    
    for membership in current_user.workspace_memberships:
        profile_data["workspaces"].append({
            "id": membership.workspace.id,
            "name": membership.workspace.name,
            "role": membership.role
        })
        
    return profile_data

# ── System Health & Monitoring ──────────────────────────────────────

@router.get("/system/engine")
def get_engine_mode():
    return {"mode": get_engine()}

from pydantic import BaseModel

class EngineSwitchRequest(BaseModel):
    mode: str

@router.post("/system/engine/switch")
def switch_engine_mode(payload: EngineSwitchRequest):
    try:
        result = switch_engine(payload.mode)
        return result
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/system/models/status")
def get_model_status():
    """Returns real-time RPM/TPM usage against defined model limits."""
    from core.engine_config import ACTIVE_ENGINE
    metrics = tracker.get_all_metrics()
    status_report = []
    
    models = get_active_models()
    controlled_models = {"gpt-120b", "gpt-20b", "gpt-safeguard", "llama-70b"} if ACTIVE_ENGINE == "groq" else set()
    
    for model_key, config in models.items():
        usage = metrics.get(config.model, {"rpm": 0, "tpm": 0})
        
        rpm_ratio = usage["rpm"] / config.max_rpm if config.max_rpm else 0
        tpm_ratio = usage["tpm"] / config.max_tpm if config.max_tpm else 0
        max_ratio = max(rpm_ratio, tpm_ratio)
        
        state = "green"
        if model_key in USER_DISABLED_MODELS:
            state = "gray"
        elif max_ratio >= 1.0:
            state = "red"
        elif max_ratio >= 0.8:
            state = "yellow"
            
        status_report.append({
            "id": model_key,
            "model_string": config.model,
            "rpm": usage["rpm"],
            "max_rpm": config.max_rpm,
            "tpm": usage["tpm"],
            "max_tpm": config.max_tpm,
            "state": state,
            "fallback": config.fallback,
            "controlled": model_key in controlled_models,
            "disabled": model_key in USER_DISABLED_MODELS
        })
        
    return {"models": status_report, "engine": ACTIVE_ENGINE}

class ToggleRequest(BaseModel):
    enabled: bool

@router.post("/system/models/{model_id}/toggle")
def toggle_model(model_id: str, payload: ToggleRequest):
    models = get_active_models()
    if model_id not in models:
        raise HTTPException(status_code=404, detail="Model not found")
        
    controlled_models = {"gpt-120b", "gpt-20b", "gpt-safeguard", "llama-70b"}
    if model_id not in controlled_models:
        raise HTTPException(status_code=400, detail="Model cannot be toggled")
        
    if payload.enabled:
        USER_DISABLED_MODELS.discard(model_id)
    else:
        USER_DISABLED_MODELS.add(model_id)
        
    return {"status": "success", "model_id": model_id, "enabled": payload.enabled}


# ── Ideas CRUD ───────────────────────────────────────────────────────

@router.get("/ideas")
def list_ideas(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get all workspace IDs the user belongs to
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    
    # Allow ideas with no workspace (legacy) or ideas in user's workspaces
    ideas = db.query(Idea).filter(
        (Idea.workspace_id.in_(workspace_ids)) | (Idea.workspace_id == None)
    ).order_by(Idea.updated_at.desc()).all()
    
    return [i.to_dict() for i in ideas]


@router.post("/ideas", status_code=201)
def create_idea(payload: IdeaCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Assign to first workspace by default
    default_workspace_id = None
    if current_user.workspace_memberships:
        default_workspace_id = current_user.workspace_memberships[0].workspace_id

    idea = Idea(
        title=payload.title,
        description=payload.description,
        structured_input=payload.structured_input.model_dump(),
        workspace_id=default_workspace_id
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea.to_dict()


@router.get("/ideas/{idea_id}")
def get_idea(idea_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to view this project")
    data = idea.to_dict()
    data["validations"] = [v.to_dict() for v in idea.validations]
    
    # Attach scoring analytics to the latest validation if available
    if idea.validations:
        latest = idea.validations[-1]
        if latest.agent_outputs:
            data["scoring_analytics"] = {
                "weighted_breakdown": compute_weighted_breakdown(latest.agent_outputs),
                "scenario_scores": compute_scenario_scores(latest.agent_outputs),
                "sensitivity": compute_sensitivity(latest.agent_outputs),
            }
    return data


@router.put("/ideas/{idea_id}")
def update_idea(idea_id: int, payload: IdeaUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    if payload.title is not None:
        idea.title = payload.title
    if payload.description is not None:
        idea.description = payload.description
    if payload.structured_input is not None:
        idea.structured_input = payload.structured_input
    db.commit()
    db.refresh(idea)
    return idea.to_dict()


@router.delete("/ideas/{idea_id}", status_code=204)
def delete_idea(idea_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
        
    db.delete(idea)
    db.commit()
    return None


# ── Tabs & Blocks CRUD (V2 OS) ───────────────────────────────────────

@router.get("/ideas/{idea_id}/tabs", response_model=list[ProjectTabResponse])
def get_idea_tabs(idea_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to view this project")
        
    return idea.tabs

@router.post("/ideas/{idea_id}/tabs", response_model=ProjectTabResponse)
def create_idea_tab(idea_id: int, payload: ProjectTabCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
        
    tab = ProjectTab(idea_id=idea_id, name=payload.name, order=payload.order)
    db.add(tab)
    db.commit()
    db.refresh(tab)
    return tab

@router.delete("/tabs/{tab_id}", status_code=204)
def delete_tab(tab_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tab = db.query(ProjectTab).filter(ProjectTab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")
        
    idea = tab.idea
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
        
    db.delete(tab)
    db.commit()
    return None

@router.post("/tabs/{tab_id}/blocks", response_model=ContentBlockResponse)
def create_block(tab_id: int, payload: ContentBlockCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tab = db.query(ProjectTab).filter(ProjectTab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")
        
    idea = tab.idea
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
        
    block = ContentBlock(tab_id=tab_id, block_type=payload.block_type, content=payload.content, order=payload.order)
    db.add(block)
    db.commit()
    db.refresh(block)
    
    # Save initial revision
    revision = BlockRevision(block_id=block.id, user_id=current_user.id, old_content={}, new_content=block.content)
    db.add(revision)
    db.commit()
    return block

@router.put("/blocks/{block_id}", response_model=ContentBlockResponse)
def update_block(block_id: int, payload: ContentBlockUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    block = db.query(ContentBlock).filter(ContentBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    idea = block.tab.idea
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
        
    old_content = dict(block.content)
    
    if payload.block_type is not None:
        block.block_type = payload.block_type
    if payload.content is not None:
        block.content = payload.content
    if payload.order is not None:
        block.order = payload.order
        
    db.commit()
    db.refresh(block)
    
    if payload.content is not None and payload.content != old_content:
        revision = BlockRevision(block_id=block.id, user_id=current_user.id, old_content=old_content, new_content=block.content)
        db.add(revision)
        db.commit()
        
    return block

@router.delete("/blocks/{block_id}", status_code=204)
def delete_block(block_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    block = db.query(ContentBlock).filter(ContentBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    idea = block.tab.idea
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
        
    db.delete(block)
    db.commit()
    db.commit()
    return None

# ── Financial Planner (V2 OS) ────────────────────────────────────────

@router.post("/ideas/{idea_id}/financial-plan", response_model=FinancialPlanResponse)
def calculate_financial_plan(idea_id: int, payload: FinancialPlanRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    workspace_ids = [m.workspace_id for m in current_user.workspace_memberships]
    if idea.workspace_id is not None and idea.workspace_id not in workspace_ids:
        raise HTTPException(status_code=403, detail="Not authorized to view this project")

    months = [f"Month {i}" for i in range(1, 13)]
    revenues = []
    cogs_list = []
    gross_profits = []
    fixed_costs = []
    ebitda_list = []
    taxes_list = []
    net_profits = []
    cumulative_cashflow = []
    
    current_cash = -payload.initial_investment_inr
    current_rev = payload.monthly_revenue_inr
    breakeven_month = None
    
    for i in range(12):
        if i > 0:
            current_rev = current_rev * (1 + (payload.monthly_growth_rate_pct / 100.0))
            
        cogs = current_rev * (payload.cogs_percentage / 100.0)
        gross_profit = current_rev - cogs
        ebitda = gross_profit - payload.fixed_monthly_costs_inr
        
        # Apply corporate tax only if profitable
        taxes = ebitda * (payload.tax_rate_pct / 100.0) if ebitda > 0 else 0
        net_profit = ebitda - taxes
        
        current_cash += net_profit
        
        if breakeven_month is None and current_cash >= 0:
            breakeven_month = i + 1
            
        revenues.append(round(current_rev, 2))
        cogs_list.append(round(cogs, 2))
        gross_profits.append(round(gross_profit, 2))
        fixed_costs.append(round(payload.fixed_monthly_costs_inr, 2))
        ebitda_list.append(round(ebitda, 2))
        taxes_list.append(round(taxes, 2))
        net_profits.append(round(net_profit, 2))
        cumulative_cashflow.append(round(current_cash, 2))
        
    roi_percentage = 0
    if payload.initial_investment_inr > 0:
        roi_percentage = round((cumulative_cashflow[-1] + payload.initial_investment_inr) / payload.initial_investment_inr * 100, 2)
        
    return FinancialPlanResponse(
        months=months,
        revenues=revenues,
        cogs=cogs_list,
        gross_profits=gross_profits,
        fixed_costs=fixed_costs,
        ebitda=ebitda_list,
        taxes=taxes_list,
        net_profits=net_profits,
        cumulative_cashflow=cumulative_cashflow,
        breakeven_month=breakeven_month,
        roi_percentage=roi_percentage
    )

# ── Validation ───────────────────────────────────────────────────────

@router.post("/ideas/{idea_id}/validate")
async def trigger_validation(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    idea.status = "validating"
    db.commit()

    try:
        result = await run_validation(idea_text=idea.description, structured_input=idea.structured_input)
    except Exception as exc:
        idea.status = "draft"
        db.commit()
        logger.error("Validation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    # Persist validation
    validation = Validation(
        idea_id=idea.id,
        iteration=len(idea.validations) + 1,
        agent_outputs=result["agent_outputs"],
        structured_idea=result["structured_idea"],
        final_score=result["final_score"],
        decision=result["decision"],
        confidence_index=result["confidence_index"],
        executive_summary=result["executive_summary"],
        score_history=result["score_history"],
        refinement_history=result["refinement_history"],
    )
    db.add(validation)
    db.flush()

    # Persist chart data
    for chart in result.get("chart_payloads", []):
        db.add(ChartData(
            validation_id=validation.id,
            chart_type=chart["chart_type"],
            chart_payload=chart["chart_payload"],
        ))

    idea.status = "completed"
    db.commit()
    db.refresh(validation)
    return validation.to_dict()


# ── SSE streaming endpoint ───────────────────────────────────────────

@router.get("/ideas/{idea_id}/validate/stream")
async def stream_validation(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    status_queue: asyncio.Queue[dict] = asyncio.Queue()

    def status_callback(step: str, message: str):
        status_queue.put_nowait({"step": step, "message": message})

    async def event_generator():
        idea.status = "validating"
        db.commit()

        # Create Agent session for persistence
        # Find the latest validation or create a dummy if not yet persisted (though we usually persist after validation)
        # Actually, it's better to create a draft validation first or just use a placeholder
        # For now, we'll wait until we have a validation_id, but the agent session needs a validation_id.
        # Let's create an empty validation record first so we have an ID for the session.
        
        current_count = db.query(Validation).filter(Validation.idea_id == idea.id).count()
        validation = Validation(
            idea_id=idea.id,
            iteration=current_count + 1,
        )
        db.add(validation)
        db.commit()
        db.refresh(validation)

        agent_session = AgentSession(validation_id=validation.id)
        db.add(agent_session)
        db.commit()
        db.refresh(agent_session)

        task = asyncio.create_task(
            run_validation(
                idea.description, 
                structured_input=idea.structured_input, 
                status_cb=status_callback,
                session_id=agent_session.id
            )
        )

        # Stream progress events
        while not task.done():
            try:
                event = await asyncio.wait_for(status_queue.get(), timeout=0.5)
                yield {"event": "progress", "data": json.dumps(event)}
            except asyncio.TimeoutError:
                continue

        # Drain remaining events
        while not status_queue.empty():
            event = status_queue.get_nowait()
            yield {"event": "progress", "data": json.dumps(event)}

        try:
            result = task.result()
        except Exception as exc:
            idea.status = "draft"
            db.commit()
            yield {"event": "error", "data": json.dumps({"error": str(exc)})}
            return

        # Update the existing validation record
        validation.agent_outputs = result["agent_outputs"]
        validation.structured_idea = result["structured_idea"]
        validation.final_score = result["final_score"]
        validation.decision = result["decision"]
        validation.confidence_index = result["confidence_index"]
        validation.executive_summary = result["executive_summary"]
        validation.score_history = result["score_history"]
        validation.refinement_history = result["refinement_history"]

        for chart in result.get("chart_payloads", []):
            db.add(ChartData(
                validation_id=validation.id,
                chart_type=chart["chart_type"],
                chart_payload=chart["chart_payload"],
            ))

        idea.status = "completed"
        agent_session.status = "completed"
        from datetime import datetime, timezone
        agent_session.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(validation)

        yield {
            "event": "complete",
            "data": json.dumps(validation.to_dict()),
        }

    return EventSourceResponse(event_generator())


@router.post("/validations/{validation_id}/summarize")
async def summarize_validation(validation_id: int, db: Session = Depends(get_db)):
    """Regenerate the executive summary for a specific validation iteration."""
    validation = db.query(Validation).filter(Validation.id == validation_id).first()
    if not validation:
        raise HTTPException(status_code=404, detail="Validation not found")

    idea = validation.idea
    if not idea:
        raise HTTPException(status_code=404, detail="Associated idea not found")

    try:
        new_summary = await regenerate_validation_summary(
            idea_text=idea.description,
            agent_outputs=validation.agent_outputs,
            final_score=validation.final_score,
            decision=validation.decision,
            confidence=validation.confidence_index,
        )
        
        # Update validation with new summary
        validation.executive_summary = new_summary
        db.commit()
        db.refresh(validation)
        return validation.executive_summary
    except Exception as exc:
        logger.error("Failed to regenerate summary: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Refinement ───────────────────────────────────────────────────────

@router.post("/ideas/{idea_id}/refine")
async def refine_idea(idea_id: int, db: Session = Depends(get_db)):
    """Re-run validation with a fresh pass (triggers refinement loop internally)."""
    return await trigger_validation(idea_id, db)


# ── Comparison ───────────────────────────────────────────────────────

@router.get("/ideas/compare")
def compare_ideas(
    ids: str = Query(..., description="Comma-separated idea IDs"),
    db: Session = Depends(get_db),
):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    if len(id_list) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 idea IDs")

    results = []
    for iid in id_list:
        idea = db.query(Idea).filter(Idea.id == iid).first()
        if not idea:
            continue
        data = idea.to_dict()
        latest_val = idea.validations[0] if idea.validations else None
        if latest_val:
            data["validation"] = latest_val.to_dict()
            data["charts"] = [c.to_dict() for c in latest_val.charts]
        results.append(data)

    return results


# ── Contextual Q&A (with intent-based web validation) ─────────────

@router.post("/ideas/{idea_id}/qa", response_model=QAResponse)
def answer_qa(idea_id: int, req: QARequest, db: Session = Depends(get_db)):
    """Answer contextual questions with automatic web validation routing."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    val = idea.validations[-1] if idea.validations else None
    if not val or not val.structured_idea:
        raise HTTPException(status_code=400, detail="Idea has not been validated yet.")

    canvas = val.structured_idea.get("business_model_canvas", {})
    section_content = canvas.get(req.section, [])

    # ── Intent Detection ─────────────────────────────────────────
    intent = detect_intent(req.question)
    logger.info("Q&A intent: %s for question: %s", intent, req.question[:50])

    context = {
        "idea_title": idea.title,
        "idea_description": idea.description,
        "section": req.section,
        "section_content": section_content,
        "business_model_canvas": canvas,
    }

    if intent == "web_deep":
        result = deep_validate(req.question, context)
        return result

    elif intent == "web_quick":
        result = quick_validate(req.question, context)
        return result

    else:
        # Standard Q&A — llama-3.1-8b-instant (no web)
        prompt = f"""You are a startup validation analyst.

First think step-by-step internally about the question.
Then provide a clean, structured, human-readable output.

Rules:
- Do NOT return JSON.
- Do NOT expose internal reasoning.
- Format outputs with headings and bullet points.
- Use professional business language.
- Be concise and actionable (max 3-4 sentences per point).

Context:
- Idea: {idea.title}
- Description: {idea.description}
- Section: {req.section}
- Section Content: {json.dumps(section_content, indent=2)}

User Question: {req.question}

Provide a strategic answer with clear structure."""

        client = GroqClient()
        qa_cfg = get_model_config("qa_chat")
        answer = client.chat_completion(
            model=qa_cfg.model,
            messages=[{"role": "system", "content": prompt}],
            temperature=qa_cfg.temperature,
            max_tokens=qa_cfg.max_tokens
        )

        return {
            "answer": answer.strip(),
            "sources": [
                {"type": "internal", "title": f"Idea: {idea.title}", "url": None},
                {"type": "internal", "title": "Business Validation Canvas", "url": None},
            ],
            "model_used": qa_cfg.model,
            "validation_tier": "standard",
            "validation_confidence": 60,
        }


# ── Dedicated Web Validation ───────────────────────────────────────

@router.post("/ideas/{idea_id}/web-validate", response_model=QAResponse)
def web_validate_section(idea_id: int, req: WebValidateRequest, db: Session = Depends(get_db)):
    """Validate a canvas section using web-backed compound model."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    val = idea.validations[-1] if idea.validations else None
    if not val or not val.structured_idea:
        raise HTTPException(status_code=400, detail="Idea has not been validated yet.")

    canvas = val.structured_idea.get("business_model_canvas", {})
    section_content = canvas.get(req.section, [])

    context = {
        "idea_title": idea.title,
        "idea_description": idea.description,
        "section": req.section,
        "section_content": section_content,
        "business_model_canvas": canvas,
        "agent_outputs": val.agent_outputs or {},
    }

    # Always use the full compound model for explicit validation requests
    result = deep_validate(req.question, context)
    return result


# ── Interactive Dashboard Chat ───────────────────────────────────────

@router.get("/validations/{validation_id}/chat")
def get_chat_history(validation_id: int, db: Session = Depends(get_db)):
    """Fetch chat history for a validation context."""
    val = db.query(Validation).filter(Validation.id == validation_id).first()
    if not val:
        raise HTTPException(status_code=404, detail="Validation not found")
        
    messages = db.query(ChatMessage).filter(ChatMessage.validation_id == validation_id).order_by(ChatMessage.created_at.asc()).all()
    return [m.to_dict() for m in messages]

@router.post("/validations/{validation_id}/chat")
def post_chat_message(validation_id: int, req: ChatMessageCreate, db: Session = Depends(get_db)):
    """Send a message to the validation context."""
    val = db.query(Validation).filter(Validation.id == validation_id).first()
    if not val:
        raise HTTPException(status_code=404, detail="Validation not found")
        
    # Save user message
    user_msg = ChatMessage(validation_id=validation_id, role="user", content=req.content)
    db.add(user_msg)
    db.commit()
    
    # Retrieve recent history (last 10 messages)
    history = db.query(ChatMessage).filter(ChatMessage.validation_id == validation_id).order_by(ChatMessage.created_at.desc()).limit(10).all()
    history.reverse()
    
    # Build prompt context
    system_prompt = f"""You are a startup validation analyst for: {val.idea.title}.

First think step-by-step internally about the user's question.
Then provide a clean, structured, human-readable answer.

Rules:
- Do NOT return JSON.
- Do NOT expose internal reasoning.
- Format outputs with headings and bullet points where helpful.
- Use professional business language.
- Be concise and strategic.
- If the user suggests a major pivot, advise them to use the 'Rebuild Report' feature.

Context:
- Executive Summary: {val.executive_summary}
- Strategy Data: {json.dumps(val.structured_idea, indent=2) if val.structured_idea else 'None'}
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        messages.append({"role": m.role, "content": m.content})
        
    client = GroqClient()
    chat_cfg = get_model_config("qa_chat")
    
    response = client.chat_completion(
        model=chat_cfg.model,
        messages=messages,
        temperature=0.7,
        max_tokens=1024
    )
    
    # Save assistant message
    asst_msg = ChatMessage(validation_id=validation_id, role="assistant", content=response)
    db.add(asst_msg)
    db.commit()
    
    return asst_msg.to_dict()


# ── Full Report Regeneration ─────────────────────────────────────────

@router.post("/ideas/{idea_id}/rebuild")
async def rebuild_idea(idea_id: int, req: ChatRebuildRequest, db: Session = Depends(get_db)):
    """Update an idea's pivot instructions before triggering a re-validation."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    # Append the suggestion to the structured_input if it exists, otherwise to description
    if idea.structured_input:
        structured = dict(idea.structured_input)
        if "user_pivot_instructions" not in structured:
            structured["user_pivot_instructions"] = []
        structured["user_pivot_instructions"].append(req.user_suggestion)
        idea.structured_input = structured
    else:
        idea.description += f"\n\nStrategic Pivot Instruction: {req.user_suggestion}"
        
    # SQLAlchemy requires explicit flag for JSON mutations
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(idea, "structured_input")
        
    db.commit()
    
    return {"status": "success", "message": "Pivot instructions saved. Ready for validation."}


# ── Localized Refinement ──────────────────────────────────────────────

@router.post("/ideas/{idea_id}/refine-section")
def refine_section(idea_id: int, req: RefineSectionRequest, db: Session = Depends(get_db)):
    """Rebuilds a specific section of the business model canvas based on user feedback."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    val = idea.validations[-1] if idea.validations else None
    if not val or not val.structured_idea:
        raise HTTPException(status_code=400, detail="Idea has not been validated yet.")
        
    canvas = val.structured_idea.get("business_model_canvas", {})
    if req.section not in canvas:
        raise HTTPException(status_code=400, detail=f"Section {req.section} not found in canvas.")
        
    current_content = canvas[req.section]
    
    prompt = f"""
You are refining a specific section of a strategic Business Model Canvas for the startup: "{idea.title}".
Startup Description: {idea.description}

Section being refined: "{req.section}"
Current content of this section:
{json.dumps(current_content, indent=2)}

User Feedback / Request for Refinement:
USER: "{req.feedback}"

Your task is to rewrite ONLY this section incorporating the user's feedback. 
Maintain the structured list format. DO NOT return markdown headers, just return a JSON array of strings representing the refined points for this section.

Response format MUST be strictly a parseable JSON array of strings, for example:
[
  "First refined point...",
  "Second refined point..."
]
"""
    client = GroqClient()
    refine_cfg = get_model_config("section_refinement")
    response = client.chat_completion(
        model=refine_cfg.model,
        messages=[{"role": "system", "content": prompt}],
        temperature=refine_cfg.temperature,
        max_tokens=refine_cfg.max_tokens
    )
    
    # Parse the JSON array response
    try:
        start_idx = response.find('[')
        end_idx = response.rfind(']') + 1
        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON array found in response")
        refined_points = json.loads(response[start_idx:end_idx])
        if not isinstance(refined_points, list):
            raise ValueError("Response is not a list")
    except Exception as e:
        logger.error(f"Failed to parse refinement response: {e}\nRaw: {response}")
        raise HTTPException(status_code=500, detail="Failed to parse the refined contents from the AI.")

    # Update the DB record with the new points
    val.structured_idea["business_model_canvas"][req.section] = refined_points
    
    # SQLAlchemy JSON mutation tracking requires us to explicitly mark it as modified,
    # or re-assign the deeply nested structure:
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(val, "structured_idea")
    
    db.commit()
    return {"message": "Success", "refined_content": refined_points}


# ── Charts ───────────────────────────────────────────────────────────

@router.get("/ideas/{idea_id}/charts")
def get_charts(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    if not idea.validations:
        return []
    latest = idea.validations[0]
    return [c.to_dict() for c in latest.charts]


# ── Methodology & Glossary ───────────────────────────────────────────

@router.get("/methodology")
def get_methodology_data():
    """Return full methodology definitions for the Glossary page."""
    return get_methodology()


# ── Tasks ──────────────────────────────────────────────────────────

@router.get("/ideas/{idea_id}/tasks")
def list_tasks(idea_id: int, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.idea_id == idea_id).order_by(Task.created_at.desc()).all()
    return [t.to_dict() for t in tasks]

@router.post("/ideas/{idea_id}/tasks", status_code=201)
def create_task(idea_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(idea_id=idea_id, **payload.dict())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task.to_dict()

@router.put("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
        
    db.commit()
    db.refresh(task)
    return task.to_dict()

@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


# ── Journal Entries ────────────────────────────────────────────────

@router.get("/ideas/{idea_id}/journal")
def list_journal_entries(idea_id: int, db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).filter(JournalEntry.idea_id == idea_id).order_by(JournalEntry.created_at.desc()).all()
    return [e.to_dict() for e in entries]

@router.post("/ideas/{idea_id}/journal", status_code=201)
def create_journal_entry(idea_id: int, payload: JournalEntryCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    data['tags'] = ",".join(data.pop('tags', []))
    entry = JournalEntry(idea_id=idea_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry.to_dict()

@router.delete("/journal/{entry_id}", status_code=204)
def delete_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    db.delete(entry)
    db.commit()


# ── Experiments ────────────────────────────────────────────────────

@router.get("/ideas/{idea_id}/experiments")
def list_experiments(idea_id: int, db: Session = Depends(get_db)):
    exps = db.query(Experiment).filter(Experiment.idea_id == idea_id).order_by(Experiment.created_at.desc()).all()
    return [e.to_dict() for e in exps]

@router.post("/ideas/{idea_id}/experiments", status_code=201)
def create_experiment(idea_id: int, payload: ExperimentCreate, db: Session = Depends(get_db)):
    exp = Experiment(idea_id=idea_id, **payload.dict())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp.to_dict()

@router.put("/experiments/{exp_id}")
def update_experiment(exp_id: int, payload: ExperimentUpdate, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == exp_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(exp, key, value)
        
    db.commit()
    db.refresh(exp)
    return exp.to_dict()

@router.delete("/experiments/{exp_id}", status_code=204)
def delete_experiment(exp_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == exp_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    db.delete(exp)
    db.commit()


# ── Sticky Notes ───────────────────────────────────────────────────

@router.get("/ideas/{idea_id}/sticky_notes")
def list_sticky_notes(idea_id: int, db: Session = Depends(get_db)):
    notes = db.query(StickyNote).filter(StickyNote.idea_id == idea_id).all()
    return [n.to_dict() for n in notes]

@router.post("/ideas/{idea_id}/sticky_notes", status_code=201)
def create_sticky_note(idea_id: int, payload: StickyNoteCreate, db: Session = Depends(get_db)):
    note = StickyNote(idea_id=idea_id, **payload.dict())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note.to_dict()

@router.put("/sticky_notes/{note_id}")
def update_sticky_note(note_id: int, payload: StickyNoteUpdate, db: Session = Depends(get_db)):
    note = db.query(StickyNote).filter(StickyNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Sticky note not found")
    
    update_data = payload.dict(exclude_unset=True)
    if 'is_visible' in update_data:
        update_data['is_visible'] = 1 if update_data['is_visible'] else 0
    if 'is_pinned' in update_data:
        update_data['is_pinned'] = 1 if update_data['is_pinned'] else 0
        
    for key, value in update_data.items():
        setattr(note, key, value)
        
    db.commit()
    db.refresh(note)
    return note.to_dict()

@router.delete("/sticky_notes/{note_id}", status_code=204)
def delete_sticky_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(StickyNote).filter(StickyNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Sticky note not found")
    db.delete(note)
    db.commit()


# ── Meetings ────────────────────────────────────────────────────────────────

from server.db_models import Meeting

@router.get("/ideas/{idea_id}/meetings")
def list_meetings(idea_id: int, db: Session = Depends(get_db)):
    meetings = db.query(Meeting).filter(Meeting.idea_id == idea_id).order_by(Meeting.date.desc()).all()
    return [m.to_dict() for m in meetings]

@router.post("/ideas/{idea_id}/meetings", status_code=201)
def create_meeting(idea_id: int, payload: MeetingCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    if data.get('date'):
        from datetime import datetime
        data['date'] = datetime.fromisoformat(data['date'])
    meeting = Meeting(idea_id=idea_id, **data)
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting.to_dict()

@router.put("/meetings/{meeting_id}")
def update_meeting(meeting_id: int, payload: MeetingUpdate, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    update_data = payload.dict(exclude_unset=True)
    if 'date' in update_data and update_data['date']:
        from datetime import datetime
        update_data['date'] = datetime.fromisoformat(update_data['date'])
    for key, value in update_data.items():
        setattr(meeting, key, value)
    db.commit()
    db.refresh(meeting)
    return meeting.to_dict()

@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()


# ── Expenses ────────────────────────────────────────────────────────────────

from server.db_models import Expense

@router.get("/ideas/{idea_id}/expenses")
def list_expenses(idea_id: int, db: Session = Depends(get_db)):
    expenses = db.query(Expense).filter(Expense.idea_id == idea_id).order_by(Expense.date.desc()).all()
    return [e.to_dict() for e in expenses]

@router.post("/ideas/{idea_id}/expenses", status_code=201)
def create_expense(idea_id: int, payload: ExpenseCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    if data.get('date'):
        from datetime import datetime
        data['date'] = datetime.fromisoformat(data['date'])
    expense = Expense(idea_id=idea_id, **data)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense.to_dict()

@router.put("/expenses/{expense_id}")
def update_expense(expense_id: int, payload: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    update_data = payload.dict(exclude_unset=True)
    if 'date' in update_data and update_data['date']:
        from datetime import datetime
        update_data['date'] = datetime.fromisoformat(update_data['date'])
    for key, value in update_data.items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense.to_dict()

@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()


# ── User Preferences ────────────────────────────────────────────────────────

from server.db_models import UserPreference

@router.get("/user/preferences")
def get_user_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        return {"theme": "system", "preferences": {}}
    return pref.to_dict()

@router.put("/user/preferences")
def update_user_preferences(payload: UserPreferenceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)
    db.commit()
    db.refresh(pref)
    return pref.to_dict()

# ── Agent Timeline (V2 OS) ────────────────────────────────────────────────

@router.get("/validations/{validation_id}/timeline")
def get_validation_timeline(validation_id: int, db: Session = Depends(get_db)):
    """Fetch all agent activity logs for a validation iteration."""
    session = db.query(AgentSession).filter(AgentSession.validation_id == validation_id).first()
    if not session:
        return []
    
    messages = session.messages
    return [m.to_dict() for m in messages]


@router.post("/ideas/{idea_id}/generate-risks")
async def api_generate_risks(idea_id: int, db: Session = Depends(get_db)):
    """Trigger a standalone AI deep dive into risks and moats."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    latest_val = idea.validations[0] if idea.validations else None
    if not latest_val:
        raise HTTPException(status_code=400, detail="Run initial validation first")

    result = await generate_risk_analysis(idea.description, latest_val.structured_idea)
    
    # Merge into agent_outputs
    outputs = dict(latest_val.agent_outputs)
    outputs["risk_inversion"] = result
    latest_val.agent_outputs = outputs
    
    # Update structured_idea if relevant fields exist in result
    if "swot_analysis" in result or "moats_analysis" in result:
         struct = dict(latest_val.structured_idea)
         if "swot_analysis" in result: struct["swot_analysis"] = result["swot_analysis"]
         if "moats_analysis" in result: struct["moats_analysis"] = result["moats_analysis"]
         latest_val.structured_idea = struct

    db.commit()
    return {"status": "success", "risk_analysis": result}


@router.post("/ideas/{idea_id}/generate-financials")
async def api_generate_financials(idea_id: int, db: Session = Depends(get_db)):
    """Trigger a standalone AI deep dive into market and financials."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    latest_val = idea.validations[0] if idea.validations else None
    if not latest_val:
        raise HTTPException(status_code=400, detail="Run initial validation first")

    result = await generate_market_financial_analysis(idea.description, latest_val.structured_idea)
    
    # Merge into agent_outputs
    outputs = dict(latest_val.agent_outputs)
    outputs["market_research"] = result["market_research"]
    outputs["pricing_strategy"] = result["pricing_strategy"]
    latest_val.agent_outputs = outputs
    
    db.commit()
    return {"status": "success", "financials": result}


@router.post("/validations/{validation_id}/summarize")
async def summarize_validation(validation_id: int, db: Session = Depends(get_db)):
    """Regenerate the executive summary for a specific validation."""
    val = db.query(Validation).filter(Validation.id == validation_id).first()
    if not val:
        raise HTTPException(status_code=404, detail="Validation not found")
    
    idea = val.idea
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found for validation")

    new_exec = await regenerate_validation_summary(
        idea.description,
        val.agent_outputs,
        val.final_score,
        val.decision,
        val.confidence_index,
    )
    
    val.executive_summary = new_exec
    db.commit()
    return new_exec
