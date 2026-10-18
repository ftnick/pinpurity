function is(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("pinterest.com")) return false;
    if (!u.pathname.startsWith("/search/pins/")) return false;
    return u.searchParams.has("q");
  } catch (e) {
    return false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab || !tab.url) return;
  if (!is(tab.url)) return;
  try {
    const u = new URL(tab.url);
    if (u.searchParams.get("filter_genai") === "true") return;
    u.searchParams.set("filter_genai", "true");
    const newUrl = u.toString();
    if (newUrl !== tab.url) {
      chrome.tabs.update(tabId, { url: newUrl });
    }
  } catch (e) {
    // shh
  }
});
