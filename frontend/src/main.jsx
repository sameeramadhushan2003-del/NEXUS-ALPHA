
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import CursorAura from "./CursorAura.jsx";
import "./styles.css";
import "./nexus-theme.css";


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    
    <CursorAura />
    <App />
  </React.StrictMode>
);

