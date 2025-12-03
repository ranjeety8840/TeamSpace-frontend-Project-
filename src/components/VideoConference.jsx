import React, { useState, useEffect, useRef } from 'react';
import { rtdb, auth } from '../firebase';
import { ref as rtdbRef, onValue, set, remove, get } from 'firebase/database';
import SimplePeer from 'simple-peer/simplepeer.min.js';
import './VideoConference.css'; // Import the new CSS file

const VideoConference = ({ workspaceId, isActive, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef();
  const peersRef = useRef({});

  useEffect(() => {
    if (!isActive) {
      // Cleanup when component is hidden
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      peersRef.current = {};
      setPeers({});
      setIsJoined(false);
      // Ensure user is removed from RTDB when call ends or component is hidden
      if (auth.currentUser) {
        remove(rtdbRef(rtdb, `workspaces/${workspaceId}/videoRoom/${auth.currentUser.uid}`));
      }
      return;
    }

    // Initialize local stream
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // Automatically join the room when stream is ready
        handleJoinRoom();
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setError("Failed to access camera and microphone. Please check your permissions.");
      }
    };

    initializeMedia();

    return () => {
      // Cleanup: stop all tracks and remove all peers
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      // Ensure user is removed from RTDB when component unmounts unexpectedly
      if (auth.currentUser) {
        remove(rtdbRef(rtdb, `workspaces/${workspaceId}/videoRoom/${auth.currentUser.uid}`));
      }
    };
  }, [isActive, workspaceId]); // Added workspaceId to dependencies

  useEffect(() => {
    if (!isJoined || !localStream) return; // Keep isJoined check for RTDB listeners

    const roomRef = rtdbRef(rtdb, `workspaces/${workspaceId}/videoRoom`);

    // Listen for new users joining
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      const users = snapshot.val() || {};
      const userIds = Object.keys(users);

      // Remove peers that are no longer in the room
      Object.keys(peersRef.current).forEach(peerId => {
        if (!userIds.includes(peerId) && peersRef.current[peerId]) {
          peersRef.current[peerId].destroy();
          delete peersRef.current[peerId];
        }
      });

      // Create new peer connections for new users
      userIds.forEach(userId => {
        if (userId !== auth.currentUser.uid && !peersRef.current[userId]) {
          const peer = createPeer(userId, localStream);
          peersRef.current[userId] = peer;
        }
      });
    });

    // Set up signaling
    const handleSignal = (data) => {
      const { signal, from } = data;
      if (from === auth.currentUser.uid) return;

      if (peersRef.current[from]) {
        peersRef.current[from].signal(signal);
      } else {
        const peer = createPeer(from, localStream, true);
        peersRef.current[from] = peer;
        peer.signal(signal);
      }
    };

    const signalsRef = rtdbRef(rtdb, `workspaces/${workspaceId}/signals`);
    const unsubscribeSignals = onValue(signalsRef, (snapshot) => {
      const signals = snapshot.val() || {};
      // Process only new signals, clear old ones to avoid re-processing
      Object.keys(signals).forEach(signalKey => {
        const signalData = signals[signalKey];
        handleSignal(signalData);
        // Optionally, remove the signal after processing if it's a one-time signal
        // remove(rtdbRef(rtdb, `workspaces/${workspaceId}/signals/${signalKey}`));
      });
    });

    // Cleanup function
    return () => {
      unsubscribeRoom();
      unsubscribeSignals();
      // User will be removed from RTDB by the main useEffect cleanup
    };
  }, [isJoined, localStream, workspaceId]);

  const createPeer = (userId, stream, initiator = false) => {
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: false
    });

    peer.on('signal', signal => {
      // Only send signal if the other user is still in the room
      get(rtdbRef(rtdb, `workspaces/${workspaceId}/videoRoom/${userId}`)).then(snapshot => {
        if (snapshot.exists()) {
          set(rtdbRef(rtdb, `workspaces/${workspaceId}/signals/${auth.currentUser.uid}_${userId}`), {
            signal,
            from: auth.currentUser.uid,
            to: userId
          });
        } else {
          console.log(`User ${userId} not in room, not sending signal.`);
        }
      });
    });

    peer.on('stream', stream => {
      setPeers(prev => ({
        ...prev,
        [userId]: stream
      }));
    });

    peer.on('close', () => {
      console.log(`Peer ${userId} disconnected.`);
      setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[userId];
        return newPeers;
      });
      if (peersRef.current[userId]) {
        delete peersRef.current[userId];
      }
    });

    peer.on('error', err => {
      console.error("Peer error:", err);
      setError("Connection error occurred. Please try rejoining.");
    });

    return peer;
  };

  const handleJoinRoom = () => {
    if (!localStream) {
      setError("Please allow camera and microphone access first.");
      return;
    }

    set(rtdbRef(rtdb, `workspaces/${workspaceId}/videoRoom/${auth.currentUser.uid}`), {
      name: auth.currentUser.email,
      joinedAt: new Date().toISOString()
    });

    setIsJoined(true); // Keep this to trigger the second useEffect
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  if (!isActive) return null;

  return (
    <div className="video-conference-container">
      <div className="video-conference-header">
        <h3 className="video-conference-title">Video Conference</h3>
        <div className="video-actions">
          <button onClick={toggleMute}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={toggleVideo}>
            {isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
          </button>
          <button onClick={onClose}>
            End Call
          </button>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="video-stream-section">
        <div className="local-video-container">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-stream"
          />
          <div className="video-label">
            You ({auth.currentUser.email})
          </div>
        </div>

        {Object.entries(peers).map(([userId, stream]) => (
          <div key={userId} className="remote-video-container">
            <video
              autoPlay
              playsInline
              className="video-stream"
              ref={video => {
                if (video) video.srcObject = stream;
              }}
            />
            <div className="video-label">
              Participant {userId}
            </div>
          </div>
        ))}
      </div>

      {!isJoined && !error && (
        <p className="call-status-message">Waiting to join call...</p>
      )}
    </div>
  );
};

export default VideoConference; 