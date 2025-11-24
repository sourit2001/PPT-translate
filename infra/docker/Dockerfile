# syntax=docker/dockerfile:1

FROM node:20-bullseye AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip \
    libreoffice \
    imagemagick ghostscript \
    fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# Fix ImageMagick policy to allow PDF conversion
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

# Frontend deps
COPY repo-frontend/package.json repo-frontend/package-lock.json* ./repo-frontend/
RUN cd repo-frontend && npm ci || npm install

# Worker deps
COPY repo-worker/requirements.txt ./repo-worker/
RUN python3 -m venv /app/repo-worker/venv \
 && /app/repo-worker/venv/bin/pip install -r /app/repo-worker/requirements.txt

# Source
COPY . .

# Build Next.js
RUN cd repo-frontend && npm run build || true

EXPOSE 3000
CMD ["bash", "/app/infra/scripts/start.sh", "web"]
