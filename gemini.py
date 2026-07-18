import os
from google import genai

# Load API key from local .env if present
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

# Initialize the new SDK client (it automatically picks up GEMINI_API_KEY from the environment)
client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Hello",
)
print(response.text)