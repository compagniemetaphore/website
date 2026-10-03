import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** The CMS saves empty fields as "" or null: treat them as missing. */
const empty = (value: unknown) => (value === '' || value === null ? undefined : value);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(empty, schema.optional());
const list = <T extends z.ZodType>(schema: T) => z.preprocess(empty, z.array(schema).default([]));

/** Which part of the banner image stays visible. */
const framing = z.preprocess(empty, z.enum(['top', 'center', 'bottom']).default('center'));

/**
 * Main pages (accueil, compagnie, spectacles, agenda, contact).
 * The layout of each page lives in `src/pages`, only the texts are editable.
 */
const pages = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/pages' }),
    schema: ({ image }) => z.object({
        title: z.string(),
        subtitle: optional(z.string()),
        description: optional(z.string()),
        header: optional(image()),
        framing,
        // Compagnie page only
        figures: list(z.object({ value: z.string(), label: z.string() })),
        quote: optional(z.string()),
        teamTitle: optional(z.string()),
        team: list(z.object({
            name: z.string(),
            role: optional(z.string()),
            photo: optional(image()),
            bio: optional(z.string()),
        })),
        board: list(z.object({ name: z.string(), role: z.string() })),
        collaborators: list(z.object({ name: z.string(), role: optional(z.string()) })),
        thanks: optional(z.string()),
        // Contact page only
        photo: optional(image()),
        // Historique page only
        posters: list(image()),
    }),
});

/**
 * Shows. Each file becomes a page at `/<file-name>`.
 */
const spectacles = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/spectacles' }),
    schema: ({ image }) => z.object({
        title: z.string(),
        subtitle: optional(z.string()),
        description: optional(z.string()),
        category: z.preprocess(empty, z.enum(['upcoming', 'available', 'unavailable', 'hidden']).default('available')),
        header: optional(image()),
        framing,
        thumbnail: optional(image()),
        poster: optional(image()),
        teaser: optional(z.url()),
        downloads: list(z.object({ label: z.string(), file: z.string() })),
        gallery: list(image()),
        galleryCredit: optional(z.string()),
        press: list(z.object({
            text: z.string(),
            author: optional(z.string()),
            source: optional(z.string()),
        })),
    }),
});

/**
 * A date is stored as a local "YYYY-MM-DDTHH:mm" string. YAML may turn some
 * formats into a Date (interpreted as UTC), so both are normalized here.
 */
const localDate = z.union([z.string(), z.date()]).transform((value, ctx) => {
    const date = value instanceof Date
        ? value.toISOString().slice(0, 16)
        : value.trim().replace(' ', 'T').slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) {
        ctx.addIssue({ code: 'custom', message: `Date invalide : ${String(value)}` });
        return z.NEVER;
    }
    return date;
});

/**
 * The CMS stores the show as its file name ("le-petit-prince.md"); keep the
 * id only so both "le-petit-prince" and "le-petit-prince.md" work.
 */
const spectacleRef = z.string()
    .transform((value) => value.trim().split('/').pop()!.replace(/\.md$/, ''))
    .pipe(reference('spectacles'));

/**
 * Calendar events: a show played at a location on one or more dates.
 */
const events = defineCollection({
    loader: glob({ pattern: '*.{yml,yaml}', base: './src/content/events' }),
    schema: z.object({
        spectacle: spectacleRef,
        location: z.string(),
        dates: z.array(localDate).min(1),
    }),
});

export const collections = { pages, spectacles, events };
