# FILE: Backend/app/utils/zip_utils.py
import zipfile
import json
import pandas as pd
from io import StringIO
from typing import Tuple, Optional, Dict, Any

def save_continuation_zip(csv_path: str, metadata: Dict[str, Any], zip_path: str):
    """
    Save continuation ZIP (not currently used in core flow, but available for manual saves).
    """
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(csv_path, "simulation_data.csv")
            zf.writestr("metadata.json", json.dumps(metadata, indent=2))
        print(f"Continuation ZIP saved: {zip_path}")
    except Exception as e:
        raise ValueError(f"Failed to save ZIP: {e}")

def load_continuation_zip(zip_path: str) -> Tuple[Optional[Dict[str, Any]], Optional[str], int, pd.DataFrame]:
    """
    Load metadata, CSV content (as str), last_row, and existing_df from ZIP.
    Returns: (metadata, csv_str, last_row, existing_df)
    """
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
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
        print(f"Error loading ZIP {zip_path}: {e}")
        return None, None, 0, pd.DataFrame()