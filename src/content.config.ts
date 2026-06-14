import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { StandardSchema } from './lib/schema';

const standards = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/standards' }),
  schema: StandardSchema,
});

export const collections = { standards };
