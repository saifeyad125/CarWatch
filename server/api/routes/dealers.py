from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.deps import get_db
from api.services.dealer_cars_service import list_dealers, get_dealer

router = APIRouter()


@router.get("")
def get_dealers(db: Session = Depends(get_db)):
    return list_dealers(db)


@router.get("/{dealer_id}")
def get_dealer_detail(dealer_id: int, db: Session = Depends(get_db)):
    return get_dealer(db, dealer_id)
