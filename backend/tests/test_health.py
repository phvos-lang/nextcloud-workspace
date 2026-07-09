import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
