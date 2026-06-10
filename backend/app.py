from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import google.generativeai as genai
from dotenv import load_dotenv
import os
from bson import ObjectId
import werkzeug.utils
import datetime
import uuid
import chromadb
from pypdf import PdfReader
from docx import Document as DocxDocument
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

load_dotenv()
try:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-2.5-flash")
except Exception as e:
    print("Gemini configuration issue", e)

mongo_uri = os.getenv("MONGODB_URI")
client = MongoClient(mongo_uri)
print("Mongo connected")

db = client["student_database"]
collection = db["student"]
leave_collection = db["leave_requests"]
marks_collection = db["marks"]
materials_collection = db["materials"]
chunks_collection = db["document_chunks"]

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

chroma_collection = None
embedder = None

try:
    print("Initializing ChromaDB...")
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    chroma_collection = chroma_client.get_or_create_collection(name="study_materials")
    print("Initializing SentenceTransformer...")
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    print("ChromaDB and Embedder ready")
except Exception as e:
    print(f"CRITICAL: ChromaDB/Embedder initialization failed: {str(e)}")

def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    print("LOGIN REQUEST:", data)
    role_val = data.get('role', '')
    username_val = data.get('username', '')
    password_val = data.get('password', '')
    
    role = role_val.strip() if role_val else ''
    username = username_val.strip() if username_val else ''
    password = password_val.strip() if password_val else ''

    print("USERNAME:", username)
    print("ROLE:", role)

    if role == "Teacher" and username == "teacher" and password == "teacher123":
        return jsonify({"success": True, "role": "Teacher"})
    
    elif role == "Student":
        # Make the username case-insensitive using regex
        query = {"username": {"$regex": f"^{username}$", "$options": "i"}, "password": password}
        student = collection.find_one(query)
        
        # Determine log output ensuring no sensitive object is blindly printed
        log_student = {k: v for k, v in student.items() if k not in ["password", "_id"]} if student else None
        print("MONGO RESULT:", log_student)
        
        if student:
            return jsonify({"success": True, "role": "Student", "student_id": student["student_id"]})
        else:
            return jsonify({"success": False, "message": "Invalid Credentials"}), 401
            
    return jsonify({"success": False, "message": "Invalid Role"}), 400

@app.route('/api/students', methods=['GET', 'POST'])
def manage_students():
    if request.method == 'GET':
        students = list(collection.find())
        return jsonify([serialize_doc(s) for s in students])

    if request.method == 'POST':
        data = request.json
        student_data = {
            "student_id": data.get("student_id"),
            "name": data.get("name"),
            "department": data.get("department"),
            "year": data.get("year"),
            "cgpa": data.get("cgpa"),
            "total_classes": 0,
            "present_classes": 0,
            "attendance_percentage": 100
        }
        collection.insert_one(student_data)
        return jsonify({"success": True, "message": "Student Added Successfully"})

@app.route('/api/students/<student_name>', methods=['DELETE'])
def delete_student(student_name):
    result = collection.delete_one({"name": {"$regex": f"^{student_name}$", "$options": "i"}})
    if result.deleted_count > 0:
        return jsonify({"success": True, "message": "Student Deleted Successfully"})
    return jsonify({"success": False, "message": "Student Not Found"}), 404

@app.route('/api/attendance', methods=['POST'])
def save_attendance():
    data = request.json
    for attendance_record in data.get("attendance_records", []):
        student_id = attendance_record["student_id"]
        status = attendance_record["status"]
        student = collection.find_one({"student_id": student_id})
        if student:
            total = student.get("total_classes", 0) + 1
            present = student.get("present_classes", 0) + (1 if status == "Present" else 0)
            percentage = round((present / total) * 100, 2) if total > 0 else 0
            collection.update_one(
                {"student_id": student_id},
                {"$set": {
                    "total_classes": total,
                    "present_classes": present,
                    "attendance_percentage": percentage
                }}
            )
    return jsonify({"success": True, "message": "Attendance Saved Successfully"})

@app.route('/api/attendance/report', methods=['GET'])
def attendance_report():
    students = list(collection.find({}, {"_id": 1, "student_id": 1, "name": 1, "department": 1, "attendance_percentage": 1}))
    return jsonify([serialize_doc(s) for s in students])

@app.route('/api/leave/requests', methods=['GET'])
def get_leave_requests():
    requests = list(leave_collection.find({"status": "Pending"}))
    return jsonify([serialize_doc(r) for r in requests])

