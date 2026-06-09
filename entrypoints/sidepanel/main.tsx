import React from "react";
import ReactDOM from "react-dom/client";

import { previewClient } from "../../src/ui/preview-client";
import { App } from "./App";
import "./styles.css";

const isPreview = new URLSearchParams(location.search).has("preview");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App client={isPreview ? previewClient : undefined} />
  </React.StrictMode>,
);
