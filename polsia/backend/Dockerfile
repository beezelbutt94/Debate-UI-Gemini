FROM python:3.12-slim

# git for the GitHub adapter; Node for the Claude Code CLI that agents shell out to.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && apt-get purge -y gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Agents run code in cloned repos; never as root.
RUN useradd --create-home --uid 10001 polsia
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=polsia:polsia . .
USER polsia

ENV PYTHONUNBUFFERED=1 \
    WORK_DIR=/app/workspace
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
