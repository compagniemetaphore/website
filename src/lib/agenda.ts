import type { ImageMetadata } from 'astro';
import { getCollection, getEntry } from 'astro:content';

export interface Performance {
    date: string; // YYYY-MM-DDTHH:mm, local time
    title: string;
    slug: string;
    location: string;
}

export interface AgendaEvent {
    id: string;
    title: string;
    slug: string;
    location: string;
    dates: string[];
    poster?: ImageMetadata;
}

export interface AgendaMonth {
    key: string; // YYYY-MM
    events: AgendaEvent[];
    days: Map<string, Performance[]>; // YYYY-MM-DD => performances
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });

/** Parse a local "YYYY-MM-DD[THH:mm]" string as a UTC date to avoid timezone shifts. */
export const toUTC = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);

export const monthName = (key: string) => monthFormat.format(toUTC(`${key}-01`));

const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });

/** "15h30", "9h45", "15h" */
export const formatTime = (date: string) =>
    `${Number(date.slice(11, 13))}h${date.slice(14, 16) === '00' ? '' : date.slice(14, 16)}`;

/** "samedi 12" */
export const longDay = (date: string) => `${dayFormat.format(toUTC(date))} ${Number(date.slice(8, 10))}`;

/** "sam. 12" */
export const shortDay = (date: string) => `${shortDayFormat.format(toUTC(date))} ${Number(date.slice(8, 10))}`;

/** "sam. 18 oct." */
export const shortDate = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toUTC(date));

/** Group sorted performances by day: [{ day: "2025-11-25", times: [...] }] */
export function groupByDay(dates: string[]) {
    const days: { day: string; times: string[] }[] = [];
    for (const date of dates) {
        const day = date.slice(0, 10);
        const last = days[days.length - 1];
        if (last?.day === day) last.times.push(date);
        else days.push({ day, times: [date] });
    }
    return days;
}

/** "Vaureal" from "Auditorium G. Gershwin, Vaureal (95490)" */
export const city = (location: string) =>
    (location.split(',').pop() ?? location).replace(/\(.*?\)/g, '').replace(/\d{5}/g, '').trim();

/**
 * Group every event date by month. Past months are kept: they are hidden
 * client-side so the agenda stays correct between two builds.
 */
export async function getAgenda(): Promise<AgendaMonth[]> {
    const events = await getCollection('events');
    const months = new Map<string, AgendaMonth>();

    for (const event of events) {
        const spectacle = await getEntry(event.data.spectacle);
        if (!spectacle) {
            throw new Error(`L'événement "${event.id}" référence un spectacle inconnu.`);
        }
        const dates = [...event.data.dates].sort();

        for (const date of dates) {
            const key = date.slice(0, 7);
            const month: AgendaMonth = months.get(key) ?? { key, events: [], days: new Map() };
            months.set(key, month);

            let entry = month.events.find((e) => e.id === event.id);
            if (!entry) {
                entry = {
                    id: event.id,
                    title: spectacle.data.title,
                    slug: spectacle.id,
                    location: event.data.location,
                    dates: [],
                    poster: spectacle.data.poster ?? spectacle.data.thumbnail,
                };
                month.events.push(entry);
            }
            entry.dates.push(date);

            const day = date.slice(0, 10);
            month.days.set(day, [...(month.days.get(day) ?? []), {
                date,
                title: spectacle.data.title,
                slug: spectacle.id,
                location: event.data.location,
            }]);
        }
    }

    return [...months.values()]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((month) => {
            month.events.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
            month.days.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
            return month;
        });
}

/** Month containing the date nearest to the given day (same rule as the old site). */
export function nearestMonth(months: AgendaMonth[], today: string): string | undefined {
    const target = toUTC(today).getTime();
    let best: { key: string; distance: number } | undefined;
    for (const month of months) {
        for (const day of month.days.keys()) {
            const distance = Math.abs(toUTC(day).getTime() - target);
            if (!best || distance < best.distance) {
                best = { key: month.key, distance };
            }
        }
    }
    return best?.key;
}

/** 6 weeks x 7 days, starting on the Monday before the 1st of the month. */
export function calendarWeeks(key: string): string[][] {
    const first = toUTC(`${key}-01`);
    const start = new Date(first);
    start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, week) =>
        Array.from({ length: 7 }, (_, day) => {
            const date = new Date(start);
            date.setUTCDate(start.getUTCDate() + week * 7 + day);
            return date.toISOString().slice(0, 10);
        }),
    );
}

/** Upcoming performances of a show (as of the build), soonest first. */
export async function upcomingPerformances(spectacle: string, limit = 12) {
    const today = new Date().toISOString().slice(0, 10);
    const events = await getCollection('events', (event) => event.data.spectacle.id === spectacle);
    return events
        .flatMap((event) => event.data.dates.map((date) => ({ date, city: city(event.data.location) })))
        .filter(({ date }) => date.slice(0, 10) >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, limit);
}

/**
 * Next and last performance of every show, used to order the show lists
 * (upcoming dates first, then the most recently played).
 */
export async function showActivity() {
    const today = new Date().toISOString().slice(0, 10);
    const activity = new Map<string, { next?: string; last?: string }>();
    for (const event of await getCollection('events')) {
        const entry = activity.get(event.data.spectacle.id) ?? {};
        for (const date of event.data.dates) {
            if (date.slice(0, 10) >= today) {
                if (!entry.next || date < entry.next) entry.next = date;
            } else if (!entry.last || date > entry.last) {
                entry.last = date;
            }
        }
        activity.set(event.data.spectacle.id, entry);
    }
    return activity;
}
