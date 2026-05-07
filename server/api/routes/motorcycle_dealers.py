from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.deps import get_db
from api.services.motorcycle_service import list_motorcycle_dealers, get_motorcycle_dealer

router = APIRouter()


@router.get("")
def get_dealers(db: Session = Depends(get_db)):
    return list_motorcycle_dealers(db)


@router.get("/{dealer_id}")
def get_dealer_detail(dealer_id: int, db: Session = Depends(get_db)):
    return get_motorcycle_dealer(db, dealer_id)
