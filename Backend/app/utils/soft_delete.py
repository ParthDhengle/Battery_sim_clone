from datetime import datetime
from app.config import db
from bson import ObjectId
async def soft_delete_item(collection_name:str,item_id:str,item_type:str):
   
    if not ObjectId.is_valid(item_id) and item_id.startswith("ObjectId"):  # Handle legacy ObjectId strings
        try:
            obj_id = ObjectId(item_id.replace("ObjectId(", "").replace(")", ""))
        except:
            obj_id = item_id  # Treat as string ID
    else:
        obj_id = item_id  # String ID
    
    collection = db[collection_name]
    item = await collection.find_one({"_id": obj_id, "deleted_at": None})
    if not item:
        raise ValueError(f"{item_type} not found")
   
    await db["logs"].insert_one({
        "item_type":item_type,
        "item_data":item,
        "deleted_at":datetime.utcnow()
    })
    await collection.update_one({"_id": obj_id},{"$set": {"deleted_at": datetime.utcnow()}})
    return {"message": f"{item_type.capitalize()} soft deleted"}