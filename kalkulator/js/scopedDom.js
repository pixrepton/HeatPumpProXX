(function (window) {
  'use strict';

  const domCache = new WeakMap();

  function createScopedDom(root) {
    if (!root || !(root instanceof Element)) {
      throw new Error('[scopedDom] root is invalid');
    }

    let cached = domCache.get(root);
    if (cached) return cached;

    const api = {
      root,
      qs(selector) {
        return root.querySelector(selector);
      },
      qsa(selector) {
        return root.querySelectorAll(selector);
      },
      byId(id) {
        if (!id) return null;
        return root.querySelector('#' + CSS.escape(id));
      },
    };
    domCache.set(root, api);
    return api;
  }

  function setActiveRoot(root) {
    if (root && root instanceof Element) {
      const dom = createScopedDom(root);
      window.__HP_ACTIVE_ROOT__ = root;
      window.__HP_APP_CONTEXT__ = { root, dom };
    }
  }

  function findDefaultRoot() {
    if (window.__HP_ACTIVE_ROOT__ instanceof Element) {
      return window.__HP_ACTIVE_ROOT__;
    }
    const all = document.querySelectorAll('.heatpump-calculator');
    return all.length ? all[0] : null;
  }

  function getDom() {
    const activeRoot = window.__HP_ACTIVE_ROOT__;
    if (window.__HP_APP_CONTEXT__ && window.__HP_APP_CONTEXT__.dom) {
      if (
        activeRoot &&
        window.__HP_APP_CONTEXT__.root &&
        window.__HP_APP_CONTEXT__.root !== activeRoot
      ) {
        const dom = createScopedDom(activeRoot);
        window.__HP_APP_CONTEXT__ = { root: activeRoot, dom };
        return dom;
      }
      return window.__HP_APP_CONTEXT__.dom;
    }
    const root = activeRoot || findDefaultRoot();
    if (!root) return null;
    const dom = createScopedDom(root);
    window.__HP_APP_CONTEXT__ = { root, dom };
    return dom;
  }

  function hpQs(selector) {
    const dom = getDom();
    return dom ? dom.qs(selector) : null;
  }

  function hpQsa(selector) {
    const dom = getDom();
    return dom ? dom.qsa(selector) : [];
  }

  function hpById(id) {
    const dom = getDom();
    return dom ? dom.byId(id) : null;
  }

  window.createScopedDom = createScopedDom;
  window.__HP_SET_ACTIVE_ROOT__ = setActiveRoot;
  window.hpQs = hpQs;
  window.hpQsa = hpQsa;
  window.hpById = hpById;
})(window);
