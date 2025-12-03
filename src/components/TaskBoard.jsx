import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import VideoConference from './VideoConference';
import './TaskBoard.css'; // Import the new CSS file

const TaskBoard = ({ workspaceId, currentUserRole }) => {
  const [tasks, setTasks] = useState([]);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [error, setError] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskDescription, setEditingTaskDescription] = useState('');
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' or 'video'

  useEffect(() => {
    if (!workspaceId) return;
    const q = query(
      collection(db, `workspaces/${workspaceId}/tasks`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = [];
      snapshot.forEach((doc) => {
        fetchedTasks.push({ id: doc.id, ...doc.data() });
      });
      setTasks(fetchedTasks);
    }, (err) => {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks.");
    });

    return () => unsubscribe();
  }, [workspaceId]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (currentUserRole === 'viewer') {
      alert('Viewers cannot add tasks.');
      return;
    }
    if (newTaskDescription.trim() === '') {
      alert("Task description cannot be empty.");
      return;
    }

    try {
      await addDoc(collection(db, `workspaces/${workspaceId}/tasks`), {
        description: newTaskDescription,
        dueDate: newTaskDueDate,
        createdAt: new Date(),
        createdBy: auth.currentUser.email,
        status: 'todo' // default status
      });
      setNewTaskDescription('');
      setNewTaskDueDate('');
    } catch (err) {
      console.error("Error adding task:", err);
      setError("Failed to add task.");
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    if (currentUserRole === 'viewer') {
      alert('Viewers cannot update task status.');
      return;
    }
    try {
      const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, taskId);
      await updateDoc(taskRef, { status: newStatus });
    } catch (err) {
      console.error("Error updating task status:", err);
      setError("Failed to update task status.");
    }
  };

  const handleEditTask = (task) => {
    if (currentUserRole === 'viewer') {
      alert('Viewers cannot edit tasks.');
      return;
    }
    setEditingTaskId(task.id);
    setEditingTaskDescription(task.description);
  };

  const handleSaveEditedTask = async (taskId) => {
    if (editingTaskDescription.trim() === '') {
      alert("Task description cannot be empty.");
      return;
    }
    try {
      const taskRef = doc(db, `workspaces/${workspaceId}/tasks`, taskId);
      await updateDoc(taskRef, { description: editingTaskDescription });
      setEditingTaskId(null);
      setEditingTaskDescription('');
    } catch (err) {
      console.error("Error saving task:", err);
      setError("Failed to save task.");
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTaskDescription('');
  };

  const handleDeleteTask = async (taskId) => {
    if (currentUserRole !== 'admin') {
      alert('Only admins can delete tasks.');
      return;
    }
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await deleteDoc(doc(db, `workspaces/${workspaceId}/tasks`, taskId));
      } catch (err) {
        console.error("Error deleting task:", err);
        setError("Failed to delete task.");
      }
    }
  };

  return (
    <div className="task-board-container">
      <div className="task-board-header">
        <h3 className="task-board-title">Task Management</h3>
        <div className="task-board-tabs">
          <button 
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button 
            className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            Video Call
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      {activeTab === 'video' && (
        <div className="video-section">
          <div className="video-section-header">
            <h4>Video Conference</h4>
            <button 
              className="video-call-button"
              onClick={() => setIsVideoCallActive(!isVideoCallActive)}
            >
              {isVideoCallActive ? 'End Call' : 'Start Call'}
            </button>
          </div>
          {isVideoCallActive && (
            <div className="video-conference-section">
              <VideoConference 
                workspaceId={workspaceId} 
                isActive={isVideoCallActive} 
                onClose={() => setIsVideoCallActive(false)} 
              />
            </div>
          )}
          {!isVideoCallActive && (
            <div className="video-placeholder">
              <p>Click "Start Call" to begin a video conference</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <>
          {currentUserRole !== 'viewer' && (
            <form onSubmit={handleAddTask} className="task-input-section">
              <input
                type="text"
                placeholder="Task Description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                required
              />
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
              />
              <button type="submit">
                Add Task
              </button>
            </form>
          )}

          <h4 className="section-title">Tasks Overview</h4>
          {tasks.length === 0 ? (
            <p className="no-tasks-message">No tasks for this workspace. Add one above!</p>
          ) : (
            <div className="task-columns">
              {['todo', 'in-progress', 'done'].map(status => (
                <div key={status} className="task-column">
                  <h5 className="task-column-title">{status.replace('-', ' ')}</h5>
                  {tasks.filter(task => task.status === status).length === 0 ? (
                    <p className="no-tasks-message">No tasks in this status.</p>
                  ) : (
                    <ul className="task-list">
                      {tasks.filter(task => task.status === status).map((task) => (
                        <li key={task.id} className="task-item">
                          {editingTaskId === task.id ? (
                            <div className="edit-task-section">
                              <input
                                type="text"
                                value={editingTaskDescription}
                                onChange={(e) => setEditingTaskDescription(e.target.value)}
                              />
                              <button onClick={() => handleSaveEditedTask(task.id)}>Save</button>
                              <button onClick={handleCancelEdit}>Cancel</button>
                            </div>
                          ) : (
                            <span className={`task-content ${task.status === 'done' ? 'completed' : ''}`}>
                              {task.description}
                              {task.dueDate && <span className="task-due-date"> (Due: {task.dueDate})</span>}
                              <span className="task-created-by">Assigned by: {task.createdBy}</span>
                            </span>
                          )}
                          <div className="task-actions">
                            {editingTaskId !== task.id && currentUserRole !== 'viewer' && (
                              <>
                                <select
                                  value={task.status}
                                  onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                >
                                  <option value="todo">To Do</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                                <button onClick={() => handleEditTask(task)} className="edit-button">
                                  Edit
                                </button>
                              </>
                            )}
                            {currentUserRole === 'admin' && editingTaskId !== task.id && (
                              <button onClick={() => handleDeleteTask(task.id)} className="delete-button">
                                Delete
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaskBoard; 