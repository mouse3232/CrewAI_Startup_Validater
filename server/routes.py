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
from server.db_models import Idea, Validation, ChartData, Task, JournalEntry, Experiment, StickyNote
from server.schemas import (
    IdeaCreate, IdeaUpdate,
    QARequest, QAResponse,
    RefineSectionRequest,
    WebValidateRequest,
    TaskCreate, TaskUpdate,
    JournalEntryCreate,
    ExperimentCreate, ExperimentUpdate,
    StickyNoteCreate, StickyNoteUpdate
)
from crew_runner import run_validation
from core.groq_client import GroqClient
from core.token_tracker import tracker
from core.model_router import get_model_config, MODELS, USER_DISABLED_MODELS
from core.methodology import get_methodology
from core.scoring_engine import (
    compute_weighted_breakdown, compute_scenario_scores, compute_sensitivity
)
from core.web_validator import detect_intent, quick_validate, deep_validate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ── System Health & Monitoring ──────────────────────────────────────

@router.get("/system/models/status")
def get_model_status():
    """Returns real-time RPM/TPM usage against defined model limits."""
    metrics = tracker.get_all_metrics()
    status_report = []
    
    controlled_models = {"gpt-120b", "gpt-20b", "gpt-safeguard", "llama-70b"}
    
    for model_key, config in MODELS.items():
        usage = metrics.get(config.model, {"rpm": 0, "tpm": 0})
        
        # Determine status color tier
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
        
    return {"models": status_report}

from pydantic import BaseModel
class ToggleRequest(BaseModel):
    enabled: bool

@router.post("/system/models/{model_id}/toggle")
def toggle_model(model_id: str, payload: ToggleRequest):
    if model_id not in MODELS:
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
def list_ideas(db: Session = Depends(get_db)):
    ideas = db.query(Idea).order_by(Idea.updated_at.desc()).all()
    return [i.to_dict() for i in ideas]


@router.post("/ideas", status_code=201)
def create_idea(payload: IdeaCreate, db: Session = Depends(get_db)):
    idea = Idea(title=payload.title, description=payload.description)
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea.to_dict()


@router.get("/ideas/{idea_id}")
def get_idea(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
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
def update_idea(idea_id: int, payload: IdeaUpdate, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    if payload.title is not None:
        idea.title = payload.title
    if payload.description is not None:
        idea.description = payload.description
    db.commit()
    db.refresh(idea)
    return idea.to_dict()


@router.delete("/ideas/{idea_id}", status_code=204)
def delete_idea(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    db.delete(idea)
    db.commit()
    return None


# ── Validation ───────────────────────────────────────────────────────

@router.post("/ideas/{idea_id}/validate")
async def trigger_validation(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    idea.status = "validating"
    db.commit()

    try:
        result = await run_validation(idea.description)
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

        task = asyncio.create_task(
            run_validation(idea.description, status_cb=status_callback)
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

        # Persist
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

        for chart in result.get("chart_payloads", []):
            db.add(ChartData(
                validation_id=validation.id,
                chart_type=chart["chart_type"],
                chart_payload=chart["chart_payload"],
            ))

        idea.status = "completed"
        db.commit()
        db.refresh(validation)

        yield {
            "event": "complete",
            "data": json.dumps(validation.to_dict()),
        }

    return EventSourceResponse(event_generator())


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
        prompt = f"""You are the Strategic AI Validator for a startup idea.
The user is asking about the '{req.section}' section of their Business Model Canvas.

Idea: {idea.title}
Description: {idea.description}
Section Content: {json.dumps(section_content, indent=2)}

User Question: {req.question}

Provide a concise, strategic answer (max 3-4 sentences). Be direct and actionable."""

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
