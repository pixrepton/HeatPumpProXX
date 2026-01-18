(function (window) {
  "use strict";

  const enabled =
    window.__HP_DEBUG__ === true ||
    (typeof location !== "undefined" &&
      /(?:\?|&)hp_debug=1\b/.test(location.search || ""));

  const startTime =
    (typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now());

  function now() {
    const diff =
      (typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()) - startTime;
    return diff.toFixed(1) + "ms";
  }

  function log(level, scope, message, data) {
    if (!enabled || typeof console === "undefined") return;

    const prefix = `%c[HP][${scope}] ${now()}`;
    const style =
      level === "error"
        ? "color:#e53935;font-weight:bold"
        : level === "warn"
        ? "color:#fb8c00"
        : "color:#1e88e5";

    const fn =
      level === "error"
        ? console.error
        : level === "warn"
        ? console.warn
        : console.info;

    if (data !== undefined) {
      fn.call(console, prefix, style, message, data);
    } else {
      fn.call(console, prefix, style, message);
    }
  }

  window.HP_LOG = {
    info: (scope, msg, data) => log("info", scope, msg, data),
    warn: (scope, msg, data) => log("warn", scope, msg, data),
    error: (scope, msg, data) => log("error", scope, msg, data),
    group: (label) =>
      enabled && console.groupCollapsed && console.groupCollapsed(`[HP] ${label}`),
    groupEnd: () => enabled && console.groupEnd && console.groupEnd(),
  };
})(window);

