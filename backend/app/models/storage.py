import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class StorageConfig(Base, UUIDMixin, TimestampMixin):
    """A user's saved remote-storage connection (SFTP, S3, WebDAV, rclone-generic)."""
    __tablename__ = "storage_configs"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # sftp|s3|webdav|gdrive|onedrive
    config_encrypted: Mapped[str] = mapped_column(Text, nullable=False)  # Fernet-encrypted JSON
    # Path where this remote will be mounted inside the desktop container
    mount_path: Mapped[str] = mapped_column(String(200), nullable=False, default="/media/storage")

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]
