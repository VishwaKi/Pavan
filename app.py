import os
import json
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

from diabetes_tool import predict_diabetes_tool

# -------------------------------------------------
# Setup
# -------------------------------------------------
load_dotenv(override=True)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Model Client
# -------------------------------------------------
model_client = OpenAIChatCompletionClient(
    model="gpt-5-nano-2025-08-07",
    api_key=os.getenv("OPENAI_API_KEY"),
)

# -------------------------------------------------
# Medical Assistant
# -------------------------------------------------
medical_assistant = AssistantAgent(
    name="MedicalAssistant",
    description="Handles ALL medical, health, diabetes, and symptom related queries.",
    model_client=model_client,
    tools=[predict_diabetes_tool],
    system_message="""
You are a Medical AI Assistant.

RULES:
- If numerical health data is provided, CALL the diabetes prediction tool.
- Never answer policy or document questions.
- Explain results clearly and empathetically.
- End your response with the word TERMINATE.
"""
)

# -------------------------------------------------
# Summary Agent
# -------------------------------------------------
summary_agent = AssistantAgent(
    name="SummaryAgent",
    description="Summary the agent response in simple plain English with minimal words.",
    model_client=model_client,
    system_message="""
    summarise it in simple plain English with minimal words.
"""
)

# -------------------------------------------------
# Manager Agent (STRICT ROUTER)
# -------------------------------------------------
manager_agent = SelectorGroupChat(
    name="ManagerAgent",
    model_client=model_client,
    participants=[medical_assistant, summary_agent],
    selector_prompt="""
You are a STRICT routing manager.

AVAILABLE AGENTS:
- MedicalAssistant → health, diseases, diabetes, symptoms, medical data
- SummaryAgent → summary the other agent response in simple plain English with minimal words.

ROUTING RULES (MANDATORY):
1. If the user query is medical in ANY form → SELECT MedicalAssistant ONLY.
2. If the query is policy/document related → SELECT SummaryAgent ONLY.
3. NEVER select more than one agent.
4. After the selected agent responds, DO NOT call any other agent.
5. Summarize the selected agent’s response in simple plain English.
6. Then TERMINATE.

Once got result from medical assistant, summarize the result in simple plain English.
Dont call the RAG agent.

Choose exactly ONE agent.
""",
    termination_condition=TextMentionTermination("TERMINATE"),
    max_turns=2,
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
# WebSocket Endpoint
# -------------------------------------------------
@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()

    async def send_json(data):
        await websocket.send_text(json.dumps(data, cls=DateTimeEncoder))

    try:
        while True:
            data = await websocket.receive_json()
            user_msg = TextMessage.model_validate(data)

            async for message in manager_agent.run_stream(
                task=user_msg.content
            ):
                await send_json(message.model_dump())

            await send_json({
                "type": "task_completed",
                "source": "system",
                "content": "Request processed successfully."
            })

    except WebSocketDisconnect:
        print("WebSocket disconnected")

# -------------------------------------------------
# Run
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
