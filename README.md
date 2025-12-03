# TeamSpace Collaboration Platform

TeamSpace is a real-time collaboration app for teams. It provides workspaces with chat, documents, tasks, file sharing, events, and member management — all powered by Firebase and built with React + Vite.

🔗 Live Demo: https://teamspace12.netlify.app

## Tech Stack

- **React 19** with **Vite**
- **Firebase** (Auth, Firestore, Realtime Database)
- **React Router**, **react-quill-new**, **simple-peer**

## Prerequisites

- Node.js 18+ and npm
- A Firebase project with Auth, Firestore, and Realtime Database enabled

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure Firebase in `src/firebase.js`
   ```js
   import { initializeApp } from "firebase/app";
   import { getAuth } from "firebase/auth";
   import { getFirestore } from "firebase/firestore";
   import { getDatabase } from "firebase/database";

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };

   const app = initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   export const rtdb = getDatabase(app);
   ```
3. (Optional) Set Firestore security rules appropriately for your collections.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

## Development

- App runs by default at `http://localhost:5173/` after `npm run dev`.
- Update environment/Firebase config before deploying.

## License

Open source. Add your preferred license if needed.

