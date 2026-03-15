"""
FastAPI dependencies – DB session and auth.
"""
import os
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWKClient
import requests as http_requests

from db.database import SessionLocal
from db.models import User, UserStatus

logger = logging.getLogger(__name__)

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# JWKS client for ES256 token verification (caches keys automatically)
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the Supabase JWT, look up or create the local User row.
    Supports both HS256 (legacy) and ES256 (new) Supabase JWTs.
    """
    token = credentials.credentials
    try:
        # Try JWKS-based verification first (ES256)
        if SUPABASE_URL:
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            # Fallback to legacy HS256
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"[AUTH] FAILED: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    supabase_id: str = payload.get("sub", "")
    if not supabase_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Look up existing user
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        # Auto-create on first authenticated request
        email = payload.get("email", "")
        user_meta = payload.get("user_metadata", {})
        name = user_meta.get("name", email.split("@")[0] if email else "User")
        user = User(
            supabase_id=supabase_id,
            name=name,
            email=email,
            status=UserStatus.free,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


def delete_supabase_user(supabase_id: str) -> bool:
    """Delete a user from Supabase Auth using the Admin API.
    Returns True on success, False on failure. Logs errors."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Cannot delete Supabase user: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        return False
    try:
        resp = http_requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{supabase_id}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10,
        )
        if resp.status_code in (200, 204):
            return True
        logger.error(f"Supabase user deletion failed: {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Supabase user deletion error: {e}")
        return False
