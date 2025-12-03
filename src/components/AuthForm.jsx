import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from "firebase/firestore";
import './AuthForm.css'; // Import the new CSS file

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('member'); // Default role
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Store user role in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email,
          role: role,
        });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      // For Google sign-in, we can default to 'member' or prompt for role after sign-in
      // For now, let's assume 'member' for simplicity, or we can prompt later
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: userCredential.user.email,
        role: 'member', // Default role for Google sign-in
      }, { merge: true }); // Use merge: true to avoid overwriting if user already exists
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">
          {isLogin ? 'Login' : 'Register'}
        </h2>
        <form onSubmit={handleAuth}>
          <div className="auth-input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <div className="auth-input-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          )}
          <button type="submit" className="auth-button">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <button
          onClick={handleGoogleSignIn}
          className="auth-button google-auth-button"
        >
          <span>Sign in with Google</span>
        </button>
        <p className="auth-text">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <span
            onClick={() => setIsLogin(!isLogin)}
            className="auth-toggle-button"
          >
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </p>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
};

export default AuthForm; 