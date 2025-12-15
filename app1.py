import os
import json
import logging
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.tools import AgentTool
from autogen_agentchat.messages import TextMessage
from autogen_ext.models.openai import OpenAIChatCompletionClient

from diabetes_tool import predict_diabetes_tool

# -------------------------------------------------
# Setup
# -------------------------------------------------
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

load_dotenv(override=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# AutoGen setup (created once)
# -------------------------------------------------
model_client = OpenAIChatCompletionClient(
    model="gpt-5-nano-2025-08-07",
    api_key=OPENAI_API_KEY,
)

medical_assistant = AssistantAgent(
    name="MedicalAssistant",
    model_client=model_client,
    tools=[predict_diabetes_tool],
    system_message=(
        "You are a specialized Medical AI Assistant focused on diabetes prediction and health analysis.\n\n"
        "Your responsibilities:\n"
        "1. When a user provides specific health metrics (Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction/DPF, Age), "
        "you MUST call the 'predict_diabetes' tool to analyze their diabetes risk.\n"
        "2. The tool requires these 8 parameters: Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DPF (DiabetesPedigreeFunction), and Age.\n"
        "3. After receiving the prediction result, explain it clearly to the user in a compassionate and informative manner.\n"
        "4. Provide health recommendations based on the prediction results.\n"
        "5. If the user asks general medical questions without providing specific metrics, answer them based on your medical knowledge.\n"
        "6. Always maintain a professional, empathetic, and supportive tone.\n\n"
        "Remember: You are here to help users understand their health better and make informed decisions."
    ),
)

medical_tool = AgentTool(agent=medical_assistant)

assistant = AssistantAgent(
    name="ManagerAssistant",
    model_client=model_client,
    tools=[medical_tool],
    system_message=(
        """You are a Manager Assistant responsible for coordinating user requests and managing specialized agents.

Your core responsibilities are:

1. Intent Detection & Delegation:
   - If the user asks ANY medical-related question (health, symptoms, diseases, diabetes, medical advice, health metrics, predictions, or analysis),
     you MUST delegate the request to the MedicalAssistant tool.
   - You must NOT provide medical conclusions or predictions on your own.

2. Tool Output Management:
   - When you receive a response from the MedicalAssistant tool:
     - Summarize the result clearly in plain English.
     - Keep the explanation concise, user-friendly, and easy to understand.
     - Do NOT expose raw model outputs, probabilities, logs, or technical terms unless necessary.
     - Preserve medical meaning while simplifying language.

3. Missing Information Handling:
   - If the MedicalAssistant indicates missing or insufficient data,
     politely ask the user to provide the required information before proceeding.

4. Non-Medical Queries:
   - If the user request is NOT medical-related, answer directly using general knowledge.

5. Safety & Professionalism:
   - Always maintain a professional and supportive tone.
   - Avoid definitive diagnoses.
   - Encourage consulting a healthcare professional when appropriate.

Remember:
- You are an orchestrator, not a medical expert.
- All medical intelligence comes from the MedicalAssistant.
- Your job is to translate expert outputs into clear human-readable responses.
"""),
)

# Custom JSON encoder to handle datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# -------------------------------------------------
# Helper: JSON serializer
# -------------------------------------------------
def serialize_message(message):
    data = message.model_dump()
    data["timestamp"] = datetime.utcnow().isoformat()
    return data

# -------------------------------------------------
# WebSocket Endpoint
# -------------------------------------------------
@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connected")

    async def send_json_datetime(websocket, data):
        await websocket.send_text(json.dumps(data, cls=DateTimeEncoder))

    try:
        while True:
            # Receive user message
            data = await websocket.receive_json()
            user_msg = TextMessage.model_validate(data)

            print(f"User input: {user_msg.content}")

            # Run AutoGen stream
            async for message in assistant.run_stream(task=user_msg.content):
                print("--"*20)
                print(message.model_dump_json(indent=4))
                print("--"*20)
                 # Send message to client
                await send_json_datetime(websocket, message.model_dump())

            # Send message to client
            await send_json_datetime(websocket, {
                "type": "task_completed",
                "source": "system",
                "content": "Diabetes prediction completed."
            })

    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print("Unexpected error")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "source": "system",
                "content": str(e)
            }))
        except Exception:
            pass

# -------------------------------------------------
# Run
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
