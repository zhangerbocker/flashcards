# Português

A study app for **Brazilian Portuguese, CEFR A1–A2**: spaced-repetition flashcards (words, sentences,
grammar and verb conjugations), graded reading with tap-to-translate, and a chat partner that corrects
every message.

Adapted, with permission, from [ScharanCysne/mandarin](https://github.com/ScharanCysne/mandarin), an HSK
Chinese app. The scheduler, sync, login and app shell are unchanged; the content model, tokenizer, answer
checking and prompts were rewritten for Portuguese.

## Run

```bash
npm install
npm run dev
```

- Laptop: http://localhost:3000 (no login locally unless `SESSION_SECRET` is set).
- Phone (same Wi-Fi): `npm run dev -- -H 0.0.0.0`, then http://<laptop-LAN-IP>:3000
  (find it with `ipconfig getifaddr en0` on macOS).

Chat and "New story" call Claude. Put a key in `.env.local` (git-ignored): either an MIT Parley key
(`PARLEY_API_KEY`, with `PARLEY_MODEL`) or an Anthropic key (`ANTHROPIC_API_KEY`); Parley is used when its
key is set. Check the key with `npx tsx --env-file=.env.local scripts/check-claude.ts`.

## Flashcards

Card types (keys in `src/lib/deck.ts`):

| Card | Front → back | Unlocks |
|---|---|---|
| Word | Português (nouns with o/a) → meaning, example | in order: A1 before A2, grouped by topic |
| Word · English → Português | meaning → word | when the word card graduates |
| Sentence | example sentence → English | when the word card graduates |
| Sentence · English → Português | English → the Portuguese sentence | when the sentence card graduates |
| Grammar | pattern + English → Portuguese example (rotates through examples) | when 70% of its example words are introduced |
| Grammar · fix | typical mistake → correction + reason | when the grammar card graduates |
| Conjugation | infinitive + tense + person → form, with the full table on the back | present once the verb is known; then pretérito perfeito, then imperfeito |
| From your chat | your mistake → correction | immediately, outside the quota |

- **Daily**: due cards first, then new words and practice items (grammar points and verb tenses, taking
  turns), each with its own daily quota, then missed cards a few minutes from due.
- **Cram**: Words / Sentences (by level, topic, direction), Grammar, Verbs (by level and tense) or Mistakes.
  Missed cards come back 3 cards later; cram never changes the schedule.
- **Typed answers** ignore case and punctuation; nouns are accepted with or without the article and verb
  forms with or without the pronoun. An answer that is right apart from accents is flagged "check the
  accents" rather than marked correct.
- Audio uses the browser's pt-BR voice.
- Keyboard: Space/Enter reveals, then 1–4 grades (Space = Good).

## Reading

- **Library**: A1 / A2 → 12 topics → stories (`data/stories.json`). Each card shows how much of the story's
  vocabulary you already know and whether you've read it.
- **Reader**: tap a word for its meaning in context plus its dictionary entry (conjugated verbs and plurals
  link to the infinitive or singular), and add it to your flashcards. Press and hold a sentence, or tap EN,
  for its translation; ▶ reads the story or sentence aloud. Words you don't know yet are underlined.
- After the story: 3 comprehension questions (tap EN for a translation) and "Mark as read".
- **New story** (per topic) asks Claude for a fresh story via `POST /api/stories`; it goes through the same
  vocabulary check and is saved in this browser.

## Chat

Pick a level and a scenario (a padaria in São Paulo, weekend plans, work, family, getting around Rio). The
partner replies in simple Brazilian Portuguese within your level's words; every message you send is
checked, mistakes (including missing accents and gender agreement) become flashcards, and English words
you used for gaps are looked up. "End chat" shows a summary.

## Checks

```bash
npm test          # vitest
npm run typecheck
npm run lint
npm run build
```

## Content

| File | Notes |
|---|---|
| `data/words.json` | words with gender, inflected `forms` (so the reader can find "falei" under falar) and an example |
| `data/verbs.json` | present, pretérito perfeito and imperfeito tables; regular verbs are checked against `regularForms` in tests |
| `data/grammar.json` | grammar points with examples, a typical mistake and the words they use |
| `data/stories.json` | graded stories, tokenized and glossed |
| `data/allowed-extras.json` | names and places allowed in generated text |

The current content is a small hand-checked starter set (`scripts/seed-story.ts` builds the starter story).
