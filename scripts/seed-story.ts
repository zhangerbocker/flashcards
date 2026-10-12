// Builds the starter story in data/stories.json from hand-written text, glossing words with
// their dictionary English (no Claude call). Run: npx tsx scripts/seed-story.ts
import { writeFileSync } from "node:fs";
import { buildLexicon, unknownTokens } from "../src/lib/segment";
import { loadExtras } from "../src/lib/server/extras";
import { buildStory, type StoryDraft } from "../src/lib/story";
import { WORDS } from "../src/lib/words";

const draft: StoryDraft = {
  title: "Um dia na praia",
  titleEn: "A day at the beach",
  sentences: [
    { pt: "Hoje está muito quente no Rio.", en: "Today it's very hot in Rio." },
    { pt: "Ana mora no Rio com a família.", en: "Ana lives in Rio with her family." },
    { pt: "Ela tem dois irmãos e uma irmã.", en: "She has two brothers and a sister." },
    { pt: "Hoje ela não vai trabalhar.", en: "Today she isn't going to work." },
    { pt: "Ela vai para a praia com um amigo.", en: "She's going to the beach with a friend." },
    { pt: "O amigo é professor de português.", en: "The friend is a Portuguese teacher." },
    { pt: "Ele é de São Paulo, mas mora no Rio.", en: "He is from São Paulo, but lives in Rio." },
    { pt: "Na praia, eles bebem água e comem pão de queijo.", en: "At the beach, they drink water and eat pão de queijo." },
    { pt: "A praia é grande e muito bonita.", en: "The beach is big and very beautiful." },
    { pt: "Ana gosta muito da praia.", en: "Ana really likes the beach." },
    { pt: "Amanhã eles vão trabalhar.", en: "Tomorrow they are going to work." },
  ],
  questions: [
    { q: "Onde Ana mora?", qEn: "Where does Ana live?", options: ["No Rio", "Em Salvador", "Em Boston", "Em São Paulo"], answer: 0 },
    { q: "Com quem Ana vai para a praia?", qEn: "Who does Ana go to the beach with?", options: ["Com a mãe", "Com um amigo", "Com o pai", "Com a irmã"], answer: 1 },
    { q: "O que eles bebem na praia?", qEn: "What do they drink at the beach?", options: ["Café", "Água", "Café e água", "Não bebem"], answer: 1 },
  ],
};

const { extras, extraGlosses } = loadExtras();
const lexicon = buildLexicon(WORDS, extras);
const unknown = draft.sentences.flatMap((s) => unknownTokens(s.pt, lexicon, extras));
if (unknown.length) console.warn(`Not in the word list (no gloss): ${[...new Set(unknown)].join(", ")}`);
const dictionary = new Map(WORDS.map((w) => [w.id, { en: w.english }]));
const story = buildStory("a1-seed-1", 1, "Places & directions", draft, [], lexicon, dictionary, extraGlosses);
writeFileSync("data/stories.json", JSON.stringify([story], null, 1) + "\n");
console.log(`Wrote 1 story with ${story.wordIds.length} list words.`);
