const statusElement = document.getElementById("status-text");

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs?.[0];
  const url = activeTab?.url || "";

  if (url.includes("kalshi.com")) {
    statusElement.textContent = "Ready on Kalshi";
    return;
  }

  statusElement.textContent = "Open a Kalshi market tab";
});
