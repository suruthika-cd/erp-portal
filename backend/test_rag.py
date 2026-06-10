import requests
import json

url = "http://127.0.0.1:5000/api/ask-material-question"
payload = {
    "question": "What is the content of the uploaded material?",
    "material_id": "6a296b023242f47f3595ca65"
}

print("Sending request...")
try:
    response = requests.post(url, json=payload, timeout=60)
    print("Status:", response.status_code)
    print("Response:", json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error:", e)
