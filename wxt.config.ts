import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BrowseMemory",
    description: "Search and ask questions about your local browsing memory.",
    action: { default_title: "Open BrowseMemory" },
    permissions: ["tabs", "activeTab", "storage", "alarms", "sidePanel"],
    host_permissions: ["<all_urls>"],
    icons: {
      16: "/icon16.png",
      32: "/icon32.png",
      48: "/icon48.png",
      128: "/icon128.png",
    },
  },
});
