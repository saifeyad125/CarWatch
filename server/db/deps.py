"""
FastAPI dependency – yields a DB session per request.
"""
from db.database import SessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
