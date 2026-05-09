from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db
from app.models.journal import Journal
from app.schemas.journal import JournalCreate, JournalUpdate, JournalResponse, JournalListItem

router = APIRouter(prefix="/journals", tags=["journals"])


@router.get("/", response_model=List[JournalListItem])
def list_journals(db: Session = Depends(get_db)):
    return db.query(Journal).order_by(Journal.entry_date.desc()).all()


@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
def create_journal(payload: JournalCreate, db: Session = Depends(get_db)):
    journal = Journal(title=payload.title, content=payload.content)
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return journal


@router.get("/{journal_id}", response_model=JournalResponse)
def get_journal(journal_id: int, db: Session = Depends(get_db)):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    return journal


@router.put("/{journal_id}", response_model=JournalResponse)
def update_journal(journal_id: int, payload: JournalUpdate, db: Session = Depends(get_db)):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    if payload.title is not None:
        journal.title = payload.title
    if payload.content is not None:
        journal.content = payload.content
    db.commit()
    db.refresh(journal)
    return journal


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal(journal_id: int, db: Session = Depends(get_db)):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    db.delete(journal)
    db.commit()
