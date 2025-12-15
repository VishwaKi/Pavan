import pickle
import numpy as np

def predict_diabetes(model_path: str, input_features: list):
    """
    Predict diabetes using a trained pickle model.

    Args:
        model_path (str): Path to the saved .pkl model
        input_features (list): List of input feature values in correct order

    Returns:
        dict: Prediction result
    """

    # Load model
    with open(model_path, 'rb') as file:
        model = pickle.load(file)

    # Convert input to numpy array (2D)
    input_array = np.array(input_features).reshape(1, -1)

    # Prediction
    prediction = model.predict(input_array)

    # Probability (if supported)
    probability = None
    if hasattr(model, "predict_proba"):
        probability = model.predict_proba(input_array)[0][1]

    return {
        "prediction": int(prediction[0]),
        "diabetes": "Yes" if prediction[0] == 1 else "No",
        "probability": probability
    }


features = [
    6,     # Pregnancies
    148,   # Glucose
    72,    # BloodPressure
    35,    # SkinThickness
    0,     # Insulin
    33.6,  # BMI
    0.627, # DiabetesPedigreeFunction
    50     # Age
]

result = predict_diabetes("diabetes_model.pkl", features)
print(result)
