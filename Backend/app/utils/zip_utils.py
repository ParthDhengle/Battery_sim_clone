# FILE: Backend/app/utils/zip_utils.py
import zipfile
import json
import pandas as pd
from io import BytesIO, StringIO
from typing import Tuple, Optional, Dict, Any
from app.config import storage_manager

async def save_continuation_zip(csv_content: str, metadata: Dict[str, Any], rel_zip_path: str):
    """
    Save continuation ZIP to storage (relative path).
    csv_content: CSV as string (not path).
    """
    try:
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("simulation_data.csv", csv_content)
            zf.writestr("metadata.json", json.dumps(metadata, indent=2))
        zip_bytes = zip_buffer.getvalue()
        await storage_manager.save_file(rel_zip_path, zip_bytes, is_text=False)
        print(f"Continuation ZIP saved: {rel_zip_path}")
    except Exception as e:
        raise ValueError(f"Failed to save ZIP: {e}")

async def load_continuation_zip(rel_zip_path: str) -> Tuple[Optional[Dict[str, Any]], Optional[str], int, pd.DataFrame]:
    """
    Load metadata, CSV content (as str), last_row, and existing_df from ZIP in storage.
    rel_zip_path: Relative path in storage.
    Returns: (metadata, csv_str, last_row, existing_df)
    """
    try:
        zip_bytes = await storage_manager.load_file(rel_zip_path)
        zip_buffer = BytesIO(zip_bytes)
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            namelist = zf.namelist()
            if "metadata.json" not in namelist or "simulation_data.csv" not in namelist:
                return None, None, 0, pd.DataFrame()

            # Load metadata
            metadata_str = zf.read("metadata.json").decode('utf-8')
            metadata = json.loads(metadata_str)

            # Load CSV as string and DF
            csv_bytes = zf.read("simulation_data.csv")
            csv_str = csv_bytes.decode('utf-8')
            existing_df = pd.read_csv(StringIO(csv_str))

            last_row = metadata.get("last_row", 0)

            return metadata, csv_str, last_row, existing_df
    except Exception as e:
        print(f"Error loading ZIP {rel_zip_path}: {e}")
        return None, None, 0, pd.DataFrame()