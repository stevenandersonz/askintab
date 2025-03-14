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
});