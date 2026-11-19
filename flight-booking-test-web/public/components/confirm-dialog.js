/**
 * Dedicated Reusable Yes/No Confirmation Dialog Component
 * Usage: const ok = await confirmDialog.ask({ title, message, yesText, noText, tone });
 */
export function createConfirmDialog() {
  let activeResolve = null;

  function ensureRoot() {
    let root = document.getElementById('confirm-dialog-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'confirm-dialog-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function close(result) {
    const root = document.getElementById('confirm-dialog-root');
    if (root) root.innerHTML = '';
    if (activeResolve) {
      const resolve = activeResolve;
      activeResolve = null;
      resolve(result);
    }
  }

  function ask({
    title = 'Xác nhận thao tác',
    message = 'Bạn có chắc chắn muốn thực hiện thao tác này?',
    yesText = 'Có, tiếp tục',
    noText = 'Không, quay lại',
    tone = 'primary',
  } = {}) {
    if (activeResolve) close(false);

    return new Promise((resolve) => {
      activeResolve = resolve;
      const root = ensureRoot();
      const esc = (v) =>
        String(v ?? '').replace(/[&<>"']/g, (c) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[c]));

      root.innerHTML = `
        <div class="confirm-backdrop" data-confirm-backdrop="true">
          <div class="confirm-card confirm-${esc(tone)}" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
            <div class="confirm-head">
              <span class="confirm-icon" aria-hidden="true">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
                </svg>
              </span>
              <div>
                <h3 id="confirm-title">${esc(title)}</h3>
                <p id="confirm-desc">${esc(message)}</p>
              </div>
            </div>
            <div class="confirm-actions">
              <button type="button" class="btn secondary confirm-no" data-confirm-choice="no">${esc(noText)}</button>
              <button type="button" class="btn ${tone === 'danger' ? 'danger-solid' : 'primary'} confirm-yes" data-confirm-choice="yes">${esc(yesText)}</button>
            </div>
          </div>
        </div>
      `;

      const backdrop = root.querySelector('[data-confirm-backdrop]');
      const noBtn = root.querySelector('[data-confirm-choice="no"]');
      const yesBtn = root.querySelector('[data-confirm-choice="yes"]');

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(false);
      });
      noBtn.addEventListener('click', () => close(false));
      yesBtn.addEventListener('click', () => close(true));
      yesBtn.focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeResolve) {
      close(false);
    }
  });

  return { ask, close };
}
