# Contributing

## Publishing

### Open VSX

Once your Open VSX account is set up and you are logged in, publish with:

```bash
npm run publish:ovsx
```

### VS Code Marketplace

To publish to the VS Code Marketplace, you need a Personal Access Token (PAT)
from Azure DevOps with `Marketplace (Manage)` scope. Log in once with:

```bash
npx vsce login lorenzwalthert
```

Then publish with:

```bash
npm run publish
```
