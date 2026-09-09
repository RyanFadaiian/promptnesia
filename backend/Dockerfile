FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Cache dependencies separately from application changes.
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 appuser \
    && mkdir /app/generated \
    && chown appuser:appuser /app/generated

COPY app/ ./app/

USER appuser
EXPOSE 8000

# Render supplies PORT. One worker keeps all players in the same game state.
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --workers 1"]
