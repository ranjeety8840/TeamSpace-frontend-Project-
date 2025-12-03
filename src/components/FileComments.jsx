import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import './FileComments.css'; // Import the new CSS file

const FileComments = ({ workspaceId, documentId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!documentId) {
      setComments([]);
      return;
    }

    const commentsRef = collection(db, `workspaces/${workspaceId}/documents/${documentId}/comments`);
    const q = query(commentsRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = [];
      snapshot.forEach(doc => {
        fetchedComments.push({ id: doc.id, ...doc.data() });
      });
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [workspaceId, documentId]);

  const handleAddComment = async () => {
    if (!documentId) return;
    if (newComment.trim() === '' || !auth.currentUser) return;

    try {
      await addDoc(collection(db, `workspaces/${workspaceId}/documents/${documentId}/comments`), {
        text: newComment,
        createdBy: auth.currentUser.email,
        timestamp: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment.");
    }
  };

  if (!documentId) {
    return (
      <div className="file-comments-container">
        <h4 className="file-comments-title">Comments</h4>
        <p className="no-comments-message">Select a document to view and add comments.</p>
      </div>
    );
  }

  return (
    <div className="file-comments-container">
      <h4 className="file-comments-title">Comments</h4>
      <div className="comment-list-section">
        {comments.length === 0 ? (
          <p className="no-comments-message">No comments yet.</p>
        ) : (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-item">
                <span className="comment-author">{comment.createdBy}</span>
                <span className="comment-text">{comment.text}</span>
                <span className="comment-timestamp">
                  {comment.timestamp?.toDate().toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="comment-input-section">
        <input
          type="text"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button onClick={handleAddComment}>
          Post
        </button>
      </div>
    </div>
  );
};

export default FileComments; 