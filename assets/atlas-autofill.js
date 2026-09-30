(function () {
  'use strict';
  const authForms = new Set(['atlasLoginForm','atlasRegisterForm','atlasAdminResetForm','atlasChangePasswordForm']);
  const guarded = new WeakSet();
  const searchLocks = new WeakSet();
  let sequence = 0;
  const isolated = document.createElement('form');
  isolated.id = 'atlasNonCredentialFields';
  isolated.hidden = true;
  isolated.autocomplete = 'off';
  isolated.addEventListener('submit', event => event.preventDefault());
  document.body.appendChild(isolated);

  function protect(field) {
    if (guarded.has(field) || field.type === 'password' || authForms.has(field.form?.id)) return;
    if (!['text','search','email','url','tel','textarea'].includes(field.type)) return;
    guarded.add(field);
    field.setAttribute('autocomplete','off');
    field.setAttribute('data-lpignore','true');
    field.setAttribute('data-1p-ignore','');
    field.setAttribute('data-bwignore','true');
    if (!field.form) field.setAttribute('form',isolated.id);
    else field.form.setAttribute('autocomplete','off');
    if (field.type === 'search') {
      if (!field.name) field.name = 'atlas_search_query_' + (++sequence);
      // Lock only searches we own; never unlock intentionally read-only profile fields.
      if (!field.readOnly) {
        searchLocks.add(field);
        field.readOnly = document.activeElement !== field;
      }
    }
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('input,textarea')) protect(node);
    node.querySelectorAll('input,textarea').forEach(protect);
  }
  scan(document.body);
  // Direct and profile editors replace their markup after navigation and API responses.
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(scan)))
    .observe(document.body,{childList:true,subtree:true});
  function unlock(event) {
    const field = event.target;
    if (searchLocks.has(field)) field.readOnly = false;
  }
  document.addEventListener('pointerdown',unlock,true);
  document.addEventListener('focus',unlock,true);
  document.addEventListener('blur',event => {
    if (searchLocks.has(event.target)) event.target.readOnly = true;
  },true);
})();
