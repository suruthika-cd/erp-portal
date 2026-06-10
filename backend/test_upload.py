import requests
import io

url = "http://127.0.0.1:5000/api/upload-material"
files = {'file': ('test.txt', io.BytesIO(b"Hello this is a test material."), 'text/plain')}
data = {
    'title': 'Test Material',
    'subject': 'Test Subject',
    'department': 'CS',
    'semester': '1'
}

print("Sending request to", url)
try:
    response = requests.post(url, files=files, data=data, timeout=60)
    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())
except Exception as e:
    print("Request failed:", e)
except Exception as e:
    print("Request failed:", e)
