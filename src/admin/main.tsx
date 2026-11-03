import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

export function mount(el: HTMLElement) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
