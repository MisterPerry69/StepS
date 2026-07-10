# StepS

PWA "blueprint" che raccoglie i tuoi progetti e li scompone (chunking) in un
piano ad albero di passi concreti. L'AI (Gemini) ti fa qualche domanda per
sviscerare il progetto e poi genera il piano, mettendo in cima gli step di
**preparazione** che di solito si saltano.

Parte dell'ecosistema BrainDump.

## Come si usa

1. Configura il backend: segui `gas/SETUP.md` (Google Apps Script + Google
   Sheet + chiave Gemini free tier). C'è una funzione `setAll()` che fa tutto
   in un colpo: crea lo Sheet e salva la chiave.
2. Incolla l'URL del Web App in `config.js` (`GAS_URL`).
3. Apri `index.html` (o installala come PWA da un server statico).
4. "+ NUOVO PROGETTO" → descrivi → rispondi alle domande (una alla volta) →
   ottieni il piano.
5. Spunta gli step; usa "⊕ SCOMPONI" quando uno step ti sembra ancora troppo grosso.

## Struttura

- `index.html` / `style.css` — guscio e stile blueprint (blu cianografia, font Outfit).
- `engine.js` — logica pura (albero + progresso). Test: `node engine.test.js`.
- `api.js` — client verso il GAS (unico punto che fa fetch).
- `app.js` — UI (home, creazione guidata, piano).
- `config.js` — URL del backend + modello AI.
- `gas/Code.gs` — backend Apps Script (Sheet + Gemini) con funzioni di setup one-click.
- `gas/SETUP.md` — istruzioni passo-passo per il backend.
- `manifest.webmanifest` / `sw.js` / `icon-*.png` — PWA installabile.

## Modello dati (Google Sheet)

- **Projects**: id, title, description, emoji, color, status, createdAt, updatedAt
- **Steps**: id, projectId, parentId, text, order, done, kind
  - `parentId` crea l'albero; `kind` etichetta (es. `prep`) senza nascondere nulla.

## Test

```bash
node engine.test.js
```

## Note

- L'app richiede connessione (i dati stanno sul tuo Google Drive via GAS).
- La chiave Gemini vive solo nelle Script Properties del GAS, mai nel front-end.
