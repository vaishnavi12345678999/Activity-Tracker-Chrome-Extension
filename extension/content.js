let startTime = Date.now();
let currentUrl = window.location.hostname;

// Always fetch email first before tracking
chrome.storage.local.get("user", (data) => {
  const userEmail = data.user?.email;

  if (!userEmail) {
    console.warn("❌ No user email found in local storage");
    return;
  }

  // Log activity when leaving page or switching tab
  function handlePageLeave() {
    const endTime = Date.now();
    const timeSpent = Math.round((endTime - startTime) / 1000); // seconds

    if (!currentUrl || timeSpent < 1) return;

    fetch("http://localhost:5000/api/activities/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: userEmail,
        site: currentUrl,
        timeSpent
      })
    })
      .then(res => res.json())
      .then(data => console.log("✅ Logged activity:", data))
      .catch(err => console.error("❌ Logging failed:", err));
  }

  // Attach listeners
  window.addEventListener("beforeunload", handlePageLeave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      handlePageLeave();
    } else if (document.visibilityState === "visible") {
      startTime = Date.now(); // Reset start time
    }
  });
});
