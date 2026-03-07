"""
Chat endpoints — authenticated, user-scoped.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from db.deps import get_db, get_current_user
from db.models import User, ChatConversation, ChatMessage
from models.schemas import (
    ChatConversationSummary,
    ChatConversationDetail,
    ChatMessageResponse,
    ChatSendMessage,
)
from api.services.chat_service import stream_chat_response

router = APIRouter()


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


@router.post("/conversations", response_model=ChatConversationSummary)
def create_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = ChatConversation(
        user_id=current_user.id,
        title="New conversation",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ChatConversationSummary(
        id=conv.id,
        title=conv.title,
        lastMessage=None,
        updatedAt=_iso(conv.updated_at),
    )


@router.get("/conversations", response_model=list[ChatConversationSummary])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    convs = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == current_user.id)
        .order_by(ChatConversation.updated_at.desc())
        .all()
    )
    results = []
    for c in convs:
        last_msg = None
        if c.messages:
            last_msg = c.messages[-1].content[:100]
        results.append(
            ChatConversationSummary(
                id=c.id,
                title=c.title,
                lastMessage=last_msg,
                updatedAt=_iso(c.updated_at),
            )
        )
    return results


@router.get("/conversations/{conv_id}", response_model=ChatConversationDetail)
def get_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conv_id,
            ChatConversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ChatConversationDetail(
        id=conv.id,
        title=conv.title,
        messages=[
            ChatMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                createdAt=_iso(m.created_at),
            )
            for m in conv.messages
        ],
    )


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conv_id,
            ChatConversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"ok": True}


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: int,
    body: ChatSendMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conv_id,
            ChatConversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save the user message
    user_msg = ChatMessage(
        conversation_id=conv.id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # Auto-title: set title from first user message
    user_messages = [m for m in conv.messages if m.role == "user"]
    if len(user_messages) == 0:
        conv.title = body.content[:50]

    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)

    # Build conversation history
    history = [{"role": m.role, "content": m.content} for m in conv.messages]

    async def generate():
        text_parts = []
        async for chunk in stream_chat_response(
            message=body.content,
            conversation_history=history,
            user_id=current_user.id,
            db=db,
        ):
            # Extract text from SSE data chunks for saving
            if chunk.startswith('data: {'):
                try:
                    data = json.loads(chunk[6:].strip())
                    if "text" in data:
                        text_parts.append(data["text"])
                except json.JSONDecodeError:
                    pass
            yield chunk

        # Save the full assistant response
        if text_parts:
            assistant_msg = ChatMessage(
                conversation_id=conv.id,
                role="assistant",
                content="".join(text_parts),
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.now(timezone.utc)
            db.commit()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
