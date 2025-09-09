import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento #root en index.html");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);