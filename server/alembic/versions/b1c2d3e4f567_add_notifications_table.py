"""add notifications table

Revision ID: b1c2d3e4f567
Revises: 4edfcdf5b618
Create Date: 2026-02-28 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f567'
down_revision: Union[str, Sequence[str], None] = '4edfcdf5b618'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('watchlist_id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=True),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.String(500), nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['watchlist_id'], ['watchlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')
