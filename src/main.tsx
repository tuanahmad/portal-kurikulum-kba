import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { pasangPenjagaVersi } from "./lib/versiBaru";
import { mulaiTema } from "./lib/tema";

pasangPenjagaVersi();
mulaiTema();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
