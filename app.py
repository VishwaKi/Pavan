import os
import json
from datetime import datetime
from typing import Dict, Any, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI

from diabetes_tool import predict_diabetes_tool
from retrieval_tool import retrieve_documents_tool


# -------------------------------------------------
# Setup
# -------------------------------------------------
load_dotenv(override=True)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# JSON Encoder
# -------------------------------------------------
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# -------------------------------------------------
# Tools (OpenAI format)
# -------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "predict_diabetes",
            "description": (
                "Predict diabetes using a trained ML model. "
                "Requires full medical parameters."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "pregnancies": {
                        "type": "integer",
                        "description": "Number of pregnancies"
                    },
                    "glucose": {
                        "type": "number",
                        "description": "Plasma glucose concentration"
                    },
                    "blood_pressure": {
                        "type": "number",
                        "description": "Diastolic blood pressure (mm Hg)"
                    },
                    "skin_thickness": {
                        "type": "number",
                        "description": "Triceps skin fold thickness (mm)"
                    },
                    "insulin": {
                        "type": "number",
                        "description": "2-Hour serum insulin (mu U/ml)"
                    },
                    "bmi": {
                        "type": "number",
                        "description": "Body Mass Index"
                    },
                    "dpf": {
                        "type": "number",
                        "description": "Diabetes pedigree function"
                    },
                    "age": {
                        "type": "integer",
                        "description": "Age in years"
                    }
                },
                "required": [
                    "pregnancies",
                    "glucose",
                    "blood_pressure",
                    "skin_thickness",
                    "insulin",
                    "bmi",
                    "dpf",
                    "age"
                ]
            }
        }
    } ,
    {
    "type": "function",
    "function": {
        "name": "retrieve_documents",
        "description": "Retrieve relevant stored documents to answer the user's question",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "User query to search in the knowledge base"
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to retrieve",
                    "default": 5
                },
                "source": {
                    "type": "string",
                    "description": "Optional source filter (pdf or text)"
                }
            },
            "required": ["query"]
        }
    }
}
   
]

# -------------------------------------------------
# Tool Executor
# -------------------------------------------------
def execute_tool(name: str, arguments: Dict[str, Any]) -> str:
    if name == "predict_diabetes":
        return predict_diabetes_tool(**arguments)
    elif name == "retrieve_documents":
        return retrieve_documents_tool(**arguments)

    return "Unknown tool"

