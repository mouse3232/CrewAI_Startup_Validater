"""
ORM Models — Ideas, Validations, ChartData.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship

from server.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft | validating | completed
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    validations = relationship(
        "Validation", back_populates="idea", cascade="all, delete-orphan",
        order_by="Validation.created_at.desc()",
    )
    tasks = relationship(
        "Task", back_populates="idea", cascade="all, delete-orphan",
        order_by="Task.created_at.desc()",
    )
    journal_entries = relationship(
        "JournalEntry", back_populates="idea", cascade="all, delete-orphan",
        order_by="JournalEntry.created_at.desc()",
    )
    experiments = relationship(
        "Experiment", back_populates="idea", cascade="all, delete-orphan",
        order_by="Experiment.created_at.desc()",
    )
    sticky_notes = relationship(
        "StickyNote", back_populates="idea", cascade="all, delete-orphan",
        order_by="StickyNote.created_at.desc()",
    )

    def to_dict(self):
        latest = self.validations[0] if self.validations else None
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "latest_score": latest.final_score if latest else None,
            "latest_decision": latest.decision if latest else None,
            "validation_count": len(self.validations),
            "tasks_total": len(self.tasks),
            "tasks_completed": sum(1 for t in self.tasks if t.status == 'done'),
            "experiments_total": len(self.experiments),
            "journal_entries": len(self.journal_entries)
        }


class Validation(Base):
    __tablename__ = "validations"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    iteration = Column(Integer, default=1)
    agent_outputs = Column(JSON, default=dict)
    structured_idea = Column(JSON, default=dict)
    final_score = Column(Float, nullable=True)
    decision = Column(String(20), nullable=True)
    confidence_index = Column(Float, nullable=True)
    executive_summary = Column(JSON, default=dict)
    score_history = Column(JSON, default=list)
    refinement_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)

    idea = relationship("Idea", back_populates="validations")
    charts = relationship(
        "ChartData", back_populates="validation", cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "iteration": self.iteration,
            "agent_outputs": self.agent_outputs,
            "structured_idea": self.structured_idea,
            "final_score": self.final_score,
            "decision": self.decision,
            "confidence_index": self.confidence_index,
            "executive_summary": self.executive_summary,
            "score_history": self.score_history,
            "refinement_history": self.refinement_history,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ChartData(Base):
    __tablename__ = "chart_data"

    id = Column(Integer, primary_key=True, index=True)
    validation_id = Column(
        Integer, ForeignKey("validations.id", ondelete="CASCADE"), nullable=False,
    )
    chart_type = Column(String(100), nullable=False)  # radar | bar | canvas | gauge
    chart_payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)

    validation = relationship("Validation", back_populates="charts")

    def to_dict(self):
        return {
            "id": self.id,
            "validation_id": self.validation_id,
            "chart_type": self.chart_type,
            "chart_payload": self.chart_payload,
        }


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")  # low | medium | high | urgent
    related_section = Column(String(100), nullable=True) # Validation canvas section
    assigned_agent = Column(String(100), nullable=True)
    start_date = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    status = Column(String(50), default="planned")  # planned | in_progress | testing | completed | blocked
    progress = Column(Integer, default=0) # 0-100
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    idea = relationship("Idea", back_populates="tasks")
    journal_entries = relationship("JournalEntry", back_populates="task", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "related_section": self.related_section,
            "assigned_agent": self.assigned_agent,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "status": self.status,
            "progress": self.progress,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    tags = Column(String(255), nullable=True) # comma separated
    created_at = Column(DateTime, default=_utcnow)

    idea = relationship("Idea", back_populates="journal_entries")
    task = relationship("Task", back_populates="journal_entries")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "task_id": self.task_id,
            "content": self.content,
            "tags": self.tags.split(',') if self.tags else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    hypothesis = Column(Text, nullable=False)
    metric = Column(String(255), nullable=False)
    target_criteria = Column(String(255), nullable=False)
    timeframe = Column(String(50), nullable=True)
    outcome = Column(Text, nullable=True)
    status = Column(String(50), default="planned") # planned | running | concluded
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    idea = relationship("Idea", back_populates="experiments")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "hypothesis": self.hypothesis,
            "metric": self.metric,
            "target_criteria": self.target_criteria,
            "timeframe": self.timeframe,
            "outcome": self.outcome,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class StickyNote(Base):
    __tablename__ = "sticky_notes"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(String(100), nullable=False) # e.g. "problem", "solution"
    content = Column(Text, nullable=False)
    is_visible = Column(Integer, default=1) # 1 true, 0 false
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)

    idea = relationship("Idea", back_populates="sticky_notes")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "section_id": self.section_id,
            "content": self.content,
            "is_visible": bool(self.is_visible),
            "position_x": self.position_x,
            "position_y": self.position_y,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
