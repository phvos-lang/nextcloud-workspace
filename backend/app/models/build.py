import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class BuildJob(Base, UUIDMixin, TimestampMixin):
    """Docker image build job."""
    __tablename__ = "build_jobs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    image_tag: Mapped[str] = mapped_column(String(500), nullable=False)

    # Registry config (password encrypted with Fernet)
    registry_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    registry_username: Mapped[str | None] = mapped_column(String(200), nullable=True)
    registry_password_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Build context
    dockerfile: Mapped[str] = mapped_column(Text, nullable=False)
    entrypoint: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Runtime state
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    build_log: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Set when published to app catalog
    app_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("apps.id", ondelete="SET NULL"), nullable=True
    )
    app: Mapped["App | None"] = relationship()  # type: ignore[name-defined]
