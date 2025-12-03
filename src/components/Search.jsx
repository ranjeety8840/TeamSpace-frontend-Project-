import React, { useState } from 'react';
import { db, rtdb } from '../firebase';
import { collection, query, getDocs } from "firebase/firestore";
import { ref as rtdbRef, get } from "firebase/database";
import './Search.css'; // Import the new CSS file

const Search = ({ workspaceId, onDocumentSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();

      // Search in Firestore for editable documents by title
      const firestoreDocsQuery = query(
        collection(db, `workspaces/${workspaceId}/documents`),
        // Firestore does not support case-insensitive contains search or regex
        // So we'll fetch all and filter client-side for titles that contain the term
      );
      const firestoreSnapshot = await getDocs(firestoreDocsQuery);
      const matchingFirestoreDocs = firestoreSnapshot.docs.filter(doc => 
        doc.data().title.toLowerCase().includes(lowerCaseSearchTerm)
      ).map(doc => ({ id: doc.id, type: 'document', ...doc.data() }));

      // Search in Realtime Database for uploaded files by name
      const rtdbFilesRef = rtdbRef(rtdb, `workspaces/${workspaceId}/files`);
      const rtdbSnapshot = await get(rtdbFilesRef);
      const matchingRtdbFiles = [];
      if (rtdbSnapshot.exists()) {
        const data = rtdbSnapshot.val();
        for (let key in data) {
          if (data[key].name && data[key].name.toLowerCase().includes(lowerCaseSearchTerm)) {
            matchingRtdbFiles.push({ id: key, type: 'file', ...data[key] });
          }
        }
      }

      setSearchResults([...matchingFirestoreDocs, ...matchingRtdbFiles]);

    } catch (err) {
      console.error("Error during search:", err);
      setError("Failed to perform search.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-container">
      <h4 className="search-title">Search Documents and Files</h4>
      <div className="search-input-group">
        <input
          type="text"
          placeholder="Search by title or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button 
          onClick={handleSearch} 
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}

      {searchResults.length > 0 && (
        <div className="search-results-section">
          <h5 className="section-title">Search Results:</h5>
          <ul className="search-results-list">
            {searchResults.map((item) => (
              <li key={item.id} className="search-result-item">
                {item.type === 'document' ? (
                  <span className="result-title" onClick={() => onDocumentSelect(item.id, item.title, item.content)}>
                    Document: {item.title}
                  </span>
                ) : (
                  <span className="result-title" onClick={() => alert("File download not directly supported from search results yet. Go to 'Uploaded Files' section.")}>
                    File: {item.name}
                  </span>
                )}
                <span className="result-type">({item.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {searchTerm && searchResults.length === 0 && !loading && !error && (
        <p className="no-results-message">No results found for "{searchTerm}".</p>
      )}
    </div>
  );
};

export default Search; 