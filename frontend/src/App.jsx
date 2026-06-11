import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as icons from 'lucide-react';

import './App.css';

const API_BASE = 'https://erp-portal-new.onrender.com/api';

// --- Login Component ---
function Login({ onLogin }) {
  const [role, setRole] = useState('Teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { role, username, password };
      console.log("LOGIN PAYLOAD:", payload);
      const res = await axios.post(`${API_BASE}/login`, payload);
      console.log("LOGIN RESPONSE:", res.data);
      if (res.data.success) {
        onLogin(res.data);
      } else {
        setError(res.data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container animate-fade-in">
      <div className="login-card card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2>Student Management System</h2>
          <p style={{ color: 'var(--text-muted)' }}>College ERP Secure Login Portal</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="Teacher">Teacher</option>
              <option value="Student">Student</option>
            </select>
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Menu Component ---
function MenuLanding({ role }) {
  return (
    <div className="landing-container animate-slide-down">
      <h2>Welcome to the System</h2>
      <p style={{ color: 'var(--text-muted)' }}>Please select an option from the sidebar to continue.</p>
    </div>
  );
}

// --- Student Dashboard ---
function StudentDashboard() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ student_id: '', name: '', department: '', year: 1, cgpa: 0 });
  
  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students`);
      setStudents(res.data);
    } catch (err) { }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/students`, form);
    setForm({ student_id: '', name: '', department: '', year: 1, cgpa: 0 });
    fetchStudents();
  };

  const handleDelete = async (name) => {
    if(window.confirm("Are you sure?")) {
      await axios.delete(`${API_BASE}/students/${name}`);
      fetchStudents();
    }
  };

  return (
    <div className="page animate-fade-in">
      <h2>Student Management</h2>
      <div className="card">
        <h3>Add New Student</h3>
        <form onSubmit={handleAdd} className="two-col-form">
          <input placeholder="Student ID" value={form.student_id} onChange={e=>setForm({...form, student_id: e.target.value})} required/>
          <input placeholder="Student Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required/>
          <input placeholder="Department" value={form.department} onChange={e=>setForm({...form, department: e.target.value})} required/>
          <input type="number" placeholder="Year" value={form.year} onChange={e=>setForm({...form, year: e.target.value})} required min="1" max="4"/>
          <input type="number" step="0.1" placeholder="CGPA" value={form.cgpa} onChange={e=>setForm({...form, cgpa: e.target.value})} required min="0" max="10"/>
          <button type="submit">Add Student</button>
        </form>
      </div>
      <div className="card">
         <h3>Student Records</h3>
         <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Dept</th><th>Action</th></tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s._id}>
                  <td>{s.student_id}</td><td>{s.name}</td><td>{s.department}</td>
                  <td><button className="btn-danger" onClick={() => handleDelete(s.name)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}

// --- Attendance Component ---
function Attendance() {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    axios.get(`${API_BASE}/students`).then(res => {
      setStudents(res.data);
      const initAtt = {};
      res.data.forEach(s => initAtt[s.student_id] = 'Present');
      setAttendance(initAtt);
    });
  }, []);

  const handleSave = async () => {
    const records = Object.keys(attendance).map(id => ({ student_id: id, status: attendance[id] }));
    await axios.post(`${API_BASE}/attendance`, { attendance_records: records });
    alert("Attendance Saved Successfully");
  };

  return (
    <div className="page animate-fade-in">
      <h2>Attendance Management</h2>
      <div className="card">
        {students.map(s => (
          <div key={s.student_id} className="radio-group">
            <span style={{width: '200px', display: 'inline-block', fontWeight: 500}}>{s.name} ({s.student_id})</span>
            <label>
              <input type="radio" name={`att-${s.student_id}`} checked={attendance[s.student_id]==='Present'} onChange={() => setAttendance({...attendance, [s.student_id]: 'Present'})} />
              Present
            </label>
            <label>
              <input type="radio" name={`att-${s.student_id}`} checked={attendance[s.student_id]==='Absent'} onChange={() => setAttendance({...attendance, [s.student_id]: 'Absent'})} />
              Absent
            </label>
          </div>
        ))}
        <button onClick={handleSave} style={{marginTop: '1.5rem'}}>Save Attendance</button>
      </div>
    </div>
  );
}

