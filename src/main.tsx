import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { seedDatabase } from "./db/seedData";
import { initializeAndroidApp } from "./app/platform";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

void initializeAndroidApp().catch((error) => console.error("Android initialization failed", error));

seedDatabase()
  .catch((error) => {
    console.error("Failed to seed database", error);
  })
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
