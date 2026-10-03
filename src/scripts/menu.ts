const menu = document.getElementById('menu');
const button = document.getElementById('menu-button') as HTMLInputElement | null;

if (menu && button) {
    // Keep the mobile menu open while navigating it with the keyboard.
    menu.addEventListener('focusin', (evt) => {
        button.checked = menu.contains(evt.target as Node);
    });
    menu.addEventListener('focusout', (evt) => {
        button.checked = menu.contains(evt.relatedTarget as Node | null);
    });
    document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape') button.checked = false;
    });
}
