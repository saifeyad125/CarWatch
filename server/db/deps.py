"""
FastAPI dependencies – DB session and auth.
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from db.database import SessionLocal
from db.models import User, UserStatus


security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the Supabase JWT, look up or create the local User row.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    supabase_id: str = payload.get("sub", "")
    if not supabase_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Look up existing user
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        # Auto-create on first authenticated request
        email = payload.get("email", "")
        user = User(
            supabase_id=supabase_id,
            name=email.split("@")[0] if email else "User",
            email=email,
            status=UserStatus.free,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
