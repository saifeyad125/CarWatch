"""add motorcycle tables

Revision ID: f0403e042e9e
Revises: b1c2d3e4f567
Create Date: 2026-05-07 16:45:17.924172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f0403e042e9e'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('motorcycle_dealers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('logo_url', sa.Text(), nullable=True),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=50), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('is_seed', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_motorcycle_dealers_id'), 'motorcycle_dealers', ['id'], unique=False)

    op.create_table('motorcycle_listings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('brand', sa.String(length=100), nullable=False),
    sa.Column('model', sa.String(length=200), nullable=False),
    sa.Column('trim', sa.String(length=200), nullable=True),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('kms', sa.Integer(), nullable=True),
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('engine_cc', sa.Integer(), nullable=True),
    sa.Column('motorcycle_type', sa.String(length=50), nullable=True),
    sa.Column('horsepower', sa.String(length=50), nullable=True),
    sa.Column('fuel_type', sa.String(length=50), nullable=True),
    sa.Column('exterior_color', sa.String(length=50), nullable=True),
    sa.Column('regional_specs', sa.String(length=50), nullable=True),
    sa.Column('image', sa.Text(), nullable=True),
    sa.Column('images', sa.JSON(), nullable=True),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=False),
    sa.Column('predicted_price', sa.Integer(), nullable=True),
    sa.Column('deal_label', sa.String(length=20), nullable=True),
    sa.Column('sigma_log', sa.Float(), nullable=True),
    sa.Column('confidence_low', sa.Integer(), nullable=True),
    sa.Column('confidence_high', sa.Integer(), nullable=True),
    sa.Column('depreciation_data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('url')
    )
    op.create_index(op.f('ix_motorcycle_listings_brand'), 'motorcycle_listings', ['brand'], unique=False)
    op.create_index(op.f('ix_motorcycle_listings_id'), 'motorcycle_listings', ['id'], unique=False)
    op.create_index(op.f('ix_motorcycle_listings_model'), 'motorcycle_listings', ['model'], unique=False)
    op.create_index(op.f('ix_motorcycle_listings_source'), 'motorcycle_listings', ['source'], unique=False)
    op.create_index(op.f('ix_motorcycle_listings_year'), 'motorcycle_listings', ['year'], unique=False)

    op.create_table('dealer_motorcycle_listings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('dealer_id', sa.Integer(), nullable=False),
    sa.Column('brand', sa.String(length=100), nullable=False),
    sa.Column('model', sa.String(length=200), nullable=False),
    sa.Column('trim', sa.String(length=200), nullable=True),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('kms', sa.Integer(), nullable=True),
    sa.Column('url', sa.Text(), nullable=True),
    sa.Column('engine_cc', sa.Integer(), nullable=True),
    sa.Column('motorcycle_type', sa.String(length=50), nullable=True),
    sa.Column('horsepower', sa.String(length=50), nullable=True),
    sa.Column('fuel_type', sa.String(length=50), nullable=True),
    sa.Column('exterior_color', sa.String(length=50), nullable=True),
    sa.Column('regional_specs', sa.String(length=50), nullable=True),
    sa.Column('image', sa.Text(), nullable=True),
    sa.Column('images', sa.JSON(), nullable=True),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('predicted_price', sa.Integer(), nullable=True),
    sa.Column('deal_label', sa.String(length=20), nullable=True),
    sa.Column('sigma_log', sa.Float(), nullable=True),
    sa.Column('confidence_low', sa.Integer(), nullable=True),
    sa.Column('confidence_high', sa.Integer(), nullable=True),
    sa.Column('depreciation_data', sa.JSON(), nullable=True),
    sa.Column('is_seed', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['dealer_id'], ['motorcycle_dealers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dealer_motorcycle_listings_brand'), 'dealer_motorcycle_listings', ['brand'], unique=False)
    op.create_index(op.f('ix_dealer_motorcycle_listings_dealer_id'), 'dealer_motorcycle_listings', ['dealer_id'], unique=False)
    op.create_index(op.f('ix_dealer_motorcycle_listings_id'), 'dealer_motorcycle_listings', ['id'], unique=False)
    op.create_index(op.f('ix_dealer_motorcycle_listings_model'), 'dealer_motorcycle_listings', ['model'], unique=False)
    op.create_index(op.f('ix_dealer_motorcycle_listings_year'), 'dealer_motorcycle_listings', ['year'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_dealer_motorcycle_listings_year'), table_name='dealer_motorcycle_listings')
    op.drop_index(op.f('ix_dealer_motorcycle_listings_model'), table_name='dealer_motorcycle_listings')
    op.drop_index(op.f('ix_dealer_motorcycle_listings_id'), table_name='dealer_motorcycle_listings')
    op.drop_index(op.f('ix_dealer_motorcycle_listings_dealer_id'), table_name='dealer_motorcycle_listings')
    op.drop_index(op.f('ix_dealer_motorcycle_listings_brand'), table_name='dealer_motorcycle_listings')
    op.drop_table('dealer_motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_listings_year'), table_name='motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_listings_source'), table_name='motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_listings_model'), table_name='motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_listings_id'), table_name='motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_listings_brand'), table_name='motorcycle_listings')
    op.drop_table('motorcycle_listings')
    op.drop_index(op.f('ix_motorcycle_dealers_id'), table_name='motorcycle_dealers')
    op.drop_table('motorcycle_dealers')
