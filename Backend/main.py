from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from pipeline import run_research_pipeline,run_research_pipeline_stream


app = FastAPI(
    title="Multi-Agent Reasearch AI",
    description="Backend API for the Multi-Agent Research System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://multi-agent-ai-research-byteja.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class ResearchRequest(BaseModel):
    topic : str



@app.get("/")
def home():
    return{
        "message":"Multi-Agent Research AI API is running"
    }


@app.post("/research")
def research(request: ResearchRequest):

    result = run_research_pipeline(request.topic)

    return {
        "topic": request.topic,
        "report": result["report"],
        "feedback": result["feedback"],
        "search_result": result["search_result"],
        "scraped_content": result["scraped_content"]
    }

@app.post("/research/stream")
def research_stream(request: ResearchRequest):

    def event_generator():
        for event in run_research_pipeline_stream(request.topic):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )