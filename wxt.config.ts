import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BrowseMemory",
    description: "Search and ask questions about your local browsing memory.",
    action: { default_title: "Open BrowseMemory" },
    permissions: ["tabs", "activeTab", "storage", "alarms", "sidePanel"],
    host_permissions: ["<all_urls>"],
  },
});
