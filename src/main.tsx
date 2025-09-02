import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // o "./App.css", según el archivo de estilos que prefieras

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento #root en index.html");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);