# Qiqihar University Test Portal

The official Qiqihar University (齐齐哈尔大学) entrance-assessment portal, built with
**React 19 + TypeScript + Vite + Tailwind CSS v4**.

## What it does

- **Home / login** — candidates sign in with the username and password issued to
  them, stored in `src/data/credentials.json` (demo accounts are shown on the
  login page). The examination rules & marking scheme are displayed alongside.
- **Four papers**, each with **48 multiple-choice questions** and a **45-minute
  countdown timer**:
  | Paper | Chinese | Content |
  |---|---|---|
  | Physics | 物理 | mechanics, electromagnetism, waves, optics, modern physics |
  | Chemistry | 化学 | atomic structure, bonding, reactions, acids & bases, organics |
  | Mathematics | 数学 | algebra, geometry, trigonometry, probability, calculus |
  | English | 英语 | grammar, vocabulary, reading comprehension |
- **Rules replay** — the full examination rules & code of conduct are shown on the
  home page and **replayed after registration, right before the camera check**,
  requiring explicit consent before the candidate can proceed.
- **Proctoring (strict mode)** — before each paper the candidate must pass a
  **live camera test** and a **room scan**. The camera test repeats until it
  passes (there is **no 3-attempt limit**): the candidate must show a working
  feed with exactly one person visible, adequate lighting, and — via a bundled
  **MediaPipe Face Landmarker** model (fully offline) — must be **looking
  directly at the camera** (iris tracking). Denying camera access is the only
  automatic disqualification at this stage. The room scan pans the camera; a
  second person (face model or pixel heuristics) or unusual lighting/activity
  fails it. The camera then **monitors the candidate for the entire test**: the
  face model counts people and tracks gaze while the pixel heuristics check
  lighting and motion. Any violation — another person in the room, the
  candidate leaving the frame or facing away from the camera, not looking at
  the camera, a lost/frozen feed, leaving the browser tab, or rapid movement —
  **automatically disqualifies the candidate** (a second person or a dead feed
  disqualifies almost immediately; sustained behaviour within a few seconds):
  all papers are locked and a disqualification notice with the reason is shown
  and persisted.
- **Test runner** — sticky countdown (turns red under 5 minutes, auto-submits at
  zero), question palette with answered/flagged/current states, flag-for-review,
  clear response, keyboard shortcuts (A–D, ←/→, F), submit confirmation dialog.
- **One attempt per paper** — once a paper is submitted it is locked forever: it
  cannot be retaken or changed. Completed papers only show a **Review result**
  action, and after submission the candidate must **wait for the result** (3-day
  countdown) before the score is announced.
- **Submission** — after submitting (or when the timer expires), the candidate
  sees a confirmation screen; results are announced **three days later** with a
  live countdown.
- **Results** — once announced, score, accuracy, verdict, time used, and a full
  per-question answer review with filters (correct / incorrect / skipped /
  flagged).
- **Progress persistence** — everything (candidate + answers) is saved to
  `localStorage`, so you can leave and resume a paper while the clock keeps
  running.

Scoring: **+1 per correct answer**, no negative marking (raw score out of 48 per
paper, 192 overall).

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Project structure

```  src/
    App.tsx                 # routing + exam state machine + localStorage persistence
    types.ts                # shared types
    data/
      exams.ts              # subject metadata (48 Q, 45 min each)
      physics.ts chemistry.ts math.ts english.ts   # question banks
      questions.ts          # lookup helper
      credentials.json      # candidate username/password registry (demo only)
    lib/
      exam.ts               # grading + time formatting helpers
      auth.ts               # credential lookup against credentials.json
      proctor.ts            # camera frame analysis + continuous monitoring hook
    components/
      HomePage.tsx          # hero, rules, registration
      SubjectsPage.tsx      # paper selection + progress + results table
      CameraTest.tsx        # mandatory pre-test camera verification
      RoomCheck.tsx         # pre-test room scan (pan camera)
      DisqualifiedPage.tsx  # automatic-disqualification screen
      TestPage.tsx          # timer, palette, question UI, submit/exit dialogs
      ResultsPage.tsx       # score slip + answer review
      Header.tsx
```

## Notes

- `src/data/credentials.json` holds candidate accounts (username + password). It is a
  **demo registry**: authentication runs entirely in the browser, so the file ships inside the
  bundle and is visible to anyone. For a real deployment, replace it with a server-side
  authentication service and never expose passwords.
- Each paper allows **exactly one attempt**. Results are announced three days after
  submission and are final — there is no retake.
- The question banks in `src/data/*.ts` are assessment-style items to be replaced with the
  official Qiqihar University Test question sets when available (each file is a simple array of
  48 entries).
- Exam code / university contact details in the footer are placeholders.
