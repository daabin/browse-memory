import { extractPage } from "../src/extraction/extract-page";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  main() {
    let lastUrl = "";
    let timer: number | undefined;

    const report = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (location.href === lastUrl && document.title === lastTitle) {
          return;
        }
        lastUrl = location.href;
        lastTitle = document.title;
        void chrome.runtime.sendMessage({
          type: "PAGE_CHANGED",
          page: extractPage(document, location.href),
        });
      }, 250);
    };

    let lastTitle = document.title;
    const wrapHistory = (method: "pushState" | "replaceState") => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        report();
        return result;
      };
    };

    wrapHistory("pushState");
    wrapHistory("replaceState");
    window.addEventListener("popstate", report);
    new MutationObserver(report).observe(
      document.querySelector("title") ?? document.documentElement,
      { childList: true, subtree: true, characterData: true },
    );
    report();
  },
});
