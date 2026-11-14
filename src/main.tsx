import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import CandidateApp from "./product/CandidateApp.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Invite links open /join: candidates never see the signed-in app. */}
    {location.pathname.replace(/\/$/, "").endsWith("/join") ? <CandidateApp /> : <App />}
  </StrictMode>,
);
