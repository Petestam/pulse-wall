/**
 * Marks the active link in .chrome-nav when <body data-pulse-page="…"> matches
 * [data-pulse-page] on each anchor.
 */
(function () {
  "use strict";
  var page =
    document.body && document.body.getAttribute("data-pulse-page");
  if (!page) return;
  document.querySelectorAll(".chrome-nav a[data-pulse-page]").forEach(
    function (a) {
      if (a.getAttribute("data-pulse-page") === page) {
        a.setAttribute("aria-current", "page");
      }
    },
  );
})();
