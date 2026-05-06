---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Saves to UBIQUITOUS_LANGUAGE.md. Use when user wants to define domain terms, build a glossary, harden terminology, create a ubiquitous language, or mentions "domain model" or "DDD".
disable-model-invocation: true
---

# Ubiquitous Language

Extract and formalize domain terminology from the current conversation into a consistent glossary, saved to a local file.

**Important:** This project uses **German** as its domain language. All canonical terms must be in German (e.g. Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit, Partie, Tisch, Spieler). Only use English for generic technical concepts with no German equivalent in the domain.

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Consult `specs/architektur.md`** for domain model, module boundaries, and naming conventions
4. **Propose a canonical glossary** with opinionated term choices
5. **Write to `UBIQUITOUS_LANGUAGE.md`** in the working directory using the format below
6. **Output a summary** inline in the conversation

## Output Format

Write a `UBIQUITOUS_LANGUAGE.md` file with this structure:

```md
# Ubiquitous Language — Locodoko

## Kartenspiel-Kern

| Begriff          | Definition                                                       | Zu vermeidende Synonyme |
| ---------------- | ---------------------------------------------------------------- | ----------------------- |
| **Stich**        | Eine Runde, in der jeder Spieler eine Karte ausspielt            | Runde, Zug              |
| **Trumpf**       | Eine Karte, die jeden Fehlfarben-Stich gewinnt                   | Trumpfkarte             |

## Relationships

- Ein **Tisch** besteht aus genau einer aktiven **Partie**
- Eine **Partie** besteht aus genau 12 **Stichen**

## Example dialogue

> **Dev:** "Wenn ein **Spieler** eine **Karte** auf den **Tisch** legt…"
> **Domain expert:** "Wir sagen: ein **Spieler** *spielt eine Karte aus* — das ergibt eine *Karte im laufenden **Stich***."

## Flagged ambiguities

- "Runde" wurde sowohl für **Stich** als auch für **Partie** verwendet — diese sind zu trennen.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously in the conversation, call it out in the "Flagged ambiguities" section with a clear recommendation.
- **Only include terms relevant for domain experts.** Skip the names of modules or classes unless they have meaning in the domain language.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include domain terms.** Skip generic programming concepts (array, function, endpoint) unless they have domain-specific meaning.
- **Group terms into multiple tables** when natural clusters emerge (e.g. by subdomain, lifecycle, or actor). Each group gets its own heading and table.
- **Write an example dialogue.** A short conversation (3-5 exchanges) between a dev and a domain expert in German that demonstrates how the terms interact naturally.

## Re-running

When invoked again in the same conversation:

1. Read the existing `UBIQUITOUS_LANGUAGE.md`
2. Incorporate any new terms from subsequent discussion
3. Update definitions if understanding has evolved
4. Re-flag any new ambiguities
5. Rewrite the example dialogue to incorporate new terms
