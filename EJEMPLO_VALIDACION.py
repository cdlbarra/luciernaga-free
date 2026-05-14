# ejemplo_pipeline_completo.py
# Demostración: Procesamiento de registros de usuario con validación

from modules.validator import run as validate
from utilidades import (
    SCHEMA_USER,
    get_config_for_mode,
    format_quarantine_reason,
    build_quarantine_entry,
    build_validation_error_entry,
)
from supabase import create_client
import os

# ============ CONFIGURACIÓN ============

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

INGESTOR_ID = "123e4567-e89b-12d3-a456-426614174000"

# ============ DATOS DE EJEMPLO ============

USUARIOS_A_PROCESAR = [
    # ✅ Válido
    {
        "id": "user_001",
        "email": "alice@example.com",
        "name": "Alice Johnson",
        "age": 28,
        "created_at": "2025-05-14"
    },
    # ⚠️ Warning (edad fuera de rango normal)
    {
        "id": "user_002",
        "email": "bob@example.com",
        "name": "Bob Smith",
        "age": 145,  # Sospechoso pero válido (max 150)
        "created_at": "2025-05-14"
    },
    # ❌ Error (email faltante)
    {
        "id": "user_003",
        "email": None,  # Faltante
        "name": "Carol Davis",
        "age": 35,
        "created_at": "2025-05-14"
    },
    # ❌ Error (name muy corto)
    {
        "id": "user_004",
        "email": "david@example.com",
        "name": "D",  # Menos de 2 caracteres
        "age": 30,
        "created_at": "2025-05-14"
    },
    # ❌ Error (tipo de dato incorrecto)
    {
        "id": "user_005",
        "email": "eve@example.com",
        "name": "Eve Wilson",
        "age": "thirty-five",  # String en lugar de número
        "created_at": "2025-05-14"
    },
]

# ============ FUNCIÓN PRINCIPAL ============

def procesar_usuarios():
    """
    Procesa una lista de usuarios:
    - ACEPTA los válidos
    - RECHAZA los con errores críticos
    - ENVÍA A CUARENTENA los sospechosos
    """
    
    print("\n" + "=" * 60)
    print("PROCESANDO USUARIOS CON VALIDACIÓN")
    print("=" * 60 + "\n")
    
    # Estadísticas
    stats = {
        "total": 0,
        "aceptados": 0,
        "rechazados": 0,
        "cuarentena": 0,
    }
    
    for usuario in USUARIOS_A_PROCESAR:
        stats["total"] += 1
        
        print(f"Procesando usuario: {usuario['id']}")
        print(f"  Email: {usuario.get('email', 'N/A')}")
        print(f"  Name: {usuario.get('name', 'N/A')}")
        
        # PASO 1: Validar contra schema
        context = {
            "raw_data": usuario,
            "schema": SCHEMA_USER,
            "validation_config": get_config_for_mode("lenient")
        }
        
        context = validate(context)
        
        action = context["validation_action"]
        result = context["validation_result"]
        
        # PASO 2: Actuar según resultado
        if action == "accept":
            print(f"  ✅ ACEPTADO (quality: {result['quality_score']}%)")
            stats["aceptados"] += 1
            procesar_usuario_valido(usuario, result)
            
        elif action == "reject":
            print(f"  ❌ RECHAZADO (errores: {result['error_count']})")
            stats["rechazados"] += 1
            registrar_error(usuario, result)
            
        elif action == "quarantine":
            print(f"  🔒 CUARENTENA (errores: {result['error_count']}, warnings: {result['warning_count']})")
            stats["cuarentena"] += 1
            enviar_a_cuarentena(usuario, result)
            # Mostrar errores específicos
            for error in result["errors"]:
                print(f"    - {error['error_type']}: {error['field_name']}")
        
        print()
    
    # RESUMEN
    print("=" * 60)
    print("RESUMEN")
    print("=" * 60)
    print(f"Total procesados: {stats['total']}")
    print(f"Aceptados:       {stats['aceptados']} ({stats['aceptados']/stats['total']*100:.0f}%)")
    print(f"Rechazados:      {stats['rechazados']} ({stats['rechazados']/stats['total']*100:.0f}%)")
    print(f"Cuarentena:      {stats['cuarentena']} ({stats['cuarentena']/stats['total']*100:.0f}%)")
    print()

# ============ FUNCIONES DE PROCESAMIENTO ============

def procesar_usuario_valido(usuario: dict, validation_result: dict):
    """
    Procesa un usuario que pasó validación.
    Aquí va la lógica normal: guardar, procesar, etc.
    """
    try:
        # Guardar en raw_data como válido
        data_to_insert = {
            "ingestor_id": INGESTOR_ID,
            "data": usuario,
            "uploaded_by": "system",
            "company": "test",
            "data_type": "raw",
            "uploaded_at": usuario.get("created_at"),
            "final_status": "valid",
            "quality_score": validation_result["quality_score"],
            "error_count": 0,
            "warning_count": validation_result["warning_count"]
        }
        
        response = supabase.table("raw_data").insert(data_to_insert).execute()
        print(f"  → Guardado en raw_data con ID: {response.data[0]['id']}")
        
    except Exception as e:
        print(f"  ⚠️ Error al guardar: {e}")

def registrar_error(usuario: dict, validation_result: dict):
    """
    Registra errores de validación.
    """
    try:
        raw_data_id = None  # No guardamos el record si fue rechazado
        
        for error in validation_result["errors"]:
            error_entry = build_validation_error_entry(INGESTOR_ID, raw_data_id, error)
            error_entry["action_taken"] = "rejected"
            
            supabase.table("validation_errors").insert(error_entry).execute()
        
        print(f"  → Registrados {len(validation_result['errors'])} errores")
        
    except Exception as e:
        print(f"  ⚠️ Error al registrar: {e}")

def enviar_a_cuarentena(usuario: dict, validation_result: dict):
    """
    Envía un registro a cuarentena para revisión manual.
    """
    try:
        # Primero guardar en raw_data como cuarentena
        data_to_insert = {
            "ingestor_id": INGESTOR_ID,
            "data": usuario,
            "uploaded_by": "system",
            "company": "test",
            "data_type": "raw",
            "uploaded_at": usuario.get("created_at"),
            "final_status": "quarantined",
            "quality_score": validation_result["quality_score"],
            "error_count": validation_result["error_count"],
            "warning_count": validation_result["warning_count"]
        }
        
        raw_data_response = supabase.table("raw_data").insert(data_to_insert).execute()
        raw_data_id = raw_data_response.data[0]["id"]
        
        # Guardar en quarantine
        quarantine_entry = build_quarantine_entry(
            INGESTOR_ID,
            raw_data_id,
            usuario,
            validation_result
        )
        
        supabase.table("quarantine").insert(quarantine_entry).execute()
        
        # Registrar errores individuales
        for error in validation_result["errors"]:
            error_entry = build_validation_error_entry(INGESTOR_ID, raw_data_id, error)
            error_entry["action_taken"] = "quarantined"
            supabase.table("validation_errors").insert(error_entry).execute()
        
        print(f"  → Enviado a cuarentena con razón: {quarantine_entry['quarantine_reason'][:50]}...")
        
    except Exception as e:
        print(f"  ⚠️ Error al cuarentena: {e}")

# ============ EJECUCIÓN ============

if __name__ == "__main__":
    procesar_usuarios()
    
    print("\n💡 Próximas acciones:")
    print("1. Revisar cuarentena: GET /quarantine?status=pending")
    print("2. Revisar un registro: POST /quarantine/{id}/review")
    print("3. Ver estadísticas: GET /validation-stats/{ingestor_id}")
