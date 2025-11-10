from datetime import datetime
from app.config import db
from bson import ObjectId

async def soft_delete_item(collection_name:str,item_id:str,item_type:str):
    
    if not ObjectId.is_valid(item_id):
        raise ValueError(f"Invalid ObjectId for {item_type}")
    
    collection = db[collection_name]
    obj_id = ObjectId(item_id)

    item = await collection.find_one({"_id":obj_id})
    if not item:
        raise ValueError(f"{item_type} not found")
    
    await db["logs"].insert_one({
        "item_type":item_type,
        "item_data":item,
        "deleted_at":datetime.utcnow()
    })

    await collection.update_one({"_id":obj_id},{"$set": {"deleted_at": datetime.utcnow()}})

 
    return {"message": f"{item_type.capitalize()} soft deleted"}