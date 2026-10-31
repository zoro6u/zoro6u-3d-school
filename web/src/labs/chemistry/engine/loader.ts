import type { Lang, Reaction, ReactionData, ReactionText } from './types';

// Adding a reaction = adding a folder with reaction.json + en.json + ar.json. No code changes.
const base = '../../../../../content/lessons/chemistry-water-synthesis/reactions';
const data = import.meta.glob<ReactionData>('../../../../../content/lessons/chemistry-water-synthesis/reactions/*/reaction.json', { eager: true, import: 'default' });
const en = import.meta.glob<ReactionText>('../../../../../content/lessons/chemistry-water-synthesis/reactions/*/en.json', { eager: true, import: 'default' });
const ar = import.meta.glob<ReactionText>('../../../../../content/lessons/chemistry-water-synthesis/reactions/*/ar.json', { eager: true, import: 'default' });

const folderOf = (path: string) => path.slice(base.length + 1).split('/')[0]!;

export const reactions: Reaction[] = Object.entries(data)
  .map(([path, d]): Reaction => {
    const dir = folderOf(path);
    const pick = (m: Record<string, ReactionText>) => m[`${base}/${dir}/${m === en ? 'en' : 'ar'}.json`]!;
    return { data: d, text: { en: pick(en), ar: pick(ar) } satisfies Record<Lang, ReactionText> };
  })
  .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));

export const reactionById = (id: string): Reaction | undefined => reactions.find((r) => r.data.id === id);
