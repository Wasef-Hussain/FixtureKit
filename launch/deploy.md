# Deploy FixtureKit

Run these from `D:\WorkStuff\FixtureKit` after the repo is ready.

## 1. GitHub (public repo)

```powershell
gh auth login
gh repo create fixturekit --public --source=. --remote=origin --push
```

If the repo name is taken, pick another and replace `PLACEHOLDER` in the launch posts with your GitHub username.

Set repo description:

```powershell
gh repo edit --description "Paste a TypeScript interface or Zod schema → get fixture code"
gh repo edit --add-topic typescript --add-topic zod --add-topic testing --add-topic fixtures --add-topic developer-tools
```

## 2. Vercel

```powershell
npx vercel login
npx vercel link
npx vercel --prod
```

Live URL: `https://fixture-kit.vercel.app`

If `VERCEL_TOKEN` is set in your environment and deploy fails with "token is not valid", unset it first:

```powershell
Remove-Item Env:VERCEL_TOKEN
```

## 3. After deploy

Replace `PLACEHOLDER` in these files with your GitHub username:

- `launch/hackernews.md`
- `launch/devto.md`
- `launch/reddit.md`

Verify the live URL works (TypeScript + Zod modes).

## 4. Post (Day 1)

1. **r/typescript** — copy from `launch/reddit.md`
2. **Show HN** — copy from `launch/hackernews.md` (weekday 9–11 AM EST)
3. **DEV.to** — copy from `launch/devto.md`

Track for 7 days: visitors, comments, GitHub stars, schema patterns that break.
