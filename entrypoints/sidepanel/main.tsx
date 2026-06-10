import React from "react";
import ReactDOM from "react-dom/client";

import { I18nProvider } from "../../src/i18n";
import { previewClient } from "../../src/ui/preview-client";
import { App } from "./App";
import "./styles.css";

const isPreview = new URLSearchParams(location.search).has("preview");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App client={isPreview ? previewClient : undefined} />
    </I18nProvider>
  </React.StrictMode>,
);
