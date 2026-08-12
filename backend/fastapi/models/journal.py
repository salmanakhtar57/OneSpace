from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime, timezone
from app.models.base import Base


def _now():
    return datetime.now(timezone.utc)


class Journal(Base):
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True, default="")
    entry_date = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