@app.route('/api/leave/requests/<req_id>', methods=['PUT'])
def update_leave_request(req_id):
    data = request.json
    status = data.get("status")
    leave_collection.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": status}})
    return jsonify({"success": True, "message": f"Leave {status}"})

@app.route('/api/leave/apply', methods=['POST'])
def apply_leave():
    data = request.json
    student_id = data.get("student_id")
    student = collection.find_one({"student_id": student_id})
    if student:
        leave_data = {
            "student_id": student_id,
            "student_name": student["name"],
            "reason": data.get("reason"),
            "duration": data.get("duration"),
            "attendance_percentage": student.get("attendance_percentage", 100),
            "status": "Pending",
            "emailSent": False,
            "email": student.get("email")
        }
        leave_collection.insert_one(leave_data)
        return jsonify({"success": True, "message": "Leave Request Submitted Successfully"})
    return jsonify({"success": False, "message": "Student Not Found"}), 404

@app.route('/api/leave/status', methods=['GET'])
def leave_status():
    student_id = request.args.get("student_id")
    requests = list(leave_collection.find({"student_id": student_id}).sort("_id", -1))
    return jsonify([serialize_doc(r) for r in requests])

@app.route('/api/marks', methods=['GET', 'POST'])
def manage_marks():
    if request.method == 'GET':
        students = list(collection.find())
        marks_data = []
        for student in students:
            existing_marks = marks_collection.find_one({"student_id": student["student_id"]})
            mark_entry = {
                "Student ID": student["student_id"],
                "Student Name": student["name"],
                "Python": existing_marks.get("Python", "") if existing_marks else "",
                "SQL": existing_marks.get("SQL", "") if existing_marks else "",
                "Machine Learning": existing_marks.get("Machine Learning", "") if existing_marks else "",
                "Deep Learning": existing_marks.get("Deep Learning", "") if existing_marks else ""
            }
            marks_data.append(mark_entry)
        return jsonify(marks_data)

    if request.method == 'POST':
        data = request.json
        marks_records = data.get("marks_records", [])
        for row in marks_records:
            marks_collection.update_one(
                {"student_id": row["Student ID"]},
                {"$set": {
                    "student_id": row["Student ID"],
                    "student_name": row["Student Name"],
                    "Python": row["Python"],
                    "SQL": row["SQL"],
                    "Machine Learning": row["Machine Learning"],
                    "Deep Learning": row["Deep Learning"]
                }},
                upsert=True
            )
        return jsonify({"success": True, "message": "Marks Saved Successfully"})

@app.route('/api/student/marks', methods=['GET'])
def get_student_marks():
    student_id = request.args.get("student_id")
    marks = marks_collection.find_one({"student_id": student_id})
    if marks:
        return jsonify({"success": True, "marks": serialize_doc(marks)})
    return jsonify({"success": False, "message": "Student ID not found"}), 404

@app.route('/api/student/info', methods=['GET'])
def get_student_info():
    student_id = request.args.get("student_id")
    student = collection.find_one({"student_id": student_id})
    if student:
        return jsonify({"success": True, "student": serialize_doc(student)})
    return jsonify({"success": False, "message": "Student Not Found"}), 404

@app.route('/api/chat/teacher', methods=['POST'])
def chat_teacher():
    data = request.json
    question = data.get("question")
    
    students = list(collection.find({}, {"_id": 0}))
    marks = list(marks_collection.find({}, {"_id": 0}))
    leaves = list(leave_collection.find({}, {"_id": 0}))

    prompt = f"""
You are an intelligent Teacher AI Assistant for a Student Management System.
You have access to:
Student Data:
{students}
Marks Data:
{marks}
Leave Data:
{leaves}
Rules:
1. Answer naturally like ChatGPT.
2. Maintain conversational context.
3. If the user greets you, greet them back.
4. If the user says thank you, respond politely.
5. If the user says bye, say goodbye naturally.
6. For questions about students, attendance, marks, leave requests, or academic records, use the database information above.
7. For general knowledge questions, answer normally.
8. If information is not available in the database, say so clearly.
9. Keep answers concise and professional.
10. When asked about marks, attendance, or leave status, provide exact values from the database.
{question}
"""
    try:
        response = model.generate_content(prompt)
        return jsonify({"success": True, "reply": response.text})
    except Exception as e:
        return jsonify({"success": False, "reply": f"Error: {str(e)}"})

