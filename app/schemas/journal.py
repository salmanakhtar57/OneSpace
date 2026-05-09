from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class JournalCreate(BaseModel):
    title: str
    content: Optional[str] = ""


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class JournalResponse(BaseModel):
    id: int
    title: str
    content: Optional[str]
    entry_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalListItem(BaseModel):
    id: int
    title: str
    entry_date: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
