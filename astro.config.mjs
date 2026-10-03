// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rehypeFrenchSpacing } from './src/lib/typography.mjs';

export default defineConfig({
    site: 'https://compagniemetaphore.fr',
    trailingSlash: 'ignore',
    markdown: {
        rehypePlugins: [rehypeFrenchSpacing],
    },
    integrations: [
        sitemap(),
    ],
});
