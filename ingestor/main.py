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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
