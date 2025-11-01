import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Ensure the root container exists and provide a clear error if not.
const container = document.getElementById("root");
if (!container) {
  // Helpful error for debugging - avoids the generic React error
  throw new Error(
    'Root element with id "root" not found. Make sure `public/index.html` contains `<div id="root"></div>` and that this file is being served.'
  );
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
