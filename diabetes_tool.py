import pickle
import pandas as pd

MODEL_PATH = "diabetes_model.pkl"

FEATURE_NAMES = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age"
]

# Load model once (important)
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

def predict_diabetes_tool(
    pregnancies: int,
    glucose: float,
    blood_pressure: float,
    skin_thickness: float,
    insulin: float,
    bmi: float,
    dpf: float,
    age: int
) -> dict:
    """
    Predict diabetes using trained ML model
    """
    input_df = pd.DataFrame([[
        pregnancies, glucose, blood_pressure,
        skin_thickness, insulin, bmi, dpf, age
    ]], columns=FEATURE_NAMES)

    prediction = model.predict(input_df)[0]
    probability = model.predict_proba(input_df)[0][1]

    return {
        "prediction": int(prediction),
        "diabetes": "Yes" if prediction == 1 else "No",
        "probability": round(float(probability), 3)
    }
