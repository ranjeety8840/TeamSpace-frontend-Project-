import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auth, db, rtdb } from '../firebase';
import { collection, doc, getDoc, serverTimestamp, updateDoc, onSnapshot, setDoc, addDoc, query, getDocs, where } from "firebase/firestore";
import { ref as rtdbRef, set, push, onValue, remove, onDisconnect } from "firebase/database";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import Chat from './Chat';
import TaskBoard from './TaskBoard';
import FileComments from './FileComments';
import Search from './Search';
import './WorkspaceDetail.css';

const WorkspaceDetail = () => {
  console.log('WorkspaceDetail: Component is rendering.');
  const { workspaceId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editableDocuments, setEditableDocuments] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState('');
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addMemberMessage, setAddMemberMessage] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [activeSection, setActiveSection] = useState('documents'); // Default to documents section
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [events, setEvents] = useState([]); // State to store events
  const [usersStatus, setUsersStatus] = useState({}); // New state for user presence
  const [activeUsersCount, setActiveUsersCount] = useState(0); // New state for active users count
  const [inactiveUsersCount, setInactiveUsersCount] = useState(0); // New state for inactive users count

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const docRef = doc(db, "workspaces", workspaceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWorkspace(data);

          // Determine the current user's role
          if (auth.currentUser && data.members) {
            const userMember = data.members.find(m => m.uid === auth.currentUser.uid);
            setCurrentUserRole(userMember ? userMember.role : null);
          }
        } else {
          setError("Workspace not found.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  // Effect for Realtime Database Presence System
  useEffect(() => {
    if (auth.currentUser && workspaceId) {
      const userStatusRef = rtdbRef(rtdb, `workspaces/${workspaceId}/presence/${auth.currentUser.uid}`);

      // Set user status to online when connected
      set(userStatusRef, { email: auth.currentUser.email, status: 'online', last_changed: Date.now() });

      // Set user status to offline when disconnected
      onDisconnect(userStatusRef).set({ email: auth.currentUser.email, status: 'offline', last_changed: Date.now() });

      // Listen for changes in presence data for all users in this workspace
      const presenceRef = rtdbRef(rtdb, `workspaces/${workspaceId}/presence`);
      const unsubscribePresence = onValue(presenceRef, (snapshot) => {
        const statuses = {};
        snapshot.forEach((childSnapshot) => {
          statuses[childSnapshot.key] = childSnapshot.val();
        });
        setUsersStatus(statuses);
      });

      // Cleanup: Set user status to offline on unmount or dependency change
      return () => {
        if (auth.currentUser) {
          set(userStatusRef, { email: auth.currentUser.email, status: 'offline', last_changed: Date.now() });
        }
        unsubscribePresence();
      };
    }
  }, [auth.currentUser, workspaceId]);

  // Effect to calculate active and inactive users
  useEffect(() => {
    if (workspace && usersStatus) {
      console.log('WorkspaceDetail: Initializing active/inactive user calculation');
      console.log('WorkspaceDetail: Current workspace members:', workspace.members);
      console.log('WorkspaceDetail: Current user statuses (from RTDB):', usersStatus);

      let active = 0;
      let inactive = 0;

      // Ensure workspace.members is an array before processing
      const currentWorkspaceMembers = Array.isArray(workspace.members) ? workspace.members : [];

      // First, count all members as inactive by default
      inactive = currentWorkspaceMembers.length;

      // Then, for each member that is online, increment active and decrement inactive
      Object.entries(usersStatus).forEach(([uid, status]) => {
        // Check if this user is a member of the workspace
        const isWorkspaceMember = currentWorkspaceMembers.some(member => member.uid === uid);
        
        if (isWorkspaceMember) {
          console.log(`WorkspaceDetail: Processing member UID: ${uid}, Status: ${status.status}`);
          if (status.status === 'online') {
            active++;
            inactive--; // Decrement inactive if the user is online
            console.log(`WorkspaceDetail: ${uid} is ONLINE. Active count: ${active}, Inactive count: ${inactive}`);
          }
        }
      });

      setActiveUsersCount(active);
      setInactiveUsersCount(inactive);
      console.log('WorkspaceDetail: Final Active Users:', active, 'Final Inactive Users:', inactive);
    }
  }, [workspace, usersStatus]);

  useEffect(() => {
    if (workspaceId) {
      // Fetch editable documents
      const documentsRef = collection(db, `workspaces/${workspaceId}/documents`);
      const unsubscribe = onSnapshot(documentsRef, (snapshot) => {
        const docs = [];
        snapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        setEditableDocuments(docs);
      });

      return () => unsubscribe();
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      // Fetch uploaded files
      const filesRef = rtdbRef(rtdb, `workspaces/${workspaceId}/files`);
      const unsubscribe = onValue(filesRef, (snapshot) => {
        const files = [];
        snapshot.forEach((childSnapshot) => {
          files.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        setUploadedFiles(files);
      });

      return () => unsubscribe();
    }
  }, [workspaceId]);

  useEffect(() => {
    if (editingDocument) {
      // Fetch document content
      const docRef = doc(db, `workspaces/${workspaceId}/documents`, editingDocument.id);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setDocumentContent(docSnap.data().content || '');
        }
      });

      return () => unsubscribe();
    }
  }, [editingDocument, workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      // Fetch events
      const eventsRef = collection(db, `workspaces/${workspaceId}/events`);
      const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
        const fetchedEvents = [];
        snapshot.forEach((doc) => {
          fetchedEvents.push({ id: doc.id, ...doc.data() });
        });
        setEvents(fetchedEvents);
      });

      return () => unsubscribe();
    }
  }, [workspaceId]);

  const handleNewDocument = async () => {
    if (!newDocumentTitle.trim()) {
      alert("Document title cannot be empty.");
      return;
    }
    try {
      const newDocRef = doc(collection(db, `workspaces/${workspaceId}/documents`));
      await setDoc(newDocRef, {
        title: newDocumentTitle,
        content: '',
        createdBy: auth.currentUser.email,
        createdAt: serverTimestamp()
      });
      setNewDocumentTitle('');
      setEditingDocument({ id: newDocRef.id, title: newDocumentTitle, content: '' });
    } catch (err) {
      console.error("Error creating new document:", err);
      setError(err.message);
    }
  };

  const handleDocumentChange = async (content) => {
    if (!editingDocument) return;

    setDocumentContent(content);
    try {
      const docRef = doc(db, `workspaces/${workspaceId}/documents`, editingDocument.id);
      await updateDoc(docRef, { 
        content: content, 
        lastModified: serverTimestamp() 
      });
    } catch (err) {
      console.error("Error updating document:", err);
    }
  };

  const handleDeleteEditableDocument = async (docId) => {
    if (currentUserRole !== 'admin') {
      alert('Only admins can delete documents.');
      return;
    }
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        const docRef = doc(db, `workspaces/${workspaceId}/documents`, docId);
        await updateDoc(docRef, { deleted: true });
        if (editingDocument && editingDocument.id === docId) {
          setEditingDocument(null);
        }
      } catch (err) {
        console.error("Error deleting document:", err);
        alert("Failed to delete document.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Data = reader.result;
        const newFileRef = push(rtdbRef(rtdb, `workspaces/${workspaceId}/files`));
        await set(newFileRef, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
          uploadedBy: auth.currentUser.email,
          uploadedAt: new Date().toISOString()
        });
        setFile(null);
      };
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) return;
    
    try {
      const workspaceRef = doc(db, "workspaces", workspaceId);
      const docSnap = await getDoc(workspaceRef);
      if (!docSnap.exists()) {
        setAddMemberMessage('Error: Workspace not found.');
        return;
      }
      let currentWorkspaceData = docSnap.data();
      let existingMembers = currentWorkspaceData.members || [];
      let existingMemberUids = currentWorkspaceData.memberUids || [];

      // Check if member already exists in the workspace to prevent duplicates
      if (existingMembers.some(m => m.email === memberEmail)) {
        setAddMemberMessage('This user is already a member of this workspace.');
        return;
      }

      let newMemberUid = null;
      // Try to find the user's UID from the 'users' collection if they are already registered
      const usersQuery = query(collection(db, "users"), where("email", "==", memberEmail));
      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        // Assuming unique emails, take the first user found
        newMemberUid = usersSnapshot.docs[0].id; // The doc.id is the UID
        console.log(`Found existing user for ${memberEmail} with UID: ${newMemberUid}`);
      } else {
        console.log(`User with email ${memberEmail} not found in 'users' collection. Adding with null UID.`);
        setAddMemberMessage('Member added. Note: User must register to see the workspace.');
      }

      const newMember = { email: memberEmail, role: 'member', uid: newMemberUid };
      const updatedMembers = [...existingMembers, newMember];
      
      // Add the newMemberUid to updatedMemberUids if it's not null and not already present
      if (newMemberUid && !existingMemberUids.includes(newMemberUid)) {
        existingMemberUids.push(newMemberUid);
      }
      const updatedMemberUids = existingMemberUids;

      await updateDoc(workspaceRef, {
        members: updatedMembers,
        memberUids: updatedMemberUids
      });
      setMemberEmail('');
      setAddMemberMessage(newMemberUid ? 'Member added successfully.' : 'Member added. User needs to register to see the workspace.');
    } catch (err) {
      setAddMemberMessage('Error adding member: ' + err.message);
      console.error("Error adding member:", err);
    }
  };

  const handleDownload = (file) => {
    if (!file.data) {
      alert("No data available for download.");
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error during download:", err);
      alert("Failed to download file.");
    }
  };

  const handleDeleteUploadedFile = async (fileId) => {
    if (currentUserRole !== 'admin') {
      alert('Only admins can delete files.');
      return;
    }
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        const fileRef = rtdbRef(rtdb, `workspaces/${workspaceId}/files/${fileId}`);
        await remove(fileRef);
        alert("File deleted successfully!");
      } catch (err) {
        console.error("Error deleting file:", err);
        alert("Failed to delete file.");
      }
    }
  };

  const handleOpenDocumentFromSearch = (docId, docTitle, docContent) => {
    setEditingDocument({ id: docId, title: docTitle, content: docContent });
  };

  const handleUpdateMemberRole = async (memberUid, newRole) => {
    if (currentUserRole !== 'admin') {
      alert('Only admins can change member roles.');
      return;
    }
    try {
      const workspaceRef = doc(db, "workspaces", workspaceId);
      const updatedMembers = workspace.members.map(member =>
        member.uid === memberUid ? { ...member, role: newRole } : member
      );
      await updateDoc(workspaceRef, { members: updatedMembers });
      alert('Member role updated successfully!');
    } catch (err) {
      console.error("Error updating member role:", err);
      alert('Failed to update member role.');
    }
  };

  const handleRemoveMember = async (memberUidToRemove) => {
    if (currentUserRole !== 'admin') {
      alert('Only admins can remove members.');
      return;
    }
    if (window.confirm("Are you sure you want to remove this member from the workspace?")) {
      try {
        const workspaceRef = doc(db, "workspaces", workspaceId);
        const updatedMembers = workspace.members.filter(member => member.uid !== memberUidToRemove);
        await updateDoc(workspaceRef, { members: updatedMembers });
        alert('Member removed successfully!');
      } catch (err) {
        console.error("Error removing member:\n", err);
        alert('Failed to remove member.');
      }
    }
  };

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate.trim() || !newEventTime.trim()) {
      alert("Event title, date, and time cannot be empty.");
      return;
    }

    try {
      await addDoc(collection(db, `workspaces/${workspaceId}/events`), {
        title: newEventTitle,
        date: newEventDate,
        time: newEventTime,
        description: newEventDescription,
        createdBy: auth.currentUser.email,
        createdAt: serverTimestamp()
      });
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventDescription('');
      alert("Event created successfully!");
    } catch (err) {
      console.error("Error creating event:", err);
      alert(`Failed to create event: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading workspace...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!workspace) {
    return <div className="no-content-message">Workspace data not available.</div>;
  }

  return (
    <div className="workspace-detail-container">
      <header className="workspace-detail-header">
        <h1>{workspace.name}</h1>
        <nav className="workspace-detail-nav">
          <Link to="/dashboard"><button>Back to Dashboard</button></Link>
        </nav>
      </header>

      <main className="workspace-detail-content">
        <aside className="left-sidebar">
          <nav className="section-nav">
            <button 
              className={activeSection === 'documents' ? 'active' : ''} 
              onClick={() => setActiveSection('documents')}
            >
              Documents
            </button>
            <button 
              className={activeSection === 'chat' ? 'active' : ''} 
              onClick={() => setActiveSection('chat')}
            >
              Chat
            </button>
            <button 
              className={activeSection === 'tasks' ? 'active' : ''} 
              onClick={() => setActiveSection('tasks')}
            >
              Tasks
            </button>
            <button 
              className={activeSection === 'calendar' ? 'active' : ''} 
              onClick={() => setActiveSection('calendar')}
            >
              Calendar
            </button>
          </nav>
        </aside>

        <div className="main-content-area">
          {activeSection === 'documents' && (
            <div className="section-content">
              <div className="section-card document-management-section">
                <h2 className="section-title">Documents</h2>
                {currentUserRole !== 'viewer' && (
                  <div className="document-actions">
                    <input
                      type="text"
                      placeholder="New document title"
                      value={newDocumentTitle}
                      onChange={(e) => setNewDocumentTitle(e.target.value)}
                    />
                    <button onClick={handleNewDocument}>Create New Document</button>
                  </div>
                )}
                {editableDocuments.length === 0 ? (
                  <p className="no-content-message">No documents created yet.</p>
                ) : (
                  <div className="document-list">
                    <ul>
                      {editableDocuments.map((doc) => (
                        <li key={doc.id}>
                          <span className="document-item-title" onClick={() => setEditingDocument(doc)}>{doc.title}</span>
                          <div className="document-item-actions">
                            <button onClick={() => setEditingDocument(doc)}>Edit</button>
                            {currentUserRole === 'admin' && (
                              <button onClick={() => handleDeleteEditableDocument(doc.id)} className="delete-button">Delete</button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {editingDocument && ((currentUserRole === 'admin' || currentUserRole === 'member') ? (
                  <div className="document-editor-area">
                    <h3>Editing: {editingDocument.title}</h3>
                    <ReactQuill theme="snow" value={documentContent} onChange={handleDocumentChange} />
                    <button onClick={() => setShowVersionHistory(!showVersionHistory)} className="version-history-toggle">
                      {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
                    </button>
                    {showVersionHistory && (
                      <div className="version-history-list">
                        <h4>Version History</h4>
                        <ul>
                          {/* Placeholder for version history */}
                        </ul>
                      </div>
                    )}
                    <button onClick={() => setEditingDocument(null)} className="document-actions cancel-button">Close Editor</button>
                  </div>
                ) : (
                  <p className="error-message">You do not have permission to edit this document.</p>
                ))}
              </div>

              <div className="section-card file-upload-section">
                <h2 className="section-title">Files</h2>
                {currentUserRole !== 'viewer' && (
                  <div className="document-actions">
                    <input type="file" onChange={handleFileChange} className="file-upload-input" />
                    <button onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                    {uploadError && <p className="error-message">Upload Error: {uploadError}</p>}
                  </div>
                )}
                {uploadedFiles.length === 0 ? (
                  <p className="no-content-message">No files uploaded yet.</p>
                ) : (
                  <div className="file-list">
                    <ul>
                      {uploadedFiles.map((file) => (
                        <li key={file.id}>
                          <span className="file-item-name">{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                          <div className="file-item-actions">
                            <button onClick={() => handleDownload(file)}>Download</button>
                            {currentUserRole === 'admin' && (
                              <button onClick={() => handleDeleteUploadedFile(file.id)} className="delete-button">Delete</button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="section-card">
                <FileComments workspaceId={workspaceId} documentId={editingDocument?.id} />
              </div>
              
              <div className="section-card">
                <Search workspaceId={workspaceId} onOpenDocument={handleOpenDocumentFromSearch} />
              </div>
            </div>
          )}

          {/* Chat Section */}
          {activeSection === 'chat' && (
            <div className="section-content">
              <div className="section-card">
                <Chat workspaceId={workspaceId} currentUser={auth.currentUser} />
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {activeSection === 'tasks' && (
            <div className="section-content">
              <div className="section-card">
                <TaskBoard workspaceId={workspaceId} currentUserRole={currentUserRole} />
              </div>
            </div>
          )}

          {/* Calendar Section */}
          {activeSection === 'calendar' && (
            <div className="section-content">
              <div className="section-card">
                <h2 className="section-title">Calendar & Events</h2>
                <div className="event-creation-form">
                  <input
                    type="text"
                    placeholder="Event Title"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                  />
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                  />
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                  />
                  <textarea
                    placeholder="Event Description (optional)"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                  ></textarea>
                  <button onClick={handleAddEvent}>Create Event</button>
                </div>
                <div className="event-list">
                  <h3>Upcoming Events</h3>
                  {events.length === 0 ? (
                    <p className="no-content-message">No events scheduled yet. Create one!</p>
                  ) : (
                    <ul>
                      {events.map((event) => (
                        <li key={event.id}>
                          <h4>{event.title}</h4>
                          <p>Date: {event.date} at {event.time}</p>
                          {event.description && <p>Description: {event.description}</p>}
                          <p>Created by: {event.createdBy} on {new Date(event.createdAt?.toDate()).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="right-sidebar-area">
          {/* Member Management Section - Always visible */}
          <div className="section-card member-management-section">
            <h2 className="section-title">Members</h2>
            {currentUserRole === 'admin' && (
              <div className="document-actions">
                <input
                  type="email"
                  placeholder="Add member by email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <button onClick={handleAddMember}>Add Member</button>
              </div>
            )}
            {addMemberMessage && <p className="info-message">{addMemberMessage}</p>}

            {workspace.members && workspace.members.length > 0 ? (
              <div className="member-list">
                <ul>
                  {workspace.members.map((member) => (
                    <li key={member?.uid || member?.email || `member-${Math.random()}`}>
                      <div className="member-info">
                        <span className="member-email">{member.email}</span>
                        <span className="member-role">Role: {member.role}</span>
                      </div>
                      <span className={`member-status ${usersStatus[member.uid]?.status === 'online' ? 'online' : 'offline'}`}>
                        <span className={`member-status-dot ${usersStatus[member.uid]?.status === 'online' ? 'online' : 'offline'}`}></span>
                        {usersStatus[member.uid]?.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                      {currentUserRole === 'admin' && member.uid !== auth.currentUser.uid && (
                        <div className="member-actions">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.uid, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button onClick={() => handleRemoveMember(member.uid)} className="remove-button">Remove</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="no-content-message">No members in this workspace yet.</p>
            )}
            {/* Display Active/Inactive Users Count */}
            {workspace && workspace.members && workspace.members.length > 0 && (
              <div className="member-summary">
                <p>Active Users: <span className="active-count">{activeUsersCount}</span></p>
                <p>Inactive Users: <span className="inactive-count">{inactiveUsersCount}</span></p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default WorkspaceDetail; 