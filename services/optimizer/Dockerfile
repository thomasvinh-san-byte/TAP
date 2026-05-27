FROM python:3.12-slim

WORKDIR /app

# Couche de cache séparée pour les dépendances runtime
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY . .

# L'hébergeur injecte PORT au runtime ; défaut local 8080
ENV PORT=8080

EXPOSE $PORT

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
