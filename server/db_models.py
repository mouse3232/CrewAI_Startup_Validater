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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100))
    created_at = Column(DateTime, default=_utcnow)

    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    projects = relationship("Idea", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="viewer")  # owner, admin, editor, viewer
    created_at = Column(DateTime, default=_utcnow)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True) # Nullable for legacy support
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft | validating | completed
    structured_input = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    workspace = relationship("Workspace", back_populates="projects")
    tabs = relationship(
        "ProjectTab", back_populates="idea", cascade="all, delete-orphan",
        order_by="ProjectTab.order",
    )

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
    meetings = relationship(
        "Meeting", back_populates="idea", cascade="all, delete-orphan",
        order_by="Meeting.created_at.desc()",
    )
    expenses = relationship(
        "Expense", back_populates="idea", cascade="all, delete-orphan",
        order_by="Expense.created_at.desc()",
    )

    def to_dict(self):
        latest = self.validations[0] if self.validations else None
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "structured_input": self.structured_input,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "latest_score": latest.final_score if latest else None,
            "latest_decision": latest.decision if latest else None,
            "validation_count": len(self.validations),
            "tasks_total": len(self.tasks),
            "tasks_completed": sum(1 for t in self.tasks if t.status == 'done'),
            "experiments_total": len(self.experiments),
            "meetings_count": len(self.meetings),
            "journal_entries": len(self.journal_entries)
        }


class ProjectTab(Base):
    __tablename__ = "project_tabs"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)
    
    idea = relationship("Idea", back_populates="tabs")
    blocks = relationship("ContentBlock", back_populates="tab", cascade="all, delete-orphan", order_by="ContentBlock.order")


class ContentBlock(Base):
    __tablename__ = "content_blocks"

    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("project_tabs.id", ondelete="CASCADE"), nullable=False)
    block_type = Column(String(50), default="text")  # text, kanban, table, chart, etc
    content = Column(JSON, default=dict)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    
    tab = relationship("ProjectTab", back_populates="blocks")
    revisions = relationship("BlockRevision", back_populates="block", cascade="all, delete-orphan", order_by="BlockRevision.created_at.desc()")


class BlockRevision(Base):
    __tablename__ = "block_revisions"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("content_blocks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    old_content = Column(JSON, default=dict)
    new_content = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    
    block = relationship("ContentBlock", back_populates="revisions")
    user = relationship("User")


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
    agent_sessions = relationship(
        "AgentSession", back_populates="validation", cascade="all, delete-orphan"
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
    color = Column(String(20), default="yellow")
    is_visible = Column(Integer, default=1) # 1 true, 0 false
    is_pinned = Column(Integer, default=0) # 1 pinned (fixed position), 0 free
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=220)
    height = Column(Integer, default=200)
    assigned_user = Column(String(100), nullable=True)
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    idea = relationship("Idea", back_populates="sticky_notes")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "section_id": self.section_id,
            "content": self.content,
            "color": self.color or "yellow",
            "is_visible": bool(self.is_visible),
            "is_pinned": bool(self.is_pinned),
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width or 220,
            "height": self.height or 200,
            "assigned_user": self.assigned_user,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    validation_id = Column(Integer, ForeignKey("validations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    
    validation = relationship("Validation", backref="chat_messages")
    
    def to_dict(self):
        return {
            "id": self.id,
            "validation_id": self.validation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    date = Column(DateTime, nullable=True)
    participants = Column(JSON, default=list)  # ["name1", "name2"]
    notes = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    tasks_assigned = Column(JSON, default=list)  # [{title, assignee}]
    attachments = Column(JSON, default=list)  # [{name, url}]
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    idea = relationship("Idea", back_populates="meetings")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "title": self.title,
            "date": self.date.isoformat() if self.date else None,
            "participants": self.participants or [],
            "notes": self.notes,
            "decisions": self.decisions,
            "tasks_assigned": self.tasks_assigned or [],
            "attachments": self.attachments or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    idea_id = Column(Integer, ForeignKey("ideas.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    estimated_cost = Column(Float, default=0)
    actual_cost = Column(Float, default=0)
    status = Column(String(50), default="planned")  # planned | spent
    date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    idea = relationship("Idea", back_populates="expenses")

    def to_dict(self):
        return {
            "id": self.id,
            "idea_id": self.idea_id,
            "title": self.title,
            "category": self.category,
            "estimated_cost": self.estimated_cost,
            "actual_cost": self.actual_cost,
            "status": self.status,
            "date": self.date.isoformat() if self.date else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    theme = Column(String(20), default="system")  # light | dark | system
    preferences = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", backref="preferences")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "theme": self.theme,
            "preferences": self.preferences or {},
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", backref="activity_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    validation_id = Column(Integer, ForeignKey("validations.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="active") # active, completed, failed
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    validation = relationship("Validation", back_populates="agent_sessions")
    messages = relationship("AgentMessage", back_populates="session", cascade="all, delete-orphan", order_by="AgentMessage.created_at.asc()")

    def to_dict(self):
        return {
            "id": self.id,
            "validation_id": self.validation_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String(100), nullable=False)
    step_name = Column(String(100), nullable=True)
    content = Column(Text, nullable=False)
    status = Column(String(50), default="started") # started, completed, error
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)

    session = relationship("AgentSession", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "agent_name": self.agent_name,
            "step_name": self.step_name,
            "content": self.content,
            "status": self.status,
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
