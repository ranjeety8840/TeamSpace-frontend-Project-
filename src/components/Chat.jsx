import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import './Chat.css';

const Chat = ({ workspaceId, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, `workspaces/${workspaceId}/messages`),
      orderBy('createdAt')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() });
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const { uid, email } = currentUser;

    try {
      await addDoc(collection(db, `workspaces/${workspaceId}/messages`), {
        text: newMessage,
        createdAt: serverTimestamp(),
        uid,
        email,
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error sending message.");
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">Integrated Chat</div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.uid === currentUser.uid ? 'sent' : 'received'}`}
          >
            <span className="message-sender">{msg.email}:</span>
            <span className="message-content">{msg.text}</span>
            <span className="message-timestamp">
              {msg.createdAt?.toDate().toLocaleString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input-area">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit">
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat; 