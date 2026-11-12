import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection

from app.config import Settings
from app.exceptions import ReportNotFoundError
from app.models.research import HistorySummary, ResearchReport

logger = logging.getLogger("researchpilot.database")


class ResearchRepository:
    """Persists research reports in MongoDB when configured, with local JSON/memory fallback."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: Optional[AsyncIOMotorClient] = None
        self._collection: Optional[AsyncIOMotorCollection] = None
        self._memory_store: Dict[str, Dict] = {}
        self._local_path: Optional[Path] = (
            Path(settings.local_history_file) if settings.local_history_file else None
        )
        self.mongodb_status: str = "not_configured"
        self.storage_mode: str = "memory"

    def _load_local_history(self) -> None:
        if not self._local_path or not self._local_path.exists():
            return
        try:
            raw = json.loads(self._local_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                self._memory_store = raw
        except Exception as exc:
            logger.warning("Could not load local history file (%s); starting empty.", exc)
            self._memory_store = {}

    def _flush_local_history(self) -> None:
        if not self._local_path:
            return
        try:
            self._local_path.parent.mkdir(parents=True, exist_ok=True)
            self._local_path.write_text(
                json.dumps(self._memory_store, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Could not persist local history file (%s); keeping in memory.", exc)

    async def initialize(self) -> None:
        if not self.settings.mongodb_configured:
            self.mongodb_status = "not_configured"
            self._load_local_history()
            self.storage_mode = "local" if self._local_path else "memory"
            logger.info("MongoDB not configured; using %s history storage.", self.storage_mode)
            return

        try:
            self._client = AsyncIOMotorClient(
                self.settings.mongodb_uri.strip(),
                serverSelectionTimeoutMS=3000,
            )
            await self._client.admin.command("ping")
            db = self._client[self.settings.mongodb_db_name]
            self._collection = db["research_reports"]
            await self._collection.create_index("research_id", unique=True)
            await self._collection.create_index("created_at")
            self.mongodb_status = "connected"
            self.storage_mode = "mongodb"
            logger.info("Connected to MongoDB database '%s'.", self.settings.mongodb_db_name)
        except Exception as exc:
            logger.warning("MongoDB connection unavailable (%s); falling back to local storage.", exc)
            self._collection = None
            self.mongodb_status = "connection_error"
            self._load_local_history()
            self.storage_mode = "local" if self._local_path else "memory"

    async def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    async def save_report(self, report: ResearchReport) -> None:
        payload = report.model_dump()
        if self._collection is not None:
            await self._collection.replace_one(
                {"research_id": report.research_id},
                payload,
                upsert=True,
            )
        else:
            self._memory_store[report.research_id] = payload
            self._flush_local_history()

    async def get_report(self, research_id: str) -> ResearchReport:
        doc: Optional[Dict] = None
        if self._collection is not None:
            doc = await self._collection.find_one(
                {"research_id": research_id},
                {"_id": 0},
            )
        else:
            doc = self._memory_store.get(research_id)

        if not doc:
            raise ReportNotFoundError(research_id)
        return ResearchReport.model_validate(doc)

    async def list_history(self, query: Optional[str] = None) -> List[HistorySummary]:
        docs: List[Dict] = []
        if self._collection is not None:
            mongo_filter: Dict = {}
            if query and query.strip():
                pattern = re.escape(query.strip())
                mongo_filter = {
                    "$or": [
                        {"title": {"$regex": pattern, "$options": "i"}},
                        {"original_query": {"$regex": pattern, "$options": "i"}},
                        {"query_analysis.main_topic": {"$regex": pattern, "$options": "i"}},
                    ]
                }
            cursor = (
                self._collection.find(
                    mongo_filter,
                    {
                        "_id": 0,
                        "research_id": 1,
                        "title": 1,
                        "original_query": 1,
                        "parent_research_id": 1,
                        "created_at": 1,
                        "sources": 1,
                        "metadata": 1,
                        "depth": 1,
                    },
                )
                .sort("created_at", -1)
                .limit(100)
            )
            docs = await cursor.to_list(length=100)
        else:
            all_docs = sorted(
                self._memory_store.values(),
                key=lambda item: item.get("created_at", ""),
                reverse=True,
            )
            if query and query.strip():
                q = query.strip().lower()
                docs = [
                    d
                    for d in all_docs
                    if q in d.get("title", "").lower()
                    or q in d.get("original_query", "").lower()
                    or q in d.get("query_analysis", {}).get("main_topic", "").lower()
                ]
            else:
                docs = all_docs

        summaries: List[HistorySummary] = []
        for doc in docs:
            summaries.append(
                HistorySummary(
                    research_id=doc["research_id"],
                    title=doc["title"],
                    original_query=doc["original_query"],
                    parent_research_id=doc.get("parent_research_id"),
                    created_at=doc["created_at"],
                    sources_count=len(doc.get("sources") or []),
                    duration_ms=int((doc.get("metadata") or {}).get("total_duration_ms", 0)),
                    depth=doc.get("depth", "standard"),
                )
            )
        return summaries

    async def delete_report(self, research_id: str) -> bool:
        if self._collection is not None:
            result = await self._collection.delete_one({"research_id": research_id})
            if result.deleted_count == 0:
                raise ReportNotFoundError(research_id)
            return True

        if research_id not in self._memory_store:
            raise ReportNotFoundError(research_id)
        del self._memory_store[research_id]
        self._flush_local_history()
        return True
