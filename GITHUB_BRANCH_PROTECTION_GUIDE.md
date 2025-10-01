# GitHub Branch Protection Setup Guide

## 🔒 Protect Your Main Branch

Enable branch protection rules to prevent accidental breaking changes and enforce quality standards.

---

## ⚡ Quick Setup (5 Minutes)

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/digis-app`
2. Click **Settings** tab
3. Click **Branches** in the left sidebar

### Step 2: Add Branch Protection Rule

1. Click **Add branch protection rule**
2. In "Branch name pattern", enter: `main` (or `master` if that's your primary branch)

### Step 3: Configure Protection Rules

Enable these settings:

#### ✅ **Required:**

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [ ] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Add status checks (if CI is configured):
    - `ci` (GitHub Actions)
    - `test` (if separate test workflow)
    - `lint` (if separate lint workflow)

- [x] **Require conversation resolution before merging**
  - Ensures all PR comments are resolved

- [x] **Require linear history**
  - Prevents merge commits, keeps clean git history

#### ⚠️ **Recommended:**

- [x] **Do not allow bypassing the above settings**
  - Even admins must follow rules

- [ ] **Allow force pushes** - **LEAVE UNCHECKED**
  - Force pushes can overwrite history

- [ ] **Allow deletions** - **LEAVE UNCHECKED**
  - Prevents accidental branch deletion

#### 🔐 **Optional (Team Collaboration):**

- [ ] **Require deployments to succeed before merging**
  - Use if you have staging deployments

- [ ] **Lock branch**
  - Use only for truly read-only branches

### Step 4: Save Changes

Click **Create** or **Save changes** at the bottom

---

## 🎯 What Each Setting Does

### Require Pull Request Before Merging

**Effect:** Can't push directly to main branch

**Benefits:**
- ✅ All code goes through review
- ✅ Prevents accidental commits to main
- ✅ Creates audit trail of changes

**Workflow:**
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push to GitHub
git push origin feature/my-feature

# Open Pull Request on GitHub
# Review & merge through GitHub UI
```

---

### Require Status Checks to Pass

**Effect:** CI tests must pass before merging

**Benefits:**
- ✅ Broken code can't be merged
- ✅ Automated quality gate
- ✅ Catches bugs early

**Required Status Checks:**

1. **CI Workflow** - Tests, lint, build must pass
2. **E2E Tests** - All Playwright tests pass
3. **Security Checks** - CodeQL security scan

**How to Add:**
1. Enable branch protection
2. Make a test PR that triggers CI
3. After CI runs, return to branch protection settings
4. The CI check will now appear as an option to require

---

### Require Conversation Resolution

**Effect:** All PR comments must be resolved

**Benefits:**
- ✅ No unaddressed feedback
- ✅ Forces discussion completion
- ✅ Cleaner PR process

**Workflow:**
```
Reviewer: "This function needs error handling"
Author: [Adds error handling]
Author: Clicks "Resolve conversation"
```

---

### Require Linear History

**Effect:** No merge commits allowed, only fast-forward or rebase

**Benefits:**
- ✅ Clean, linear git history
- ✅ Easier to read git log
- ✅ Simpler to revert changes

**Before:**
```
*   Merge branch 'feature' (messy)
|\
| * Add feature
* | Unrelated change
```

**After:**
```
* Add feature (clean)
* Unrelated change
```

---

## 📋 Status Checks Configuration

### GitHub Actions Required Checks

Add these status checks if you have CI configured:

1. **CI Workflow**
   - Status check name: `ci` or `CI`
   - Runs: lint, type-check, test, build

2. **E2E Tests**
   - Status check name: `e2e` or `test-e2e`
   - Runs: Playwright E2E tests

3. **Security Scan**
   - Status check name: `codeql` or `CodeQL`
   - Runs: GitHub CodeQL analysis

### Finding Status Check Names

1. Make a pull request
2. Wait for CI to run
3. Go to branch protection settings
4. The status checks will appear in a searchable list

---

## 🚀 Recommended Workflow

### For Solo Development

```
main (protected)
  ↓
feature/new-feature (your branch)
  ↓
Pull Request → CI passes → Merge
```

**Settings:**
- ✅ Require PR
- ✅ Require status checks (if CI configured)
- ⚠️ Don't require approval (you're solo)
- ✅ Require linear history