@app.route('/api/chat/student', methods=['POST'])
def chat_student():
    data = request.json
    question = data.get("question")
    student_id = data.get("student_id")

    student = collection.find_one({"student_id": student_id})
    if not student:
        return jsonify({"success": False, "reply": "Student not found."})

    marks = marks_collection.find_one({"student_id": student_id}) or {}
    leaves = list(leave_collection.find({"student_id": student_id}))

    q = question.lower()
    for s in collection.find():
        other_name = s["name"].lower()
        if other_name in q and other_name != student["name"].lower():
            return jsonify({"success": True, "reply": "I can only provide information about your own records."})

    if "deep learning" in q:
        return jsonify({"success": True, "reply": f"Your Deep Learning mark is {marks.get('Deep Learning', 'Not Available')}."})
    elif "machine learning" in q:
        return jsonify({"success": True, "reply": f"Your Machine Learning mark is {marks.get('Machine Learning', 'Not Available')}."})
    elif "python" in q:
        return jsonify({"success": True, "reply": f"Your Python mark is {marks.get('Python', 'Not Available')}."})
    elif "sql" in q:
        return jsonify({"success": True, "reply": f"Your SQL mark is {marks.get('SQL', 'Not Available')}."})
    elif any(word in q for word in ["leave status", "accepted", "rejected", "approval"]):
        leaves_sorted = list(leave_collection.find({"student_id": student["student_id"]}).sort("_id", -1))
        if not leaves_sorted:
            return jsonify({"success": True, "reply": "No leave request found."})
        latest_leave = leaves_sorted[0]
        return jsonify({"success": True, "reply": f"Your leave status is {latest_leave['status']}."})
    elif "leave" in q:
        return jsonify({"success": True, "reply": f"You have {len(leaves)} leave request(s)."})
    elif "attendance" in q:
        if student["name"].lower() not in q and "my" not in q:
            return jsonify({"success": True, "reply": "I can only provide information about your own records."})
        attendance = student.get("attendance_percentage", "Not Available")
        return jsonify({"success": True, "reply": f"Your attendance percentage is {attendance}%."})

    student.pop("_id", None)
    if "_id" in marks: marks.pop("_id")
    for l in leaves:
        if "_id" in l: l.pop("_id")

    prompt = f"""
Student Details:
{student}
Marks:
{marks}
Leaves:
{leaves}
Question:
{question}
Answer only using the above data.
"""
    try:
        response = model.generate_content(prompt)
        return jsonify({"success": True, "reply": response.text})
    except Exception as e:
        return jsonify({"success": False, "reply": f"Error: {e}"})

@app.route('/api/upload-material', methods=['POST'])
def upload_material():
    print("UPLOAD REQUEST RECEIVED")
    try:
        if 'file' not in request.files:
            print("Error: No file in request.files")
            return jsonify({"success": False, "message": "No file added"}), 400
        
        file = request.files['file']
        if file.filename == '':
            print("Error: Empty filename")
            return jsonify({"success": False, "message": "No file selected"}), 400

        title = request.form.get('title', 'Unknown Title')
        subject = request.form.get('subject', 'Unknown Subject')
        department = request.form.get('department', 'Unknown Dept')
        semester = request.form.get('semester', 'Unknown Sem')
        
        print(f"Processing upload: {title} | {subject} | {filename if 'filename' in locals() else file.filename}")

        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            print(f"Created missing folder: {app.config['UPLOAD_FOLDER']}")

        filename = werkzeug.utils.secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        print(f"File saved to: {file_path}")

        text = ""
        print("Extracting text...")
        try:
            if filename.endswith('.pdf'):
                reader = PdfReader(file_path)
                for page in reader.pages:
                    text += (page.extract_text() or "") + "\n"
            elif filename.endswith('.docx'):
                doc = DocxDocument(file_path)
                for para in doc.paragraphs:
                    text += para.text + "\n"
            elif filename.endswith('.txt'):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
            print(f"Text extracted. Length: {len(text)} characters")
        except Exception as e:
            print(f"Text extraction error: {e}")
            return jsonify({"success": False, "message": f"Error extracting text: {str(e)}"}), 500

        # Create MongoDB Record
        material = {
            "title": title,
            "subject": subject,
            "department": department,
            "semester": semester,
            "file_url": filename,
            "uploaded_by": "Teacher",
            "upload_date": datetime.datetime.now()
        }
        
        print("Saving record to MongoDB...")
        result = materials_collection.insert_one(material)
        material_id = str(result.inserted_id)
        print(f"MongoDB record created with ID: {material_id}")

        # RAG Processing
        if embedder is None or chroma_collection is None:
            print("WARNING: RAG system not initialized. Skipping embedding.")
            return jsonify({"success": True, "message": "Material uploaded successfully (RAG processing skipped due to system initialization failure)"})

        print("Chunking and Embedding...")
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_text(text)
        
        if chunks:
            try:
                embeddings = embedder.encode(chunks).tolist()
                chunk_ids = [str(uuid.uuid4()) for _ in chunks]
                metadatas = [{"material_id": material_id, "title": title, "subject": subject} for _ in chunks]
                
                print(f"Adding {len(chunks)} chunks to ChromaDB for material_id: {material_id}")
                chroma_collection.add(
                    ids=chunk_ids,
                    embeddings=embeddings,
                    documents=chunks,
                    metadatas=metadatas
                )

                print(f"Generating embeddings for {len(chunks)} chunks...")
                for i, chunk in enumerate(chunks):
                    chunks_collection.insert_one({
                        "material_id": material_id,
                        "chunk_text": chunk,
                        "embedding": embeddings[i]
                    })
                print(f"Successfully stored {len(chunks)} vectors in ChromaDB and MongoDB")
            except Exception as e:
                print(f"Embedding error: {e}")
                return jsonify({"success": True, "message": f"Material uploaded, but RAG indexing failed: {str(e)}"})

        return jsonify({"success": True, "message": "Material uploaded successfully"})
    except Exception as e:
        print(f"Unexpected error in upload-material: {e}")
        return jsonify({"success": False, "message": f"Server Error: {str(e)}"}), 500

