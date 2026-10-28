/* global document, fetch */
/* Parts Builder buy button. Put <div data-parts-buy data-store="your-store" data-listing="LISTING_ID"></div>
   on any page, then <script async src="https://YOUR-SITE/embed.js"></script>. */
(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "";
  function render(el) {
    if (el.getAttribute("data-rendered")) return;
    var store = el.getAttribute("data-store");
    var id = el.getAttribute("data-listing");
    if (!origin || !store || !id) return;
    el.setAttribute("data-rendered", "1");
    var link = document.createElement("a");
    link.href = origin + "/shop/" + encodeURIComponent(store) + "/" + encodeURIComponent(id);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Buy";
    link.style.cssText = "display:inline-block;padding:8px 16px;border-radius:6px;background:#111;color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none";
    el.appendChild(link);
    fetch(origin + "/api/shop/" + encodeURIComponent(store))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (shop) {
        var item = shop && shop.listings.filter(function (l) { return l.id === id; })[0];
        if (item) link.textContent = "Buy " + item.title + " - $" + (item.retailCents / 100).toFixed(2);
      })
      .catch(function () {});
  }
  var nodes = document.querySelectorAll("[data-parts-buy]");
  for (var i = 0; i < nodes.length; i++) render(nodes[i]);
})();
