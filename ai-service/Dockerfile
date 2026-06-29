FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face impose d'écouter sur le port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=7860"]
