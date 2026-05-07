"""add user listing columns

Revision ID: fa90864f4bb7
Revises: f0403e042e9e
Create Date: 2026-05-07 22:01:40.947509

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fa90864f4bb7'
down_revision: Union[str, Sequence[str], None] = 'f0403e042e9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user-listing columns to listings and motorcycle_listings."""
    # listings table
    op.add_column('listings', sa.Column('is_user_submitted', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('listings', sa.Column('listing_status', sa.String(length=20), server_default='approved', nullable=False))
    op.add_column('listings', sa.Column('submitted_by_user_id', sa.Integer(), nullable=True))
    op.add_column('listings', sa.Column('seller_phone', sa.String(length=50), nullable=True))
    op.add_column('listings', sa.Column('seller_name', sa.String(length=200), nullable=True))
    op.add_column('listings', sa.Column('description', sa.Text(), nullable=True))
    op.alter_column('listings', 'url', existing_type=sa.TEXT(), nullable=True)
    op.create_index(op.f('ix_listings_listing_status'), 'listings', ['listing_status'], unique=False)
    op.create_foreign_key('fk_listings_submitted_by_user_id', 'listings', 'users', ['submitted_by_user_id'], ['id'], ondelete='SET NULL')

    # motorcycle_listings table
    op.add_column('motorcycle_listings', sa.Column('is_user_submitted', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('motorcycle_listings', sa.Column('listing_status', sa.String(length=20), server_default='approved', nullable=False))
    op.add_column('motorcycle_listings', sa.Column('submitted_by_user_id', sa.Integer(), nullable=True))
    op.add_column('motorcycle_listings', sa.Column('seller_phone', sa.String(length=50), nullable=True))
    op.add_column('motorcycle_listings', sa.Column('seller_name', sa.String(length=200), nullable=True))
    op.add_column('motorcycle_listings', sa.Column('description', sa.Text(), nullable=True))
    op.alter_column('motorcycle_listings', 'url', existing_type=sa.TEXT(), nullable=True)
    op.create_index(op.f('ix_motorcycle_listings_listing_status'), 'motorcycle_listings', ['listing_status'], unique=False)
    op.create_foreign_key('fk_motorcycle_listings_submitted_by_user_id', 'motorcycle_listings', 'users', ['submitted_by_user_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Remove user-listing columns from listings and motorcycle_listings."""
    # motorcycle_listings table
    op.drop_constraint('fk_motorcycle_listings_submitted_by_user_id', 'motorcycle_listings', type_='foreignkey')
    op.drop_index(op.f('ix_motorcycle_listings_listing_status'), table_name='motorcycle_listings')
    op.alter_column('motorcycle_listings', 'url', existing_type=sa.TEXT(), nullable=False)
    op.drop_column('motorcycle_listings', 'description')
    op.drop_column('motorcycle_listings', 'seller_name')
    op.drop_column('motorcycle_listings', 'seller_phone')
    op.drop_column('motorcycle_listings', 'submitted_by_user_id')
    op.drop_column('motorcycle_listings', 'listing_status')
    op.drop_column('motorcycle_listings', 'is_user_submitted')

    # listings table
    op.drop_constraint('fk_listings_submitted_by_user_id', 'listings', type_='foreignkey')
    op.drop_index(op.f('ix_listings_listing_status'), table_name='listings')
    op.alter_column('listings', 'url', existing_type=sa.TEXT(), nullable=False)
    op.drop_column('listings', 'description')
    op.drop_column('listings', 'seller_name')
    op.drop_column('listings', 'seller_phone')
    op.drop_column('listings', 'submitted_by_user_id')
    op.drop_column('listings', 'listing_status')
    op.drop_column('listings', 'is_user_submitted')
