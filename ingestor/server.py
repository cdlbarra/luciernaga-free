from fastapi import FastAPI
from pydantic import BaseModel
from main import run_pipeline
from modules.transformer import transform_data, _extract_records
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

class TransformRequest(BaseModel):
    ingestor_id: str
    raw_data_id: str

@app.post("/ingest")
async def ingest(req: IngestRequest):
    result = run_pipeline(req.source)
    supabase.table("pipeline_runs").insert({
        "ingestor_id": req.ingestor_id,
        "report": result,
        "quality_score": result.get("quality", 0)
    }).execute()
    return result

@app.post("/transform")
async def transform(req: TransformRequest):
    try:
        result = supabase.table("raw_data").select("data").eq("id", req.raw_data_id).single().execute()
        if not result.data:
            return {"success": False, "detail": "Registro no encontrado"}

        records = _extract_records(result.data["data"])
        transformed_records = [transform_data(r)[0] for r in records]

        supabase.table("raw_data").update({"data": transformed_records}).eq("id", req.raw_data_id).execute()
        supabase.table("pipeline_runs").insert({
            "ingestor_id": req.ingestor_id,
            "report": {"action": "transform", "records_processed": len(transformed_records)},
            "quality_score": 100,
        }).execute()

        return {"success": True}
    except Exception as e:
        return {"success": False, "detail": str(e)}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ingestor-v2"}