@app.route('/api/materials', methods=['GET'])
def get_materials():
    materials = list(materials_collection.find())
    return jsonify([serialize_doc(m) for m in materials])

@app.route('/api/materials/<material_id>', methods=['DELETE'])
def delete_material(material_id):
    materials_collection.delete_one({"_id": ObjectId(material_id)})
    chunks_collection.delete_many({"material_id": material_id})
    try:
        chroma_collection.delete(where={"material_id": material_id})
    except Exception as e:
        print("ChromaDB delete error", e)
    return jsonify({"success": True, "message": "Material Deleted"})

@app.route('/api/ask-material-question', methods=['POST'])
def ask_material_question():
    data = request.json or {}
    question = data.get("question", "")
    selected_material_id = data.get("material_id") # Optional

    print(f"--- RAG QUESTION RECEIVED ---")
    print(f"Question: {question}")
    print(f"Selected Material ID: {selected_material_id or 'All Materials'}")

    if not question:
        return jsonify({"success": False, "reply": "Empty question."})

    try:
        print("Generating query embedding...")
        question_embedding = embedder.encode(question).tolist()
        
        query_args = {
            "query_embeddings": [question_embedding],
            "n_results": 4
        }
        
        if selected_material_id:
            query_args["where"] = {"material_id": selected_material_id}
            print(f"Filtering by material_id: {selected_material_id}")

        print("Searching ChromaDB...")
        results = chroma_collection.query(**query_args)

        documents = results.get('documents', [[]])[0]
        metadatas = results.get('metadatas', [[]])[0]
        distances = results.get('distances', [[]])[0]

        print(f"Retrieved {len(documents)} chunks")
        if distances:
            print(f"Similarity Scores (Distances): {distances}")

        if not documents:
            print("No relevant chunks found.")
            return jsonify({"success": True, "reply": "No relevant study materials found to answer your question.", "sources": []})

        context = "\n\n".join(documents)
        
        prompt = f"""
You are an AI Study Material Assistant. Answer the student's question ONLY using the provided context from study materials. 
If the answer is not contained in the context, say "I could not find the answer in the uploaded study materials."

Context:
{context}

Question:
{question}
"""
        print("Sending prompt to Gemini...")
        response = model.generate_content(prompt)
        print("Gemini response generated.")
        
        sources = []
        source_details = []
        for i, m in enumerate(metadatas):
            src_name = f"{m.get('title')} ({m.get('subject')})"
            if src_name not in sources:
                sources.append(src_name)
            
            source_details.append({
                "title": m.get('title'),
                "subject": m.get('subject'),
                "chunk": documents[i],
                "score": distances[i] if i < len(distances) else None
            })

        print(f"Sources Used: {sources}")
        print(f"--- RAG PROCESSING COMPLETE ---")

        return jsonify({
            "success": True, 
            "reply": response.text,
            "sources": sources,
            "source_details": source_details
        })
    except Exception as e:
        print(f"CRITICAL ERROR in RAG Assistant: {str(e)}")
        return jsonify({"success": False, "reply": f"Internal Error: {str(e)}"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
