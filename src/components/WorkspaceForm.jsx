import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth } from '../firebase';
import './WorkspaceForm.css'; // Import the new CSS file

const WorkspaceForm = ({ workspaceId, onClose, onSuccess }) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      if (workspaceId) {
        try {
          const docRef = doc(db, "workspaces", workspaceId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setWorkspaceName(data.name || '');
            setDescription(data.description || '');
          } else {
            setError("Workspace not found.");
          }
        } catch (err) {
          console.error("Error fetching workspace:", err);
          setError(err.message);
        }
      }
    };
    fetchWorkspaceData();
  }, [workspaceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!workspaceName.trim()) {
      setError("Workspace name cannot be empty.");
      return;
    }

    if (!description.trim()) {
      setError("Workspace description cannot be empty.");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("You must be logged in.");
        return;
      }

      if (workspaceId) {
        // Update existing workspace
        const workspaceRef = doc(db, "workspaces", workspaceId);
        await updateDoc(workspaceRef, {
          name: workspaceName,
          description: description,
          lastModified: serverTimestamp()
        });
        setSuccess("Workspace updated successfully!");
      } else {
        // Create new workspace
        await addDoc(collection(db, "workspaces"), {
          name: workspaceName,
          description: description, // Add description field
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
          members: [{
            uid: currentUser.uid,
            email: currentUser.email,
            role: 'admin' // Creator is automatically an admin of this workspace
          }],
          memberUids: [currentUser.uid] // New array for easier querying
        });
        setSuccess("Workspace created successfully!");
      }
      setWorkspaceName('');
      setDescription('');
      if (onSuccess) onSuccess();
      onClose(); // Close the form after successful creation/update
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="workspace-form-container">
      <h2 className="workspace-form-title">{workspaceId ? 'Edit Workspace' : 'Create New Workspace'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="workspace-form-group">
          <label htmlFor="workspaceName">Workspace Name</label>
          <input
            id="workspaceName"
            type="text"
            placeholder="Enter workspace name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />
        </div>
        <div className="workspace-form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            placeholder="Enter workspace description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          ></textarea>
        </div>
        <div className="workspace-form-actions">
          <button type="submit" className="workspace-form-submit">
            {workspaceId ? 'Update Workspace' : 'Create Workspace'}
          </button>
          <button type="button" onClick={onClose} className="workspace-form-cancel">
            Cancel
          </button>
        </div>
      </form>
      {error && <p className="workspace-form-error">{error}</p>}
      {success && <p className="workspace-form-success">{success}</p>}
    </div>
  );
};

export default WorkspaceForm; 