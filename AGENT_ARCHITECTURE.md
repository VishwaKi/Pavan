# Medical Assistant Agent Architecture

## Overview

This application uses a **two-tier agent architecture** with AutoGen to handle medical queries and diabetes predictions efficiently.

## Agent Hierarchy

```
User Request
    ↓
ManagerAssistant (Coordinator)
    ↓
MedicalAssistant (Specialist)
    ↓
predict_diabetes Tool (ML Model)
```

## Agents

### 1. **ManagerAssistant** (Top-Level Coordinator)

**Name**: `ManagerAssistant`

**Role**: Routes user requests to appropriate specialized agents

**System Message**:
- Coordinates user requests and delegates tasks to specialized agents
- **Delegates ALL medical-related questions** to the MedicalAssistant tool
- Medical questions include:
  - Diabetes prediction requests
  - Health metric analysis (BMI, glucose levels, blood pressure, etc.)
  - General health inquiries
  - Symptom discussions
  - Medical advice or recommendations
- Answers non-medical questions directly using general knowledge
- Ensures users get accurate medical information from the specialized MedicalAssistant

**Tools**: 
- `medical_tool` (wraps the MedicalAssistant agent)

---

### 2. **MedicalAssistant** (Medical Specialist)

**Name**: `MedicalAssistant`

**Role**: Handles all medical queries and performs diabetes predictions

**System Message**:
- Specialized Medical AI Assistant focused on diabetes prediction and health analysis
- **When to call the diabetes prediction tool**:
  - User provides specific health metrics: Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction (DPF), Age
  - All 8 parameters are required for prediction
- After prediction:
  - Explains results clearly in a compassionate and informative manner
  - Provides health recommendations based on prediction results
- Answers general medical questions using medical knowledge
- Maintains a professional, empathetic, and supportive tone

**Tools**: 
- `predict_diabetes_tool` (ML model for diabetes prediction)

---

## Workflow Examples

### Example 1: Diabetes Prediction Request

**User Input**:
```
Predict diabetes for Pregnancies 6 Glucose 148 BloodPressure 72 SkinThickness 35 Insulin 0 BMI 33.6 DPF 0.627 Age 50
```

**Flow**:
1. **ManagerAssistant** receives the request
2. Recognizes it as a medical question (diabetes prediction)
3. Delegates to **MedicalAssistant** via `medical_tool`
4. **MedicalAssistant** extracts the health metrics
5. Calls `predict_diabetes_tool` with the 8 parameters
6. Receives prediction result (e.g., "Positive" or "Negative")
7. Explains the result to the user with recommendations
8. Response streams back to the user via WebSocket

### Example 2: General Medical Question

**User Input**:
```
What is diabetes and what are its symptoms?
```

**Flow**:
1. **ManagerAssistant** receives the request
2. Recognizes it as a medical question
3. Delegates to **MedicalAssistant** via `medical_tool`
4. **MedicalAssistant** answers using medical knowledge (no tool call needed)
5. Response streams back to the user via WebSocket

### Example 3: Non-Medical Question

**User Input**:
```
What's the weather like today?
```

**Flow**:
1. **ManagerAssistant** receives the request
2. Recognizes it as a non-medical question
3. Answers directly using general knowledge (no delegation needed)
4. Response streams back to the user via WebSocket

---

## Diabetes Prediction Tool

**Function**: `predict_diabetes`

**Required Parameters** (8 total):
1. **Pregnancies** (int): Number of times pregnant
2. **Glucose** (int): Plasma glucose concentration
3. **BloodPressure** (int): Diastolic blood pressure (mm Hg)
4. **SkinThickness** (int): Triceps skin fold thickness (mm)
5. **Insulin** (int): 2-Hour serum insulin (mu U/ml)
6. **BMI** (float): Body mass index (weight in kg/(height in m)^2)
7. **DiabetesPedigreeFunction/DPF** (float): Diabetes pedigree function
8. **Age** (int): Age in years

**Returns**: 
- Prediction result: "Positive" (diabetes risk) or "Negative" (no diabetes risk)

**Model**: 
- Uses a pre-trained machine learning model stored in `diabetes_model.pkl`

---

## WebSocket Integration

The agents communicate with the frontend via WebSocket:

**Endpoint**: `ws://localhost:8003/ws/chat`

**Message Format** (User → Backend):
```json
{
    "type": "TextMessage",
    "source": "user",
    "content": "Predict diabetes for Pregnancies 6 Glucose 148..."
}
```

**Message Format** (Backend → User):
```json
{
    "type": "TextMessage",
    "source": "assistant",
    "content": "Based on the health metrics provided...",
    "timestamp": "2025-12-15T09:56:59.123Z"
}
```

**Completion Signal**:
```json
{
    "type": "task_completed",
    "source": "system",
    "content": "Diabetes prediction completed."
}
```

---

## Key Features

✅ **Two-tier architecture** for better organization and scalability
✅ **Automatic routing** of medical questions to specialized agent
✅ **Clear separation of concerns** between coordination and specialization
✅ **Streaming responses** for real-time user feedback
✅ **Compassionate communication** with professional medical tone
✅ **Flexible handling** of both specific predictions and general questions

---

## Testing the System

### Test Case 1: Full Diabetes Prediction
```
Predict diabetes for Pregnancies 6 Glucose 148 BloodPressure 72 SkinThickness 35 Insulin 0 BMI 33.6 DPF 0.627 Age 50
```

**Expected**: MedicalAssistant calls the prediction tool and provides results with recommendations

### Test Case 2: General Medical Query
```
What are the risk factors for diabetes?
```

**Expected**: MedicalAssistant answers using medical knowledge without calling the tool

### Test Case 3: Non-Medical Query
```
Tell me a joke
```

**Expected**: ManagerAssistant answers directly without delegating to MedicalAssistant

---

## Configuration

**Model**: `gpt-5-nano-2025-08-07` (OpenAI)
**API Key**: Loaded from `.env` file
**Port**: 8003
**CORS**: Enabled for all origins (development mode)

---

## Future Enhancements

- Add more specialized medical agents (e.g., CardiacAssistant, NutritionAssistant)
- Implement conversation history for context-aware responses
- Add user authentication and personalized health tracking
- Integrate additional ML models for other health predictions
- Add data visualization for health metrics
