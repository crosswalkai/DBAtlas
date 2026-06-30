# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Inject empty string as API URL so the app uses relative paths on the same host
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Serve the app via FastAPI backend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}

