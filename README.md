# OneSpace

OneSpace is a unified productivity app that combines journaling, habit tracking, and task management in one place — built to cut down on app-switching in daily routines.


## Current Status

🚧 **Phase 1 — Journal Module**

Currently building:
- Journal APIs (backend)
- Journal frontend

Nothing else (Auth, Dashboard, Habits, Tasks) is implemented yet.

## Tech Stack

**Backend:** FastAPI, PostgreSQL, SQLAlchemy
**Frontend:** Vanilla JavaScript

## Journal Module (in progress)

Planned endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/journal` | Create a journal entry |
| GET | `/journal/{date}` | Get entry by date |
| GET | `/journal` | List entries (paginated) |
| PUT | `/journal/{id}` | Update an entry |
| DELETE | `/journal/{id}` | Delete an entry |
| GET | `/journal/streak` | Get writing streak |

## Setup

```bash
# clone the repo
git clone <repo-url>
cd onespace

# backend setup
cd backend
pip install -r requirements.txt

# run the server
uvicorn main:app --reload
```

## Roadmap

- [x] Project planning & architecture
- [ ] Journal module (APIs + frontend)
- [ ] Auth module
- [ ] Habit tracker
- [ ] Task manager
- [ ] Dashboard (aggregation)

---
*More details coming soon as each module is completed.*