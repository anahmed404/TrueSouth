import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installDiagnostics } from "./app/diag";
import { App } from "./app/router";
import "./app/theme.css";
import { GL_SWITCHES } from "./features/three/scene/gl-switches";

// `?diag=1`: F9 saves a diagnostic report (app/diag.ts). Off otherwise.
if (GL_SWITCHES.diag) installDiagnostics();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root is missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
