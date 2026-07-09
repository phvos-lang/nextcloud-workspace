FROM python:3.12-slim AS builder
WORKDIR /build
RUN pip install poetry
COPY pyproject.toml poetry.lock* ./
RUN poetry export -f requirements.txt --without-hashes -o requirements.txt

FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && groupadd -r lwp && useradd -r -g lwp lwp

COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=lwp:lwp . .

USER lwp

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
