import os
import requests
from typing import List
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv(override=True)
# -------------------------------------------------
# Jina Embedding Setup
# -------------------------------------------------
JINA_API_KEY = os.getenv("JINA_API_KEY")
JINA_EMBEDDING_URL = "https://api.jina.ai/v1/embeddings"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {JINA_API_KEY}"
}

# -------------------------------------------------
# PDF Text Extraction
# -------------------------------------------------
def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract all text from a PDF file
    """
    reader = PdfReader(file_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    return text.strip()

# -------------------------------------------------
# Text Chunking with Overlap
# -------------------------------------------------
def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100
) -> List[str]:
    """
    Split text into overlapping chunks (word-based)
    """
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks

# -------------------------------------------------
# Jina Embeddings
# -------------------------------------------------
def embed_texts_jina(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings using Jina Embeddings v4
    """
    payload = {
        "model": "jina-embeddings-v4",
        "task": "text-matching",
        "dimensions": 1024,
        "input": [{"text": t} for t in texts]
    }

    response = requests.post(
        JINA_EMBEDDING_URL,
        headers=HEADERS,
        json=payload,
        timeout=30
    )

    response.raise_for_status()
    result = response.json()

    return [item["embedding"] for item in result["data"]]
