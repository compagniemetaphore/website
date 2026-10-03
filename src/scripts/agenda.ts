/**
 * Agenda month navigation. The page is static, so the visible months and the
 * selected one are computed here with the visitor's date. Without JavaScript
 * every month is simply listed one after the other.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const dayTime = (day: string) => new Date(`${day}T00:00:00Z`).getTime();

for (const agenda of document.querySelectorAll<HTMLElement>('[data-agenda]')) {
    const showAll = agenda.hasAttribute('data-all');
    const panels = [...agenda.querySelectorAll<HTMLElement>('.agenda-month')];
    const pickerButtons = [...agenda.querySelectorAll<HTMLButtonElement>('[data-picker] [data-month]')];
    const picker = agenda.querySelector<HTMLElement>('[data-picker]')!;
    const toggle = agenda.querySelector<HTMLButtonElement>('[data-picker-toggle]')!;
    const current = agenda.querySelector<HTMLElement>('[data-current]')!;
    const steps = [...agenda.querySelectorAll<HTMLButtonElement>('.agenda-arrow')];

    // Months already over are dropped, unless the whole history is shown.
    const visible = panels.filter((panel) => {
        const keep = showAll || panel.dataset.month! >= today.slice(0, 7);
        panel.hidden = !keep;
        return keep;
    });
    pickerButtons.forEach((button) => {
        if (!visible.some((panel) => panel.dataset.month === button.dataset.month)) button.disabled = true;
    });
    picker.querySelectorAll('.picker-year').forEach((year) => {
        (year as HTMLElement).hidden = !year.querySelector('button:not([disabled])');
    });

    let index = -1;
    const select = (target: number) => {
        index = Math.max(0, Math.min(visible.length - 1, target));
        const month = visible[index].dataset.month!;
        visible.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
        current.textContent = visible[index].dataset.label!;
        steps[0].disabled = index === 0;
        steps[1].disabled = index === visible.length - 1;
        pickerButtons.forEach((button) => button.setAttribute('aria-current', String(button.dataset.month === month)));
    };

    // The month holding the date nearest to today.
    const nearest = () => {
        let best = { index: visible.length - 1, distance: Infinity };
        visible.forEach((panel, i) => {
            panel.querySelectorAll<HTMLTimeElement>('[data-dates] time').forEach((time) => {
                const distance = Math.abs(dayTime(time.dateTime.slice(0, 10)) - dayTime(today));
                // Prefer upcoming dates over past ones at equal distance.
                if (distance < best.distance || (distance === best.distance && time.dateTime >= today)) {
                    best = { index: i, distance };
                }
            });
        });
        return best.index;
    };

    const openPicker = (open: boolean) => {
        picker.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) picker.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
    };

    if (!visible.length) {
        agenda.querySelector('.agenda-bar')!.remove();
        agenda.querySelector<HTMLElement>('[data-empty]')!.hidden = false;
        continue;
    }
    select(nearest());

    agenda.addEventListener('click', (evt) => {
        const target = evt.target as Element;
        const step = target.closest<HTMLButtonElement>('[data-step]');
        if (step) select(index + Number(step.dataset.step));
        if (target.closest('[data-picker-toggle]')) openPicker(!!picker.hidden);
        if (target.closest('[data-today]')) select(nearest());
        const pick = target.closest<HTMLButtonElement>('[data-picker] [data-month]');
        if (pick) {
            select(visible.findIndex((panel) => panel.dataset.month === pick.dataset.month));
            openPicker(false);
            toggle.focus();
        }
    });
    document.addEventListener('click', (evt) => {
        if (!picker.hidden && !(evt.target as Element).closest('.agenda-bar')) openPicker(false);
    });
    agenda.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && !picker.hidden) {
            openPicker(false);
            toggle.focus();
        }
    });

    // Highlight today in the calendars.
    agenda.querySelectorAll(`.day[datetime="${today}"]`).forEach((day) => day.classList.add('is-today'));
}

// Tapping a calendar day focuses it so its events tooltip shows (Safari
// does not focus elements on click).
document.addEventListener('click', (evt) => {
    const day = (evt.target as Element).closest<HTMLElement>('.day.has-events');
    if (day && !(evt.target as Element).closest('a')) day.focus();
});
