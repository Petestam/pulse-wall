(function () {
  if (new URLSearchParams(location.search).get("embed") !== "1") return;
  document.documentElement.classList.add("topology-embed");
})();
