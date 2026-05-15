import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from supabase import create_client, Client
import httpx
import json
import csv
import io

# Inicializar FastAPI
app = FastAPI(title="Luciernaga Ingestor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Modelos
class MensajeChat(BaseModel):
    usuario_id: str
    contenido: str
    rol: str = "user"

class Ingestor(BaseModel):
    id: Optional[str] = None
    nombre: str
    tipo_fuente: str
    estado: str = "activo"
    fecha_creacion: Optional[datetime] = None

class ValidateRequest(BaseModel):
    ingestor_id: str
    data: dict
    schema: Optional[dict] = None

class TransformRequest(BaseModel):
    ingestor_id: str
    raw_data_id: str

# Endpoints
def _aggregate_metadata(metadata_list: list) -> dict:
    try:
        from ingestor.modules.transformer import aggregate_metadata
    except ImportError:
        from modules.transformer import aggregate_metadata
    return aggregate_metadata(metadata_list)


@app.get("/health")
async def health():
    # V2: Validation system endpoints enabled
    return {"status": "ok", "service": "ingestor"}

@app.get("/ingestores", response_model=List[dict])
async def get_ingestores():
    try:
        response = supabase.table("ingestores").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ingestores/{id}")
async def get_ingestor(id: str):
    try:
        ingestor_resp = supabase.table("ingestores").select("*").eq("id", id).execute()
        if not ingestor_resp.data:
            raise HTTPException(status_code=404, detail="Ingestor no encontrado")
        ingestor = ingestor_resp.data[0]

        raw_resp = (
            supabase.table("raw_data")
            .select("*")
            .eq("ingestor_id", id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        transformed_resp = (
            supabase.table("transformed_data")
            .select("*")
            .eq("ingestor_id", id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        metadata_list = [r.get("metadata", {}) for r in transformed_resp.data]
        aggregated_metadata = _aggregate_metadata(metadata_list)

        return {
            **ingestor,
            "raw_data": raw_resp.data,
            "transformed_data": transformed_resp.data,
            "metadata": aggregated_metadata,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/ingestores/{id}")
async def delete_ingestor(id: str):
    try:
        supabase.table("ingestores").delete().eq("id", id).execute()
        return {"message": "Ingestor eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transform")
async def transform(req: TransformRequest):
    try:
        from ingestor.modules.transformer import transform_data
    except ImportError:
        from modules.transformer import transform_data

    try:
        raw_resp = supabase.table("raw_data").select("*").eq("id", req.raw_data_id).execute()
        if not raw_resp.data:
            raise HTTPException(status_code=404, detail="raw_data no encontrado")

        raw_json = raw_resp.data[0].get("data", {})
        transformed, metadata = transform_data(raw_json)

        entry = {
            "ingestor_id": req.ingestor_id,
            "raw_data_id": req.raw_data_id,
            "data": transformed,
            "metadata": metadata,
        }
        result = supabase.table("transformed_data").insert(entry).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Error al guardar en transformed_data")

        return {"success": True, "transformed_data_id": result.data[0]["id"]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/guardar-mensaje")
async def guardar_mensaje(mensaje: MensajeChat):
    try:
        data = {
            "usuario_id": mensaje.usuario_id,
            "contenido": mensaje.contenido,
            "rol": mensaje.rol,
            "timestamp": datetime.utcnow().isoformat()
        }
        response = supabase.table("chat_historial").insert(data).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/historial/{usuario_id}")
async def get_historial(usuario_id: str):
    try:
        response = (
            supabase.table("chat_historial")
            .select("*")
            .eq("usuario_id", usuario_id)
            .order("timestamp", desc=False)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ VALIDACIÃ“N Y CUARENTENA ============

@app.post("/validate")
async def validate_data(request: ValidateRequest):
    """
    Valida datos segÃºn schema y devuelve acciÃ³n recomendada.
    """
    try:
        from ingestor.modules.validator import Validator
        
        validator = Validator()
        action, result = validator.validate_record(request.data, request.schema)
        
        return {
            "action": action,
            "result": result,
            "ingestor_id": request.ingestor_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-json")
async def upload_json(ingestor_id: str, records: list, schema: Optional[dict] = None):
    """
    Procesa un array de registros JSON, valida cada uno y guarda en Supabase.
    """
    try:
        from ingestor.modules.validator import Validator
        
        if not isinstance(records, list):
            raise HTTPException(status_code=400, detail="records debe ser un array")
        
        # Procesar cada registro
        stats = {
            "total": len(records),
            "accepted": 0,
            "quarantined": 0,
            "rejected": 0,
            "details": []
        }
        
        validator = Validator()
        
        for idx, record in enumerate(records):
            action, result = validator.validate_record(record, schema)
            
            # Guardar en raw_data
            try:
                raw_data_entry = {
                    "ingestor_id": ingestor_id,
                    "data": record,
                    "uploaded_by": "api-upload-json",
                    "company": "default",
                    "data_type": "raw",
                    "uploaded_at": datetime.utcnow().isoformat(),
                    "final_status": action,
                    "quality_score": result.get("quality_score", 0),
                    "error_count": result.get("error_count", 0),
                    "warning_count": result.get("warning_count", 0)
                }
                raw_response = supabase.table("raw_data").insert(raw_data_entry).execute()
                raw_data_id = raw_response.data[0]["id"] if raw_response.data else None
                
                # Si fue enviado a cuarentena
                if action == "quarantine":
                    quarantine_entry = {
                        "ingestor_id": ingestor_id,
                        "raw_data_id": raw_data_id,
                        "original_data": record,
                        "quarantine_reason": "; ".join([e.get("error_type", "unknown") for e in result.get("errors", [])]),
                        "error_details": {
                            "errors": result.get("errors", []),
                            "warnings": result.get("warnings", []),
                            "quality_score": result.get("quality_score", 0)
                        },
                        "status": "pending"
                    }
                    supabase.table("quarantine").insert(quarantine_entry).execute()
                    stats["quarantined"] += 1
                
                elif action == "accept":
                    stats["accepted"] += 1
                elif action == "reject":
                    stats["rejected"] += 1
                
                stats["details"].append({
                    "index": idx,
                    "action": action,
                    "quality_score": result.get("quality_score", 0),
                    "errors": len(result.get("errors", [])),
                    "warnings": len(result.get("warnings", []))
                })
                    
            except Exception as e:
                stats["details"].append({
                    "index": idx,
                    "error": str(e)
                })
        
        return {
            "message": f"Procesados {stats['total']} registros",
            "stats": {
                "total": stats["total"],
                "accepted": stats["accepted"],
                "quarantined": stats["quarantined"],
                "rejected": stats["rejected"]
            },
            "details": stats["details"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(ingestor_id: str, file: UploadFile = File(...), schema: Optional[str] = None):
    """
    Carga un archivo (CSV o JSON), valida cada registro y guarda en Supabase.
    """
    try:
        from ingestor.modules.validator import Validator
        
        # Leer archivo
        contents = await file.read()
        filename = file.filename
        
        # Parsear segÃºn tipo
        records = []
        if filename.endswith('.csv'):
            stream = io.StringIO(contents.decode('utf-8'))
            reader = csv.DictReader(stream)
            records = list(reader)
        elif filename.endswith('.json'):
            records = json.loads(contents.decode('utf-8'))
            if not isinstance(records, list):
                records = [records]
        else:
            raise HTTPException(status_code=400, detail="Solo CSV o JSON permitidos")
        
        # Parsear schema si viene
        validation_schema = None
        if schema:
            validation_schema = json.loads(schema)
        
        # Procesar cada registro
        stats = {
            "total": len(records),
            "accepted": 0,
            "quarantined": 0,
            "rejected": 0,
            "errors": [],
            "records_by_action": {"accept": [], "quarantine": [], "reject": []}
        }
        
        validator = Validator()
        
        for idx, record in enumerate(records):
            action, result = validator.validate_record(record, validation_schema)
            stats["records_by_action"][action].append({
                "index": idx,
                "data": record,
                "result": result
            })
            
            # Guardar en raw_data
            try:
                raw_data_entry = {
                    "ingestor_id": ingestor_id,
                    "data": record,
                    "uploaded_by": "api-upload",
                    "company": "default",
                    "data_type": "raw",
                    "uploaded_at": datetime.utcnow().isoformat(),
                    "final_status": action,
                    "quality_score": result.get("quality_score", 0),
                    "error_count": result.get("error_count", 0),
                    "warning_count": result.get("warning_count", 0)
                }
                raw_response = supabase.table("raw_data").insert(raw_data_entry).execute()
                raw_data_id = raw_response.data[0]["id"] if raw_response.data else None
                
                # Si fue enviado a cuarentena, guardar en tabla quarantine
                if action == "quarantine":
                    quarantine_entry = {
                        "ingestor_id": ingestor_id,
                        "raw_data_id": raw_data_id,
                        "original_data": record,
                        "quarantine_reason": "; ".join([e.get("error_type") for e in result.get("errors", [])]),
                        "error_details": {
                            "errors": result.get("errors", []),
                            "warnings": result.get("warnings", []),
                            "quality_score": result.get("quality_score", 0)
                        },
                        "status": "pending"
                    }
                    supabase.table("quarantine").insert(quarantine_entry).execute()
                    stats["quarantined"] += 1
                
                # Si fue aceptado
                elif action == "accept":
                    stats["accepted"] += 1
                
                # Si fue rechazado
                elif action == "reject":
                    stats["rejected"] += 1
                    
            except Exception as e:
                stats["errors"].append(f"Row {idx}: {str(e)}")
        
        return {
            "message": f"Procesado archivo {filename}",
            "stats": {
                "total": stats["total"],
                "accepted": stats["accepted"],
                "quarantined": stats["quarantined"],
                "rejected": stats["rejected"]
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/validation-errors")
async def get_validation_errors(ingestor_id: str = None, severity: str = None, limit: int = 100):
    """
    Obtiene errores de validaciÃ³n filtrados.
    """
    try:
        query = supabase.table("validation_errors").select("*")
        
        if ingestor_id:
            query = query.eq("ingestor_id", ingestor_id)
        if severity:
            query = query.eq("severity", severity)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quarantine")
async def get_quarantine(ingestor_id: str = None, status: str = "pending", limit: int = 50):
    """
    Obtiene registros en cuarentena.
    status: pending, reviewed, approved, rejected
    """
    try:
        query = supabase.table("quarantine").select("*")
        
        if ingestor_id:
            query = query.eq("ingestor_id", ingestor_id)
        
        if status:
            query = query.eq("status", status)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/quarantine/{quarantine_id}/review")
async def review_quarantine(quarantine_id: str, action: str, reviewed_by: str, notes: str = None):
    """
    Revisa un registro en cuarentena.
    action: 'accept', 'reject', 'discard'
    """
    try:
        if action not in ["accept", "reject", "discard"]:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        data = {
            "status": "reviewed",
            "action": action,
            "reviewed_by": reviewed_by,
            "reviewed_at": datetime.utcnow().isoformat(),
            "notes": notes,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("quarantine").update(data).eq("id", quarantine_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/validation-stats/{ingestor_id}")
async def get_validation_stats(ingestor_id: str, days: int = 7):
    """
    Obtiene estadÃ­sticas de validaciÃ³n para los Ãºltimos N dÃ­as.
    """
    try:
        response = (
            supabase.table("validation_summary")
            .select("*")
            .eq("ingestor_id", ingestor_id)
            .gte("date", f"now() - interval '{days} days'")
            .order("date", desc=True)
            .execute()
        )
        
        if not response.data:
            return {
                "message": "No validation data available",
                "ingestor_id": ingestor_id,
                "days": days
            }
        
        # Calcular agregados
        total_records = sum(r["total_records"] for r in response.data)
        total_valid = sum(r["valid_records"] for r in response.data)
        total_quarantined = sum(r["quarantined_records"] for r in response.data)
        total_critical = sum(r["critical_errors"] for r in response.data)
        
        return {
            "ingestor_id": ingestor_id,
            "period_days": days,
            "summary": {
                "total_records": total_records,
                "valid_records": total_valid,
                "quarantined_records": total_quarantined,
                "critical_errors": total_critical,
                "acceptance_rate": (total_valid / total_records * 100) if total_records > 0 else 0
            },
            "daily_breakdown": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validation-errors/{error_id}/log")
async def log_validation_error(error_id: str, action_taken: str):
    """
    Registra la acciÃ³n tomada para un error de validaciÃ³n.
    action_taken: 'accepted', 'rejected', 'quarantined'
    """
    try:
        if action_taken not in ["accepted", "rejected", "quarantined"]:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        response = supabase.table("validation_errors").update(
            {"action_taken": action_taken}
        ).eq("id", error_id).execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
