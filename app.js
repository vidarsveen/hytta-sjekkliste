const LS = 'hytta-sjekkliste-v1';
const tabs = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('.panel')];
const boxes = [...document.querySelectorAll('input[type=checkbox][data-key]')];
let state = {};
let storageAvailable = true;
let undoSnapshot = null;
let resetToastTimer = null;

function dismissResetToast() {
  clearTimeout(resetToastTimer);
  resetToastTimer = null;
  undoSnapshot = null;
  const toast = document.getElementById('toast');
  if (toast.contains(document.activeElement)) {
    const focusTarget = document.querySelector('.panel.active [data-reset]')
      || document.querySelector('.tab.active');
    focusTarget.focus({ preventScroll: true });
  }
  toast.hidden = true;
}

try {
  const saved = JSON.parse(localStorage.getItem(LS) || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) state = saved;
} catch { state = {}; }

function save() {
  try {
    localStorage.setItem(LS, JSON.stringify(state));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  document.getElementById('save-note').textContent = storageAvailable
    ? '✓ Avkrysningene lagres på denne enheten.'
    : 'Avkrysningene beholdes så lenge siden er åpen. Nettleseren tillater ikke lagring.';
}

function show(id, moveToContent = false) {
  if (!panels.some(panel => panel.id === id)) id = 'ankomst';
  tabs.forEach(tab => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach(panel => {
    panel.hidden = panel.id !== id;
    panel.classList.toggle('active', panel.id === id);
  });
  try { localStorage.setItem(LS + '-tab', id); } catch { /* Navigation works without storage. */ }
  if (moveToContent) document.getElementById('main').scrollIntoView({ block: 'start' });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => show(tab.dataset.tab, true));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    show(tabs[next].dataset.tab);
    tabs[next].focus();
  });
});
let lastTab;
try { lastTab = localStorage.getItem(LS + '-tab'); } catch { /* Default to arrival. */ }
show(lastTab || 'ankomst');

boxes.forEach(box => {
  box.checked = state[box.dataset.key] === true;
  box.addEventListener('change', () => {
    state[box.dataset.key] = box.checked;
    save();
    updateProgress();
  });
});

function updateProgress() {
  ['ankomst', 'avreise'].forEach(id => {
    const inputs = [...document.querySelectorAll(`#${id} input[type=checkbox]`)];
    const done = inputs.filter(input => input.checked).length;
    const complete = done === inputs.length;
    document.querySelector(`[data-progress="${id}"]`).textContent = `${done} av ${inputs.length} punkter fullført`;
    document.querySelector(`[data-tab-count="${id}"]`).textContent = `${done}/${inputs.length}`;
    const meter = document.querySelector(`[data-meter="${id}"]`);
    meter.max = inputs.length;
    meter.value = done;
    meter.closest('.progress-card').classList.toggle('complete', complete);
    document.querySelector(`[data-hint="${id}"]`).textContent = complete
      ? (id === 'ankomst' ? 'Alt sjekket!' : 'Alt klart. God tur hjem!')
      : done === 0 ? 'Kryss av etter hvert.' : `${inputs.length - done} punkter igjen.`;
    document.querySelectorAll(`#${id} .card`).forEach(card => {
      const count = card.previousElementSibling?.querySelector('.group-count');
      const group = [...card.querySelectorAll('input[type=checkbox]')];
      if (count) count.textContent = `${group.filter(input => input.checked).length} / ${group.length}`;
    });
  });
}

document.querySelectorAll('[data-reset]').forEach(button => {
  button.addEventListener('click', () => {
    const inputs = [...document.querySelectorAll(`#${button.dataset.reset} input[type=checkbox]`)];
    if (!inputs.some(input => input.checked)) return;
    undoSnapshot = inputs.map(input => ({ key: input.dataset.key, checked: input.checked }));
    inputs.forEach(input => { input.checked = false; state[input.dataset.key] = false; });
    save();
    updateProgress();
    clearTimeout(resetToastTimer);
    document.getElementById('toast').hidden = false;
    resetToastTimer = setTimeout(dismissResetToast, 5000);
  });
});
document.getElementById('undo-reset').addEventListener('click', () => {
  if (!undoSnapshot) return;
  const panel = boxes.find(box => box.dataset.key === undoSnapshot[0].key).closest('.panel');
  undoSnapshot.forEach(({ key, checked }) => {
    // Keep anything the user checked after resetting as well.
    state[key] = checked || state[key] === true;
    boxes.find(box => box.dataset.key === key).checked = state[key];
  });
  dismissResetToast();
  save();
  updateProgress();
  show(panel.id, true);
  document.querySelector(`[data-reset="${panel.id}"]`).focus({ preventScroll: true });
});

document.querySelectorAll('[data-guide]').forEach(button => {
  button.addEventListener('click', () => {
    show('info');
    const guide = [...document.querySelectorAll('.guide-card')].find(card =>
      card.querySelector('summary').textContent.includes(button.dataset.guide));
    if (guide) {
      guide.open = true;
      guide.querySelector('summary').focus({ preventScroll: true });
      guide.scrollIntoView({ block: 'center' });
    }
  });
});
save();
updateProgress();
