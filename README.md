# HSK Study (Phase 0 prototype)

Local prototype of the study app described in
`../docs/superpowers/specs/2026-10-08-mandarin-study-app-design.md`.
Currently built: **flashcards** (words, sentences, grammar, mistakes) and **reading** for HSK 3.0 (2025) Levels 1–2.
The Chat tab is a placeholder.

## Run

```bash
npm install
npm run dev -- -H 0.0.0.0
```

- Laptop: http://localhost:3000
- Phone (same Wi-Fi): http://<laptop-LAN-IP>:3000 (find it with `ipconfig getifaddr en0` on macOS).
  If the page never loads, allow incoming connections for `node` in macOS firewall settings.

Progress is saved in the browser (`localStorage`), so the phone and laptop keep separate progress in this phase.

## Flashcards

Card types (keys in `src/lib/deck.ts`):

| Card | Front → back | Unlocks |
|---|---|---|
| Word | 汉字 → pinyin, meaning, example | in order: HSK 1 before HSK 2, grouped by topic |
| Word · English → 中文 | meaning → 汉字 | when the word card graduates |
| Sentence | example sentence → pinyin + English | when the word card graduates |
| Sentence · English → 中文 | English → the Chinese sentence | when the sentence card graduates |
| Grammar | pattern + English → Chinese example (rotates through examples) | when 70% of its example words are introduced |
| Grammar · fix | typical mistake → correction (with pinyin) + reason | when the grammar card graduates |
| From your chat | your mistake → correction (fed by Chat, coming next) | immediately, outside the quota |

- **Daily**: FSRS spaced repetition. Due cards first, then new words and practice cards (alternating,
  each with its own daily quota, practice types rotated), then missed cards a few minutes from due.
- **Cram**: Words / Sentences (by level, topic, direction), Grammar (by level), or Mistakes.
  Missed cards come back 3 cards later; cram never changes the schedule.
- **Settings** (sliders icon): theme (System / Light / Dark, applies to the whole app), new words/day, new practice/day, type answers (checked with a
  character diff; pinyin accepted for single words), play audio on reveal.
- Keyboard: Space/Enter reveals, then 1–4 grades (Space = Good).
- Progress from the first prototype (keyed by word id) is migrated automatically.

Not in this phase (needs the deployed version): progress shared across devices, offline use.

## Reading

- **Library**: HSK 1 / HSK 2 → 12 topics → 3 stories each (`data/stories.json`). Stories use only words at or below
  their level, and a topic's 3 stories together use every topic word at that level. Each card shows how much of the
  story's vocabulary you already know and whether you've read it.
- **Reader**: tap a word for its contextual pinyin and meaning (plus the dictionary gloss and HSK level), and add it
  to your flashcards; it becomes the next card in Daily. Press and hold a sentence, or tap 译, for its translation.
  Pinyin: all words, only words you don't know yet (default), or off. Words you don't know are underlined.
- After the story: 3 comprehension questions (tap EN for a translation) and "Mark as read".
- **New story** (per topic) asks Claude for a fresh story via `POST /api/stories`; it goes through the same
  vocabulary check and is saved in this browser. It takes about a minute.

## Checks

```bash
npm test          # vitest
npm run typecheck
npm run lint
npm run build
```

## Content

| File | Made by | Notes |
|---|---|---|
| `data/words.json` | `scripts/import-words.mjs`, then `npx tsx scripts/assign-topics.ts` | 500 HSK 3.0 (2025) words; topics assigned by Claude |
| `data/grammar.json` | `npx tsx scripts/gen-grammar.ts [--only id,…]` | 65 points from `scripts/grammar-spec.ts` (official 2025 outline); examples validated against the word list, then reviewed by hand |
| `data/stories.json` | `npx tsx scripts/gen-stories.ts [--only "HSK1:Time,…"]` | 72 stories; Claude writes, then repairs any sentence using non-HSK words; a second pass adds contextual pinyin/glosses |
| `data/allowed-extras.json` | hand-written | grammar items, the erhua 儿 and proper nouns allowed in generated text |

The generation scripts call Claude (`ANTHROPIC_API_KEY` from the environment).
