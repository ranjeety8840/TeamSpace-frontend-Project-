import React, { useState, useEffect } from 'react';
import { db, rtdb, auth } from '../firebase';
import { collection, getDocs, query, where } from "firebase/firestore";
import { ref as rtdbRef, get } from "firebase/database";
import './AnalyticsDashboard.css'; // Import the new CSS file

const AnalyticsDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState({
    totalWorkspaces: 0,
    totalEditableDocuments: 0,
    totalUploadedFiles: 0,
    totalTasks: 0,
    totalCompletedTasks: 0,
    totalOpenTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        setError("Please sign in to view analytics");
        setLoading(false);
        return;
      }

      try {
        const workspacesQuery = query(
          collection(db, "workspaces"),
          where("memberUids", "array-contains", auth.currentUser.uid)
        );
        const workspacesSnapshot = await getDocs(workspacesQuery);
        const totalWorkspaces = workspacesSnapshot.size;

        // Fetch total editable documents and tasks (from Firestore subcollections)
        let totalEditableDocuments = 0;
        let totalTasks = 0;
        let totalCompletedTasks = 0;
        let totalOpenTasks = 0;

        for (const workspaceDoc of workspacesSnapshot.docs) {
          // Documents
          const documentsSnapshot = await getDocs(collection(db, `workspaces/${workspaceDoc.id}/documents`));
          totalEditableDocuments += documentsSnapshot.size;

          // Tasks
          const tasksSnapshot = await getDocs(collection(db, `workspaces/${workspaceDoc.id}/tasks`));
          totalTasks += tasksSnapshot.size;
          tasksSnapshot.forEach(taskDoc => {
            // Assuming a 'completed' field in tasks, adjust if your task schema differs
            if (taskDoc.data().status === 'done') { 
              totalCompletedTasks++;
            } else {
              totalOpenTasks++;
            }
          });
        }

        // Fetch total uploaded files (from Realtime Database)
        let totalUploadedFiles = 0;
        const rtdbRootRef = rtdbRef(rtdb, 'workspaces');
        const rtdbSnapshot = await get(rtdbRootRef);
        if (rtdbSnapshot.exists()) {
          const workspacesData = rtdbSnapshot.val();
          // Only count files from workspaces the user has access to
          for (const workspaceDoc of workspacesSnapshot.docs) {
            const workspaceId = workspaceDoc.id;
            if (workspacesData[workspaceId]?.files) {
              totalUploadedFiles += Object.keys(workspacesData[workspaceId].files).length;
            }
          }
        }

        setAnalyticsData({
          totalWorkspaces,
          totalEditableDocuments,
          totalUploadedFiles,
          totalTasks,
          totalCompletedTasks,
          totalOpenTasks,
        });
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="loading-message">Loading analytics...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="analytics-dashboard-container">
      <h3 className="analytics-title">Analytics Dashboard</h3>
      <div className="metrics-grid">
        <div className="metric-card">
          <h4>Total Workspaces</h4>
          <p>{analyticsData.totalWorkspaces}</p>
        </div>
        <div className="metric-card">
          <h4>Total Editable Documents</h4>
          <p>{analyticsData.totalEditableDocuments}</p>
        </div>
        <div className="metric-card">
          <h4>Total Uploaded Files</h4>
          <p>{analyticsData.totalUploadedFiles}</p>
        </div>
        <div className="metric-card">
          <h4>Total Tasks</h4>
          <p>{analyticsData.totalTasks}</p>
        </div>
        <div className="metric-card">
          <h4>Completed Tasks</h4>
          <p>{analyticsData.totalCompletedTasks}</p>
        </div>
        <div className="metric-card">
          <h4>Open Tasks</h4>
          <p>{analyticsData.totalOpenTasks}</p>
        </div>
      </div>
      {analyticsData.totalWorkspaces === 0 && (
        <p className="no-data-message">No data available. Create workspaces and add content to see analytics.</p>
      )}
    </div>
  );
};

export default AnalyticsDashboard; 