from fastapi import FastAPI
from pydantic import BaseModel
from main import run_pipeline
import os
from supabase import create_client

app = FastAPI(title="Luciérnaga Ingestor v2")

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

class IngestRequest(BaseModel):
    source: dict
    ingestor_id: str | None = None

@app.post("/ingest")
async def ingest(req: IngestRequest):
    result = run_pipeline(req.source)
    supabase.table("pipeline_runs").insert({
        "ingestor_id": req.ingestor_id,
        "report": result,
        "quality_score": result.get("quality", 0)
    }).execute()
    return result

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ingestor-v2"}