# -------------------------------------------------
# WebSocket Chat
# -------------------------------------------------
@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()

    messages: List[Dict[str, Any]] = [
        {
            "role": "system",
            "content": """You are an AI Assistant designed to answer Medical and Aviation-related queries clearly, safely, and concisely.

=====================
CORE ROUTING RULES
=====================
- If the user provides numerical health data or asks to predict diabetes, you MUST call the tool named "predict_diabetes".
- If the user asks questions related to aviation safety, flight emergencies, aircraft incidents, or passenger procedures, you MUST call the tool named "retrieve_documents".
- Never guess medical results without using the "predict_diabetes" tool when required.
- Never invent aviation procedures; use retrieved aviation content only.
- Keep responses short, simple, and easy to understand.

=====================
MEDICAL RESPONSE RULES
=====================
AFTER DIABETES PREDICTION:

1. If diabetes is detected:
   - Clearly state the risk in one line.
   - Provide a brief food routine to help reduce diabetes risk.
   - Provide a simple daily meal plan (morning, afternoon, night).
   - Provide a short exercise routine suitable for beginners.

2. If diabetes is NOT detected:
   - Clearly state that diabetes is not detected.
   - Suggest a healthy meal routine to prevent diabetes.
   - Suggest a light exercise routine for prevention.

Medical Safety:
- Do NOT provide medical diagnosis.
- Always include: “Consult a doctor for medical advice.”
- Avoid complex medical terms.
- Be empathetic, supportive, and practical.

=====================
AVIATION RESPONSE RULES
=====================
- Aviation answers are for PASSENGER AWARENESS ONLY.
- You MUST use the tool named "retrieve_documents" to answer aviation-related questions.
- Do NOT provide pilot-level or technical flight instructions.
- Focus on calm behavior, crew instructions, and safety procedures.
- If no relevant aviation data is retrieved, clearly say so.

Aviation Safety Disclaimer:
- “Always follow airline crew instructions during any emergency.”

=====================
OUTPUT STYLE
=====================
- Use bullet points.
- No long paragraphs.
- No unnecessary explanations.
- Be crisp, minimal, and user-friendly.
"""
        }
    ]

    async def send(data):
        await websocket.send_text(json.dumps(data, cls=DateTimeEncoder))

    try:
        while True:
            user_data = await websocket.receive_json()
            user_message = user_data["content"]

            messages.append({"role": "user", "content": user_message})

            # -------------------------------------------------
            # 🔁 Tool loop
            # -------------------------------------------------
            while True:
                response = client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                )

                message = response.choices[0].message
                print(message)

                # -------------------------------------------------
                # If tool is requested
                # -------------------------------------------------
                if message.tool_calls:
                    messages.append(message)

                    for tool_call in message.tool_calls:
                        await send({
                            "role": "Thoughts",
                            "content": f"Executing tool: {tool_call.function.name} with arguments: {tool_call.function.arguments}",
                        })
                        tool_name = tool_call.function.name
                        print(tool_name)
                        tool_args = json.loads(tool_call.function.arguments)
                        print(tool_args)

                        tool_result = execute_tool(tool_name, tool_args)
                        await send({
                            "role": "Thoughts",
                            "content": f"Got result from {tool_name}: {tool_result}",
                        })
                        print(tool_result)

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(tool_result),
                        })

                    # 🔁 continue loop (model sees tool result next)
                    continue

                # -------------------------------------------------
                # Final assistant message
                # -------------------------------------------------
                messages.append(message)
                await send({
                    "role": "assistant",
                    "content": message.content
                })
                break

    except WebSocketDisconnect:
        print("WebSocket disconnected")


from fastapi import UploadFile, File, Form
import uuid
import tempfile
from pinecone import Pinecone, ServerlessSpec

from jina_vector_utils import (
    extract_text_from_pdf,
    chunk_text,
    embed_texts_jina
)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX", "medical-docs")

# Jina v4 embedding dimension
EMBEDDING_DIMENSION = 1024  

pc = Pinecone(api_key=PINECONE_API_KEY)

def get_or_create_index():
    existing_indexes = [i["name"] for i in pc.list_indexes()]

    if INDEX_NAME not in existing_indexes:
        pc.create_index(
            name=INDEX_NAME,
            dimension=EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print(f"✅ Created Pinecone index: {INDEX_NAME}")
    else:
        print(f"ℹ️ Pinecone index already exists: {INDEX_NAME}")

    return pc.Index(INDEX_NAME)

# Usage
index = get_or_create_index()




@app.post("/ingest")
async def ingest_data(
    text: str = Form(None),
    pdf: UploadFile = File(None)
):
    if not text and not pdf:
        return {"error": "Provide either text or PDF"}

    document_id = str(uuid.uuid4())
    source = "text"

    # ------------------------------
    # PDF handling
    # ------------------------------
    if pdf:
        source = "pdf"
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(await pdf.read())
            file_path = tmp.name

        text = extract_text_from_pdf(file_path)

    # ------------------------------
    # Chunk + Embed
    # ------------------------------
    chunks = chunk_text(text)
    embeddings = embed_texts_jina(chunks)

    vectors = []
    total_chunks = len(chunks)

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": f"{document_id}_{i}",
            "values": embedding,
            "metadata": {
                "document_id": document_id,
                "chunk_index": i,
                "total_chunks": total_chunks,
                "source": source,
                "text": chunk[:500]  # preview only
            }
        })

    index.upsert(vectors)

    return {
        "status": "success",
        "document_id": document_id,
        "chunks_stored": total_chunks,
        "source": source
    }


# -------------------------------------------------
# Run
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
