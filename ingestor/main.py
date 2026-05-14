import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from supabase import create_client, Client
import httpx

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

# Endpoints
@app.get("/health")
async def health():
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
        response = supabase.table("ingestores").select("*").eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Ingestor no encontrado")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/ingestores/{id}")
async def delete_ingestor(id: str):
    try:
        supabase.table("ingestores").delete().eq("id", id).execute()
        return {"message": "Ingestor eliminado"}
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

# ============ VALIDACIÓN Y CUARENTENA ============

@app.post("/validate")
async def validate_data(ingestor_id: str, data: dict, schema: dict = None):
    """
    Valida datos según schema y devuelve acción recomendada.
    """
    try:
        from modules.validator import Validator
        
        validator = Validator()
        action, result = validator.validate_record(data, schema)
        
        return {
            "action": action,
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/validation-errors")
async def get_validation_errors(ingestor_id: str = None, severity: str = None, limit: int = 100):
    """
    Obtiene errores de validación filtrados.
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
    Obtiene estadísticas de validación para los últimos N días.
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
    Registra la acción tomada para un error de validación.
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
