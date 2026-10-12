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

Tap **New session** and choose what to study (Words, Sentences, Grammar, Verbs or your chat Mistakes,
filtered by level, topic, direction or tense) and how many cards: 10–80, or **All**.

- **→ / "I know it"**: the card leaves the session.
- **← / "I don't know it"**: the answer is shown (if it wasn't already), then the card is shuffled back
  into the rest of the deck.
- **Space** (or tapping the card) flips it.

When the deck is empty the session is complete; you can go over just the cards you missed, or start a new
session. A session survives switching tabs.

Every answer is remembered per word, grammar point or verb tense, so new sessions are picked in this order:
cards you missed last time, words you added from a story or chat, known cards due again (1, 3, 7, 14, 30,
then 60 days after each "know"), new cards in study order (A1 before A2, by topic), and finally known cards
not yet due. The chosen cards are shuffled.

Card types (keys in `src/lib/deck.ts`):

| Card | Front → back |
|---|---|
| Word | Português (nouns with o/a) → meaning, example; or English → Português |
| Sentence | example sentence → English; or English → Português |
| Grammar | pattern + English → Portuguese example (rotates through examples); or a typical mistake → correction |
| Conjugation | infinitive + tense + person → form, with the full table on the back |
| From your chat | your mistake → correction |

- **Typed answers** (settings) ignore case and punctuation; nouns are accepted with or without the article
  and verb forms with or without the pronoun. An answer that is right apart from accents is flagged "check
  the accents" rather than marked correct.
- Audio uses the browser's pt-BR voice.

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
