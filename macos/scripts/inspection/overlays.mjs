// The read-only visual probe includes native toolbars. Interactive walks must
// distinguish those persistent surfaces from menus/dialogs/selection portals.
export function transientPopups(page) {
  return page.popovers.filter(p => p.kind !== 'toolbar');
}
export function hasBlockingPopup(page) {
  return transientPopups(page).length > 0;
}
