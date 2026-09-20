# Qiqihar University Scholarship Test — Result Portal

齐齐哈尔大学奖学金考试 — Login portal to view your Qiqihar University Scholarship
Test result.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Project structure

```
  src/
    App.tsx                 # login → result flow + session persistence
    types.ts                # shared types (Account, Session, Result)
    data/
      credentials.json      # account registry (username, password, id, result, score)
    lib/
      auth.ts               # credential lookup against credentials.json
    components/
      HomePage.tsx          # login form
      ResultPage.tsx        # personalized pass/fail result display
```

## Notes

- `src/data/credentials.json` holds the three result accounts. It is a **demo
  registry**: authentication runs entirely in the browser, so the file ships
  inside the bundle and is visible to anyone. For a real deployment, replace it
  with a server-side authentication service and never expose passwords or
  results.
- Each signed-in candidate sees **only their own result** — no other student's
  name, ID or score is ever rendered.
- A failed login attempt shows: "Account not found. Please contact administration."