// --- Marks Entry Component ---
function MarksEntry() {
  const [marksData, setMarksData] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/marks`).then(res => {
      setMarksData(res.data);
    });
  }, []);

  const handleChange = (index, field, value) => {
    const updated = [...marksData];
    updated[index][field] = value;
    setMarksData(updated);
  };

  const handleSave = async () => {
    await axios.post(`${API_BASE}/marks`, { marks_records: marksData });
    alert("Marks Saved Successfully");
  };

  return (
    <div className="page animate-fade-in">
      <h2>Marks Management</h2>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Python</th>
              <th>SQL</th>
              <th>Machine Learning</th>
              <th>Deep Learning</th>
            </tr>
          </thead>
          <tbody>
            {marksData.map((row, i) => (
              <tr key={row["Student ID"]}>
                <td>{row["Student ID"]}</td>
                <td>{row["Student Name"]}</td>
                <td><input value={row["Python"]} onChange={e => handleChange(i, 'Python', e.target.value)} /></td>
                <td><input value={row["SQL"]} onChange={e => handleChange(i, 'SQL', e.target.value)} /></td>
                <td><input value={row["Machine Learning"]} onChange={e => handleChange(i, 'Machine Learning', e.target.value)} /></td>
                <td><input value={row["Deep Learning"]} onChange={e => handleChange(i, 'Deep Learning', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={handleSave} style={{marginTop: '1.5rem'}}>Save Marks</button>
      </div>
    </div>
  );
}

// --- Leave Management Teacher ---
function LeaveManagementTeacher() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const res = await axios.get(`${API_BASE}/leave/requests`);
    setRequests(res.data);
  };

  const handleAction = async (id, status) => {
    await axios.put(`${API_BASE}/leave/requests/${id}`, { status });
    fetchRequests();
  };

  return (
    <div className="page animate-fade-in">
      <h2>Leave Requests</h2>
      {requests.length === 0 ? (
        <div className="card">No pending leave requests.</div>
      ) : (
        requests.map(req => (
          <div key={req._id} className="card">
            <h3>{req.student_name}</h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
              <div><strong>Student ID:</strong> {req.student_id}</div>
              <div><strong>Duration:</strong> {req.duration} Days</div>
              <div><strong>Reason:</strong> {req.reason}</div>
              <div><strong>Attendance:</strong> {req.attendance_percentage}%</div>
            </div>
            <div style={{display: 'flex', gap: '1rem'}}>
              <button onClick={() => handleAction(req._id, 'Approved')} className="btn-success">Approve</button>
              <button onClick={() => handleAction(req._id, 'Rejected')} className="btn-danger">Reject</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- Study Materials Management ---
function StudyMaterialsManagement() {
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({ title: '', subject: '', department: '', semester: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await axios.get(`${API_BASE}/materials`);
      setMaterials(res.data);
    } catch (err) {}
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a file.");
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', form.title);
    formData.append('subject', form.subject);
    formData.append('department', form.department);
    formData.append('semester', form.semester);

    setLoading(true);
    console.log("Starting upload for:", form.title);
    try {
      const res = await axios.post(`${API_BASE}/upload-material`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log("Upload response:", res.data);
      if (res.data.success) {
        alert("Material uploaded successfully");
        setForm({ title: '', subject: '', department: '', semester: '' });
        setFile(null);
        fetchMaterials();
      } else {
        alert("Server Error: " + res.data.message);
      }
    } catch (error) {
      console.error("Upload Error:", error);
      const errorMsg = error.response?.data?.message || error.message || "Unknown upload error";
      alert("Upload failed: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure?")) {
      await axios.delete(`${API_BASE}/materials/${id}`);
      fetchMaterials();
    }
  };

  return (
    <div className="page animate-fade-in">
      <h2>Study Materials</h2>
      <div className="card">
        <h3>Upload Material</h3>
        <form onSubmit={handleUpload} className="two-col-form mb-4" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
          <input placeholder="Material Title" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} required/>
          <input placeholder="Subject" value={form.subject} onChange={e=>setForm({...form, subject: e.target.value})} required/>
          <input placeholder="Department" value={form.department} onChange={e=>setForm({...form, department: e.target.value})} required/>
          <input placeholder="Semester" value={form.semester} onChange={e=>setForm({...form, semester: e.target.value})} required/>
          <input type="file" accept=".pdf,.txt,.docx" onChange={e=>setFile(e.target.files[0])} required style={{gridColumn: '1 / -1'}}/>
          <button type="submit" disabled={loading} style={{gridColumn: '1 / -1'}}>
            {loading ? 'Uploading...' : 'Upload Material'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Uploaded Materials</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Semester</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m._id}>
                <td>{m.title}</td>
                <td>{m.subject}</td>
                <td>{m.semester}</td>
                <td>{new Date(m.upload_date).toLocaleDateString()}</td>
                <td><button className="btn-danger" onClick={() => handleDelete(m._id)}>Delete</button></td>
              </tr>
            ))}
            {materials.length === 0 && <tr><td colSpan="5" style={{textAlign:'center'}}>No materials uploaded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Student views...
function StudentAttendance({ studentId }) {
  const [student, setStudent] = useState(null);
  
  useEffect(() => {
    axios.get(`${API_BASE}/student/info?student_id=${studentId}`).then(res => setStudent(res.data.student));
  }, [studentId]);

  if(!student) return <div>Loading...</div>;

  return (
    <div className="page animate-fade-in">
      <h2>My Attendance</h2>
      <div className="card">
        <h3>{student.name}</h3>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
          <div><strong>Department:</strong> {student.department}</div>
          <div><strong style={{fontSize: '1.2rem'}}>Attendance:</strong> <span style={{fontSize: '1.2rem', color: 'var(--primary-color)'}}>{student.attendance_percentage}%</span></div>
          <div><strong>Present Classes:</strong> {student.present_classes}</div>
          <div><strong>Total Classes:</strong> {student.total_classes}</div>
        </div>
      </div>
    </div>
  );
}

function StudentStudyMaterials() {
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await axios.get(`${API_BASE}/materials`);
      setMaterials(res.data);
    } catch (err) {}
  };

  return (
    <div className="page animate-fade-in">
      <h2>Available Study Materials</h2>
      <div className="card">
        <h3>Shared Documents</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Semester</th>
              <th>Upload Date</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m._id}>
                <td>{m.title}</td>
                <td>{m.subject}</td>
                <td>{m.semester}</td>
                <td>{new Date(m.upload_date).toLocaleDateString()}</td>
              </tr>
            ))}
            {materials.length === 0 && <tr><td colSpan="4" style={{textAlign:'center'}}>No study materials available yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentMarks({ studentId }) {
  const [marks, setMarks] = useState(null);
  const [student, setStudent] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/student/marks?student_id=${studentId}`).then(res => setMarks(res.data.marks)).catch(()=>setMarks({}));
    axios.get(`${API_BASE}/student/info?student_id=${studentId}`).then(res => setStudent(res.data.student));
  }, [studentId]);

  return (
    <div className="page animate-fade-in">
      <h2>My Marks</h2>
      <div className="card">
        <h3>{student?.name}</h3>
        {marks ? (
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
           {marks.Python && <div className="metric-box"><span>Python</span><strong>{marks.Python}</strong></div>}
           {marks.SQL && <div className="metric-box"><span>SQL</span><strong>{marks.SQL}</strong></div>}
           {marks['Machine Learning'] && <div className="metric-box"><span>Machine Learning</span><strong>{marks['Machine Learning']}</strong></div>}
           {marks['Deep Learning'] && <div className="metric-box"><span>Deep Learning</span><strong>{marks['Deep Learning']}</strong></div>}
          </div>
        ) : <p>No marks found.</p>}
      </div>
    </div>
  );
}

