import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './index.css'; // Import global styles
import AuthForm from './components/AuthForm';
import WorkspaceForm from './components/WorkspaceForm';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Chat from './components/Chat';
import TaskBoard from './components/TaskBoard';
import FileComments from './components/FileComments';
import Search from './components/Search';
import VideoConference from './components/VideoConference';
import WorkspaceDetail from './components/WorkspaceDetail';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './components/Dashboard.css'; // Import Dashboard specific styles
import './components/WorkspaceDetail.css'; // Import WorkspaceDetail specific styles

const Home = () => {
  return (
    <div className="auth-container">
      <AuthForm />
    </div>
  );
};

const Dashboard = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null); // State for current user's role
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null); // New state for editing
  const navigate = useNavigate();
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    const fetchWorkspacesAndRole = async () => {
      setLoading(true);
      setError(null);
      if (auth.currentUser) {
        // Fetch user's role
        const userProfileRef = doc(db, "users", auth.currentUser.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          setCurrentUserRole(userProfileSnap.data().role);
        }

        const q = query(collection(db, "workspaces"), where("memberUids", "array-contains", auth.currentUser.uid));
        unsubscribeRef.current = onSnapshot(q, (querySnapshot) => {
          const fetchedWorkspaces = [];
          querySnapshot.forEach((doc) => {
            fetchedWorkspaces.push({ id: doc.id, ...doc.data() });
          });
          setWorkspaces(fetchedWorkspaces);
          setLoading(false);
        }, (err) => {
          console.error("Error fetching workspaces:", err);
          setError(err.message);
          setLoading(false);
        });
      } else {
        setLoading(false);
        setError("User not logged in.");
      }
    };

    fetchWorkspacesAndRole();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [auth.currentUser]);

  const handleLogout = async () => {
    try {
      // Clean up any active listeners
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      // Clear all state
      setWorkspaces([]);
      setLoading(true);
      setError(null);
      setShowWorkspaceForm(false);
      setShowAnalytics(false);
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Navigate to home page
      navigate('/');
    } catch (err) {
      console.error("Error logging out:", err);
      setError("Failed to log out. Please try again.");
    }
  };

  const handleDeleteWorkspace = async (workspaceId, workspaceName) => {
    if (!window.confirm(`Are you sure you want to delete the workspace "${workspaceName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "workspaces", workspaceId));
      // setWorkspaces(prevWorkspaces => prevWorkspaces.filter(ws => ws.id !== workspaceId)); // OnSnapshot will handle this
      alert(`Workspace "${workspaceName}" deleted successfully.`);
    } catch (err) {
      console.error("Error deleting workspace:", err);
      alert(`Error deleting workspace: ${err.message}`);
    }
  };

  const handleEditClick = (workspaceId) => {
    setEditingWorkspaceId(workspaceId);
    setShowWorkspaceForm(true);
    setShowAnalytics(false);
  };

  const handleCloseForm = () => {
    setShowWorkspaceForm(false);
    setEditingWorkspaceId(null);
  };

  if (loading) {
    return <div className="loading-message">Loading workspaces...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>TeamSpace Dashboard</h1>
        <nav className="dashboard-nav">
          <button onClick={() => {
            setShowWorkspaceForm(false);
            setShowAnalytics(false);
            setEditingWorkspaceId(null);
          }}>Dashboard</button>
          <button onClick={() => {
            setShowWorkspaceForm(true);
            setShowAnalytics(false);
            setEditingWorkspaceId(null);
          }}>Create Workspace</button>
          <button onClick={() => {
            setShowAnalytics(true);
            setShowWorkspaceForm(false);
            setEditingWorkspaceId(null);
          }}>Analytics</button>
          <button onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main className="dashboard-content">
        {(showWorkspaceForm || editingWorkspaceId) && (
          <div className="card">
            <h2 className="section-title">{editingWorkspaceId ? 'Edit Workspace' : 'Create New Workspace'}</h2>
            <WorkspaceForm 
              workspaceId={editingWorkspaceId} 
              onClose={handleCloseForm} 
              onSuccess={handleCloseForm}
            />
          </div>
        )}

        {showAnalytics && (
          <div className="card">
            <AnalyticsDashboard />
          </div>
        )}

        {!showWorkspaceForm && !showAnalytics && !editingWorkspaceId && (
          <div className="workspaces-section">
            <h2 className="section-title">Your Workspaces</h2>
            {workspaces.length === 0 ? (
              <p className="no-workspaces">No workspaces found. Create one to get started!</p>
            ) : (
              <div className="workspaces-grid">
                {workspaces.map((workspace) => (
                  <div key={workspace.id} className="workspace-card">
                    <h3>{workspace.name}</h3>
                    <p>{workspace.description}</p>
                    <div className="workspace-card-actions">
                      <Link to={`/workspace/${workspace.id}`} className="workspace-card-link">View Workspace</Link>
                      {currentUserRole === 'admin' && (
                        <div className="workspace-admin-actions">
                          <button onClick={() => handleEditClick(workspace.id)} className="edit-button">Edit</button>
                          <button 
                            onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)} 
                            className="delete-button"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspace/:workspaceId" element={<WorkspaceDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
