import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./ui/safeUpdate";
import "./index.css";
import { requestPersistentStorage } from "./storage/persistentStorage";

registerServiceWorker();
requestPersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
