# Fonts

Big Shoulders, Instrument Serif, Onest and JetBrains Mono, from Google Fonts, kept here so builds
never download them. Each is licensed under the SIL Open Font License 1.1 (the `OFL-*.txt` files).

Each `.woff2` is a subset Google Fonts builds on request: Latin (U+0020–007E, U+00A0–00FF, a few
more Latin letters), general punctuation (U+2010–2027, ‰ ‹ ›), € ₹ ™, the arrows ← ↑ → ↓ ↔, − ★ ✓ ⌘.
The variable fonts keep their weight axis (Big Shoulders 700–900, Onest 100–900, JetBrains Mono
100–800). To remake one, ask the CSS API for those characters and download the `src` URL it gives:

```
https://fonts.googleapis.com/css2?family=Onest:wght@100..900&text=<the characters, URL-encoded>
```

(with a current browser's User-Agent, so the answer is WOFF2). If the app starts using a character
outside this set, add it to the request and remake the files.
