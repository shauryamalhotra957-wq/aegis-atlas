# GitHub Publish

The project is published at:

```text
https://github.com/shauryamalhotra957-wq/aegis-atlas
```

The local repository tracks:

```text
origin/main
```

For future updates:

```powershell
git status -sb
npm run check
git add -A
git commit -m "Describe the update"
git push
```

If the remote ever needs to be recreated from a fresh clone, GitHub CLI is installed at:

```powershell
C:\Program Files\GitHub CLI\gh.exe
```

The included helper script checks authentication, verifies the working tree is clean, and pushes `main`:

```powershell
.\scripts\publish-github.ps1
```