### For Team Development

```
main (protected)
  ↓
develop (protected)
  ↓
feature/new-feature (developer branch)
  ↓
PR to develop → Review → CI → Merge
  ↓
PR develop to main → Final review → Merge
```

**Settings:**
- ✅ Require PR
- ✅ Require 1-2 approvals
- ✅ Require status checks
- ✅ Require conversation resolution
- ✅ Require linear history
- ✅ Dismiss stale reviews

---

## 🔧 Bypass Branch Protection (Emergency Only)

### When You Might Need to Bypass:

- 🚨 Critical production hotfix
- 🔒 Repository access issues
- 📝 Documentation-only changes

### How to Temporarily Bypass:

**Option 1: Temporarily Disable Protection**
1. Go to Settings → Branches
2. Edit branch protection rule
3. Temporarily disable required checks
4. **Re-enable immediately after fix**

**Option 2: Use Admin Override** (if enabled)
1. Create PR as usual
2. Click "Merge without waiting for requirements"
3. **Only use in true emergencies**

⚠️ **Important:** Always re-enable protections after emergency fixes

---

## 📊 Monitoring Branch Protection

### Check Protection Status

```bash
# Via GitHub CLI
gh api repos/YOUR_USERNAME/digis-app/branches/main/protection

# Response shows all protection rules
```

### View Protection Rules on GitHub

1. Go to Settings → Branches
2. See all rules listed
3. Edit or delete as needed

---

## 🎓 Best Practices

### ✅ DO:

- Enable protection on `main` and `master`
- Require status checks if you have CI
- Require linear history for clean history
- Document your branch strategy
- Train team on protected branch workflow

### ❌ DON'T:

- Allow force pushes to main
- Allow deletions of protected branches
- Bypass protection rules casually
- Forget to re-enable after disabling
- Push secrets to protected branches (GitHub blocks this anyway)

---

## 🐛 Troubleshooting

### "Status check not found"

**Solution:**
1. Create a PR and trigger CI
2. Wait for CI to complete
3. Return to branch protection settings
4. The status check will now be available

### "Can't push to main"

**Expected behavior!** Use this workflow:
```bash
git checkout -b feature/my-feature
git push origin feature/my-feature
# Then create PR on GitHub
```

### "Status checks failing"

**Fix the issue first:**
```bash
# Run tests locally
pnpm test

# Fix failing tests
# Commit fixes
git commit -m "Fix failing tests"

# Push updates
git push
```

### "Need to bypass for hotfix"

**Temporarily disable:**
1. Settings → Branches → Edit rule
2. Uncheck status checks temporarily
3. Merge hotfix
4. **Immediately re-enable protections**

---

## 📚 Additional Resources

### GitHub Documentation

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [Required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)

### Your CI/CD Workflows

- `.github/workflows/ci.yml` - Main CI workflow
- Tests run automatically on PR
- Branch protection enforces passing tests

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Can't push directly to main branch
- [ ] Must create PR to merge changes
- [ ] CI runs automatically on PR
- [ ] Can't merge until CI passes (if configured)
- [ ] All PR comments must be resolved
- [ ] Git history remains linear

**Test it:**
```bash
# This should fail:
git checkout main
echo "test" >> README.md
git commit -am "Test"
git push origin main
# Error: protected branch

# This should work:
git checkout -b test-protection
git push origin test-protection
# Create PR on GitHub → Success!
```

---

## 🎉 Summary

**Time to Set Up:** 5 minutes
**Protection Level:** High
**Maintenance:** None (automatic)

### What You Get:

- 🛡️ **Protection** from accidental commits to main
- ✅ **Quality gates** with required CI checks
- 👥 **Code review** enforcement
- 📝 **Clean history** with linear commits
- 🔍 **Audit trail** of all changes

### Recommended Settings:

```
Branch: main
✅ Require pull request (1 approval for teams, 0 for solo)
✅ Require status checks (if CI configured)
✅ Require conversation resolution
✅ Require linear history
❌ Do NOT allow force pushes
❌ Do NOT allow deletions
```

---

**Setup Complete!** Your main branch is now protected. 🎉

**Last Updated:** 2025-10-01
**Time Required:** 5 minutes
**Difficulty:** Easy
**Impact:** High
