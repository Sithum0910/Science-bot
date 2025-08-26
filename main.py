import os
import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

# Allow CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to your frontend origin in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-small"
HF_API_KEY = "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"
NASA_APOD_URL = "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY"
WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"

def get_wikipedia_summary(topic):
    try:
        resp = requests.get(WIKI_SUMMARY_URL.format(topic), timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("extract", ""), resp.url
        else:
            return "", resp.url
    except Exception:
        return "", ""

def get_nasa_apod():
    try:
        resp = requests.get(NASA_APOD_URL, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            return (data.get("explanation", ""), data.get("url", ""))
        else:
            return "", ""
    except Exception:
        return "", ""

def query_huggingface(prompt):
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": prompt}
    try:
        resp = requests.post(HF_API_URL, headers=headers, json=payload, timeout=8)
        if resp.status_code == 200:
            result = resp.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0]["generated_text"]
            elif isinstance(result, dict) and "generated_text" in result:
                return result["generated_text"]
        return ""
    except Exception:
        return ""

@app.get("/ask")
def ask(question: str = Query(..., min_length=1)):
    # Step 1: Wikipedia summary
    topic = question.strip().replace(" ", "_")
    summary, source = get_wikipedia_summary(topic)
    image_url = None

    # Step 2: If topic is about space, get NASA APOD image
    nasa_info = None
    if "space" in question.lower():
        nasa_summary, nasa_img = get_nasa_apod()
        if nasa_img:
            image_url = nasa_img
        if nasa_summary:
            summary = nasa_summary
            source = NASA_APOD_URL

    # Step 3: Query Hugging Face for final answer
    if summary:
        prompt = f"Q: {question}\nContext: {summary}\nA:"
    else:
        prompt = f"Q: {question}\nA:"

    answer = query_huggingface(prompt)
    if not answer:
        answer = "Sorry, I couldn't find an answer to your question."

    resp = {
        "question": question,
        "answer": answer,
        "source": source,
    }
    if image_url:
        resp["image_url"] = image_url

    return JSONResponse(content=resp)
