import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

// Global error handler to show errors on screen
window.onerror = (msg, src, line, col, err) => {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<pre style="color:red;padding:2rem;font-size:14px;white-space:pre-wrap">RUNTIME ERROR:\n${msg}\n\nSource: ${src}:${line}:${col}\n\n${err?.stack || ''}</pre>`;
  }
};

window.addEventListener("unhandledrejection", (e) => {
  const el = document.getElementById("root");
  if (el && !el.children.length) {
    el.innerHTML = `<pre style="color:red;padding:2rem;font-size:14px;white-space:pre-wrap">UNHANDLED PROMISE REJECTION:\n${e.reason}\n\n${e.reason?.stack || ''}</pre>`;
  }
});

try {
  const router = getRouter();
  const root = document.getElementById("root");
  if (root) {
    ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
  }
} catch (e: any) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<pre style="color:red;padding:2rem;font-size:14px;white-space:pre-wrap">INIT ERROR:\n${e.message}\n\n${e.stack}</pre>`;
  }
}