function StudentLeaveApply({ studentId }) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(1);
  const [statusList, setStatusList] = useState([]);

  useEffect(() => {fetchStatus()}, [studentId]);

  const fetchStatus = async () => {
    const res = await axios.get(`${API_BASE}/leave/status?student_id=${studentId}`);
    setStatusList(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/leave/apply`, { student_id: studentId, reason, duration });
    setReason(''); setDuration(1);
    fetchStatus();
  };

  return (
    <div className="page animate-fade-in">
      <h2>Leave Management</h2>
      <div className="card">
        <h3>Apply For Leave</h3>
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <textarea placeholder="Reason for leave..." value={reason} onChange={e=>setReason(e.target.value)} required rows="3"/>
          <input type="number" min="1" max="10" placeholder="Duration (Days)" value={duration} onChange={e=>setDuration(e.target.value)} required/>
          <button type="submit">Submit Request</button>
        </form>
      </div>

      <div className="card">
        <h3>My Leave Status</h3>
        {statusList.length === 0 ? <p>No requests found.</p> : (
          <table className="data-table">
            <thead>
              <tr><th>Reason</th><th>Duration</th><th>Status</th></tr>
            </thead>
            <tbody>
              {statusList.map(req => (
                <tr key={req._id}>
                  <td>{req.reason}</td>
                  <td>{req.duration} Days</td>
                  <td>
                    <span className={`status-badge status-${req.status.toLowerCase()}`}>{req.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AIAssistant({ role, studentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useStudyMaterial, setUseStudyMaterial] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');

  useEffect(() => {
    if (role === 'Student') {
      axios.get(`${API_BASE}/materials`).then(res => setMaterials(res.data));
    }
  }, [role]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if(!input.trim()) return;

    const newMsgs = [...messages, {role: 'user', content: input}];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      let endpoint = role === 'Teacher' ? '/chat/teacher' : '/chat/student';
      let payload = role === 'Teacher' ? { question: input } : { question: input, student_id: studentId };

      if (role === 'Student' && useStudyMaterial) {
        endpoint = '/ask-material-question';
        payload = { 
          question: input,
          material_id: selectedMaterial || undefined 
        };
      }

      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
      
      let replyResponse = {
        role: 'assistant',
        content: res.data.reply,
        sources: res.data.sources || [],
        details: res.data.source_details || []
      };

      setMessages([...newMsgs, replyResponse]);
    } catch(err) {
      setMessages([...newMsgs, {role: 'assistant', content: 'Connection Error.'}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page animate-fade-in" style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'}}>
        <h2>AI Assistant</h2>
        {role === 'Student' && (
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
              <input type="checkbox" checked={useStudyMaterial} onChange={(e) => setUseStudyMaterial(e.target.checked)} />
              Ask Questions From Study Materials
            </label>
            
            {useStudyMaterial && (
              <select 
                value={selectedMaterial} 
                onChange={e => setSelectedMaterial(e.target.value)}
                style={{padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '200px'}}
              >
                <option value="">Ask from all materials</option>
                {materials.map(m => (
                  <option key={m._id} value={m._id}>{m.title} ({m.subject})</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      <div className="card chat-container" style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: '1rem', padding: '0'}}>
        <div className="chat-messages" style={{flex: 1, overflowY: 'auto', padding: '1.5rem'}}>
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className="message-content">
                 <div style={{whiteSpace: 'pre-wrap'}}>{m.content}</div>
                 {m.sources && m.sources.length > 0 && (
                   <div className="sources-container" style={{marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem'}}>
                      <strong style={{color: 'var(--primary-color)'}}>Sources:</strong>
                      <ul style={{margin: '0.5rem 0', paddingLeft: '1.2rem'}}>
                        {m.sources.map((s, idx) => <li key={idx}>{s}</li>)}
                      </ul>
                      {m.details && (
                        <details style={{cursor: 'pointer'}}>
                          <summary style={{opacity: 0.7}}>View relevant chunks</summary>
                          <div style={{marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                            {m.details.map((d, idx) => (
                              <div key={idx} style={{padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px'}}>
                                <div style={{fontWeight: 'bold', marginBottom: '0.2rem'}}>{d.title}</div>
                                <div style={{fontStyle: 'italic', opacity: 0.8}}>{d.chunk}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                   </div>
                 )}
              </div>
            </div>
          ))}
          {loading && <div className="message assistant"><div className="message-content">Thinking...</div></div>}
        </div>
        <form onSubmit={sendMessage} style={{padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem'}}>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder={useStudyMaterial ? "Ask a doubt about study materials..." : "Ask a question..."} disabled={loading}/>
          <button type="submit" disabled={loading}>Send</button>
        </form>
      </div>
    </div>
  );
}

// --- Main Layout ---
function DashboardLayout({ auth, onLogout, justLoggedIn, setJustLoggedIn }) {
  const navigate = useNavigate();

  const handleNav = (path) => {
    setJustLoggedIn(false);
    navigate(path);
  }

  if (justLoggedIn) {
    return (
      <div className="success-overlay animate-fade-in">
        <div className="card" style={{textAlign: 'center', minWidth: '400px'}}>
          <h2>Login Successful</h2>
          <p style={{color: 'var(--success-color)', marginBottom: '2rem'}}>Welcome back, {auth.role}</p>
          <button onClick={() => { setJustLoggedIn(false); navigate('/menu'); }} style={{width: '100%'}}>
            Continue to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
           <h3>ERP System</h3>
        </div>
        <nav className="sidebar-nav">
          <a onClick={() => handleNav('/menu')}><icons.Menu size={20}/> Menu</a>
          
          {auth.role === 'Teacher' && (
            <>
              <a onClick={() => handleNav('/students')}><icons.Users size={20}/> Student Dashboard</a>
              <a onClick={() => handleNav('/attendance')}><icons.CheckSquare size={20}/> Attendance</a>
              <a onClick={() => handleNav('/marks')}><icons.BarChart2 size={20}/> Marks</a>
              <a onClick={() => handleNav('/leave')}><icons.Calendar size={20}/> Leave Management</a>
              <a onClick={() => handleNav('/study-materials')}><icons.BookOpen size={20}/> Study Materials</a>
            </>
          )}

          {auth.role === 'Student' && (
            <>
              <a onClick={() => handleNav('/my-attendance')}><icons.CheckSquare size={20}/> My Attendance</a>
              <a onClick={() => handleNav('/my-marks')}><icons.BarChart2 size={20}/> My Marks</a>
              <a onClick={() => handleNav('/my-leave')}><icons.Calendar size={20}/> Leave Management</a>
              <a onClick={() => handleNav('/my-materials')}><icons.BookOpen size={20}/> Study Materials</a>
            </>
          )}

          <a onClick={() => handleNav('/ai')}><icons.MessageSquare size={20}/> AI Assistant</a>
          
        </nav>
        <div className="sidebar-footer">
          <button onClick={onLogout} className="btn-logout"><icons.LogOut size={20}/> Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/menu" />} />
          <Route path="/menu" element={<MenuLanding role={auth.role} />} />
          
          {auth.role === 'Teacher' && (
            <>
              <Route path="/students" element={<StudentDashboard />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/marks" element={<MarksEntry />} />
              <Route path="/leave" element={<LeaveManagementTeacher />} />
              <Route path="/study-materials" element={<StudyMaterialsManagement />} />
            </>
          )}

          {auth.role === 'Student' && (
             <>
               <Route path="/my-attendance" element={<StudentAttendance studentId={auth.student_id} />} />
               <Route path="/my-marks" element={<StudentMarks studentId={auth.student_id} />} />
               <Route path="/my-leave" element={<StudentLeaveApply studentId={auth.student_id} />} />
               <Route path="/my-materials" element={<StudentStudyMaterials />} />
             </>
          )}

          <Route path="/ai" element={<AIAssistant role={auth.role} studentId={auth.student_id} />} />
          <Route path="*" element={<Navigate to="/menu" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('erp_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const handleLogin = (data) => {
    localStorage.setItem('erp_auth', JSON.stringify(data));
    setAuth(data);
    setJustLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('erp_auth');
    setAuth(null);
  };

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <DashboardLayout auth={auth} onLogout={handleLogout} justLoggedIn={justLoggedIn} setJustLoggedIn={setJustLoggedIn} />
    </Router>
  );
}
