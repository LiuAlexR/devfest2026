import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dedalus_labs import AsyncDedalus, DedalusRunner

app = FastAPI()

# Enable CORS so your React app (localhost:3000) can talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Adjust for your frontend port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the input structure
class SearchRequest(BaseModel):
    query: str

# Define the output structure (same as your script)
class StudyPreferences(BaseModel):
    keywords: list[str]

@app.post("/analyze-search")
async def analyze_search(request: SearchRequest):
    try:
        # Initialize Dedalus (Use your actual API Key here or in env vars)
        client = AsyncDedalus(api_key="dsk-test-5966b3231927-7dba8de471142b831a3159b147bcb87d")
        runner = DedalusRunner(client)

        print(f"Analyzing query: {request.query}")

        # Run the AI extraction
        result = await runner.run(
            input=request.query,
            model="openai/gpt-4o",
            instructions="Extract keywords describing the study environment preferences (e.g. quiet, outdoors, wifi, outlets). Return only the keywords in a list.",
            response_format=StudyPreferences,
        )

        return result.final_output  # Returns {"keywords": ["quiet", "outdoors"]}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)