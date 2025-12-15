import os
from typing import List, Dict
from pinecone import Pinecone
from jina_vector_utils import embed_texts_jina
from dotenv import load_dotenv

load_dotenv(override=True)
# -------------------------------------------------
# Pinecone setup
# -------------------------------------------------
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_NAME = os.getenv("PINECONE_INDEX")
index = pc.Index(INDEX_NAME)

# -------------------------------------------------
# Retrieval Function (TOOL)
# -------------------------------------------------
def retrieve_documents_tool(
    query: str,
    top_k: int = 5,
    source: str | None = None
) -> List[Dict]:
    """
    Retrieve relevant document chunks from Pinecone
    """

    # 1. Embed the query
    query_embedding = embed_texts_jina([query])[0]

    # 2. Optional metadata filter
    filter_query = {}
    if source:
        filter_query["source"] = source

    # 3. Query Pinecone
    response = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        filter=filter_query if filter_query else None
    )

    # 4. Format results
    results = []
    for match in response["matches"]:
        results.append({
            "score": round(match["score"], 3),
            "document_id": match["metadata"].get("document_id"),
            "chunk_index": match["metadata"].get("chunk_index"),
            "text": match["metadata"].get("text"),
            "source": match["metadata"].get("source")
        })

    return results
