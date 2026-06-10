from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv("MONGODB_URI")
client = MongoClient(mongo_uri)
db = client["student_database"]
materials_collection = db["materials"]

print("Materials Count:", materials_collection.count_documents({}))
for doc in materials_collection.find():
    print(doc)
