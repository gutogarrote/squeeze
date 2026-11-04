// Snapshots stay in memory. Never decode, store or send the received URL.
export function captureEnvironment(browser = window) {
  const controller = browser.navigator.serviceWorker?.controller;
  return {
    build: {
      mode: import.meta.env.MODE,
      // Production's fingerprinted module identifies the shell actually loaded,
      // including an older shell served by a controlling worker.
      module: browser.document.querySelector('script[type="module"][src]')?.src || null,
    },
    serviceWorker: {
      supported: 'serviceWorker' in browser.navigator,
      controller: controller ? { scriptURL: controller.scriptURL, state: controller.state } : null,
    },
    displayMode: {
      standalone: browser.matchMedia?.('(display-mode: standalone)').matches ?? false,
      iosStandalone: browser.navigator.standalone === true,
    },
  };
}

export function captureLinkContext(browser = window) {
  // Read Location directly BEFORE the routine parser or URLSearchParams.
  const { href, search, pathname } = browser.location;
  return { href, search, pathname, environment: captureEnvironment(browser) };
}

export function formatLinkDiagnostics(context, failure, browser = window) {
  return JSON.stringify({
    diagnostic: 'squeeze/invalid-link/v1',
    received: { href: context.href, search: context.search, pathname: context.pathname },
    parser: failure,
    atLoad: context.environment,
    atDisplay: captureEnvironment(browser),
  }, null, 2);
}

// The visible textarea is also the final manual fallback, so no data is lost
// when clipboard permission, the API or legacy copy is unavailable.
export async function copyLinkDiagnostics(text, textarea, browser = window) {
  try {
    if (browser.navigator.clipboard?.writeText) {
      await browser.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  try { return browser.document.execCommand?.('copy') === true; }
  catch (_) { return false; }
}
