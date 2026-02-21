# Publishing to npm - Complete Guide

## 📋 Prerequisites

1. **npm account** - Create one at https://www.npmjs.com/signup
2. **Email verification** - Verify your email address
3. **Two-Factor Authentication** (recommended) - Enable 2FA for security

---

## 🚀 Step-by-Step Publishing Process

### Step 1: Login to npm

```bash
cd /Users/aungsithu/.openclaw/workspace/ai-sales-agent-sdk-standalone
npm login
```

You'll be prompted for:
- **Username:** Your npm username
- **Password:** Your npm password
- **Email:** Your public email (this will be visible on npm)
- **OTP:** (if 2FA is enabled)

**Verify login:**
```bash
npm whoami
```

---

### Step 2: Check Package Name Availability

```bash
npm search ai-sales-agent-sdk
```

If the name is taken, you have options:
1. Use a scoped package: `@yourusername/ai-sales-agent-sdk`
2. Choose a different name: `ai-sales-chatbot-sdk`, `conversational-commerce-sdk`, etc.

**To use scoped package:**
Edit `package.json`:
```json
{
  "name": "@mmad2021/ai-sales-agent-sdk",
  ...
}
```

---

### Step 3: Pre-Publish Checklist

Run these commands to verify everything is ready:

```bash
# 1. Check for syntax errors
npm run check

# 2. Test the example still works
npm run example:basic

# 3. Verify what will be published (dry run)
npm publish --dry-run
```

The dry-run will show:
- All files that will be included
- Package size
- Any warnings or errors

---

### Step 4: Publish to npm

**For first publish (v0.1.0):**

```bash
npm publish
```

**If using scoped package (private by default):**
```bash
npm publish --access public
```

**Expected output:**
```
+ ai-sales-agent-sdk@0.1.0
```

---

### Step 5: Verify Publication

```bash
# Check on npm registry
npm view ai-sales-agent-sdk

# Or visit in browser
open https://www.npmjs.com/package/ai-sales-agent-sdk
```

---

## 📦 Testing the Published Package

### Test with npm (in a new project)

```bash
mkdir test-sdk
cd test-sdk
npm init -y
npm install ai-sales-agent-sdk
```

```javascript
// test.js
import { AISalesAgent } from 'ai-sales-agent-sdk';
console.log('SDK imported successfully!', AISalesAgent);
```

```bash
node test.js
```

### Test with Bun

```bash
bun init
bun add ai-sales-agent-sdk
bun run test.js
```

### Test with Deno

```javascript
// test-deno.js
import { AISalesAgent } from 'npm:ai-sales-agent-sdk@0.1.0';
console.log('SDK imported successfully!', AISalesAgent);
```

```bash
deno run --allow-net --allow-read test-deno.js
```

---

## 🔄 Publishing Updates

### Version Bumping

```bash
# Patch version (0.1.0 → 0.1.1) - bug fixes
npm version patch

# Minor version (0.1.0 → 0.2.0) - new features
npm version minor

# Major version (0.1.0 → 1.0.0) - breaking changes
npm version major
```

This automatically:
- Updates `package.json`
- Creates a git commit
- Creates a git tag

### Publish the New Version

```bash
git push origin main --tags
npm publish
```

---

## 🏷️ Publishing with Tags

**Beta/Alpha releases:**

```bash
# Publish as beta
npm version 0.2.0-beta.1
npm publish --tag beta

# Install beta
npm install ai-sales-agent-sdk@beta
```

**Latest (default) tag:**

```bash
npm publish --tag latest
```

---

## 🛡️ Security Best Practices

### 1. Enable Two-Factor Authentication

```bash
npm profile enable-2fa auth-and-writes
```

### 2. Use `.npmignore` (if needed)

Create `.npmignore` to exclude files not needed in the package:

```
# .npmignore
.git/
.github/
node_modules/
*.log
.env
.DS_Store
tests/
coverage/
.vscode/
.idea/
```

**Note:** We're already using the `files` field in `package.json`, which is cleaner.

### 3. Review Before Publishing

Always run:
```bash
npm publish --dry-run
```

---

## 📊 Post-Publish

### Update README Badge

Add npm version badge to README.md:

```markdown
[![npm version](https://img.shields.io/npm/v/ai-sales-agent-sdk.svg)](https://www.npmjs.com/package/ai-sales-agent-sdk)
[![npm downloads](https://img.shields.io/npm/dm/ai-sales-agent-sdk.svg)](https://www.npmjs.com/package/ai-sales-agent-sdk)
```

### Create GitHub Release

```bash
# After publishing
gh release create v0.1.0 --title "v0.1.0 - Initial Release" --notes "First public release of AI Sales Agent SDK"
```

---

## 🚨 Troubleshooting

### "Package name already exists"

**Solution 1:** Use scoped package
```json
{ "name": "@mmad2021/ai-sales-agent-sdk" }
```

**Solution 2:** Choose different name
```json
{ "name": "ai-conversational-commerce-sdk" }
```

### "Need auth" Error

```bash
npm logout
npm login
```

### "Payment required"

Scoped packages are private by default. Publish with:
```bash
npm publish --access public
```

### "Invalid version"

Ensure version follows semver: `major.minor.patch` (e.g., `0.1.0`, `1.2.3`)

---

## 📝 Quick Reference Commands

```bash
# Login
npm login

# Check login
npm whoami

# Dry run (test publish)
npm publish --dry-run

# Publish (public)
npm publish --access public

# Version bump
npm version patch|minor|major

# View package info
npm view ai-sales-agent-sdk

# Unpublish (only within 72 hours)
npm unpublish ai-sales-agent-sdk@0.1.0 --force
```

---

## 🎯 Recommended Workflow

### First Time Publishing

```bash
# 1. Ensure you're in the SDK directory
cd /Users/aungsithu/.openclaw/workspace/ai-sales-agent-sdk-standalone

# 2. Login to npm
npm login

# 3. Check package name
npm search ai-sales-agent-sdk

# 4. Dry run
npm publish --dry-run

# 5. Publish!
npm publish --access public

# 6. Verify
npm view ai-sales-agent-sdk

# 7. Test install
cd /tmp && mkdir test-sdk && cd test-sdk
npm init -y
npm install ai-sales-agent-sdk
```

### Updating the Package

```bash
# 1. Make changes
# ... edit files ...

# 2. Commit changes
git add .
git commit -m "feat: Add new feature"

# 3. Bump version
npm version patch  # or minor/major

# 4. Push to GitHub
git push origin main --tags

# 5. Publish to npm
npm publish

# 6. Verify
npm view ai-sales-agent-sdk
```

---

## 💡 Pro Tips

1. **Use semantic versioning:**
   - `0.x.x` = Pre-release (API may change)
   - `1.0.0` = First stable release
   - `1.x.x` = Stable (backwards compatible)

2. **Keep a CHANGELOG.md:**
   Document all changes for each version

3. **Test before publishing:**
   Always run `npm publish --dry-run` first

4. **Use tags for pre-releases:**
   Keep `latest` tag stable, use `beta`/`alpha` for testing

5. **Automate with GitHub Actions:**
   Auto-publish on tag push

---

## 🔗 Useful Links

- **npm Documentation:** https://docs.npmjs.com/
- **Semantic Versioning:** https://semver.org/
- **npm Registry:** https://www.npmjs.com/
- **Package Search:** https://www.npmjs.com/search?q=ai-sales-agent-sdk

---

**Ready to publish?** Run `npm login` and follow the steps above! 🚀
