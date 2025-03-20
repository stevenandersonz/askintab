document.addEventListener("DOMContentLoaded", () => {
  const shortcutInput = document.getElementById("shortcut");
  let keysPressed = new Set();

  shortcutInput.addEventListener("keydown", (event) => {
    event.preventDefault();
    keysPressed.add(event.key);
    shortcutInput.value = Array.from(keysPressed).join(" + ");

    // Save shortcut to Chrome storage
    chrome.storage.sync.set({ shortcut: shortcutInput.value });
  });

  shortcutInput.addEventListener("keyup", () => {
      keysPressed.clear();
  });

  // Load stored shortcut
  chrome.storage.sync.get("shortcut", (data) => {
    if (data.shortcut) {
      shortcutInput.value = data.shortcut;
    }
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({type:"DOWNLOAD"}, (res) => {
      const blob = new Blob([res], { type: "text/plain" });

      // Create a temporary download link
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "exported_file.txt"; // File name

      // Simulate click to trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a); // Clean up
    })
   

    
});

});