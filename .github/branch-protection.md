# Branch Protection Setup

## Quick Setup via GitHub CLI

Since `gh` CLI requires authentication, follow these steps:

### 1. Authenticate GitHub CLI

```bash
gh auth login
```

Follow the prompts to authenticate.

### 2. Enable Branch Protection on `main`

```bash
# Protect main branch with required CI checks
gh api repos/digisapp/digis-app/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=quality-gates \
  --field required_status_checks[contexts][]=accessibility \
  --field enforce_admins=false \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field required_pull_request_reviews[require_code_owner_reviews]=false \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## Manual Setup via GitHub UI

If CLI doesn't work, set up via GitHub web interface:

### Step-by-Step Instructions

1. **Go to Repository Settings**
   - Navigate to: https://github.com/digisapp/digis-app/settings

2. **Navigate to Branches**
   - Click "Branches" in the left sidebar
   - Click "Add rule" or "Edit" for `main` branch

3. **Configure Protection Rules**

   #### Required Checks
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging
   - Required status checks:
     - `quality-gates` (Frontend CI)
     - `accessibility` (Frontend CI)

   #### Pull Request Reviews
   - [x] Require a pull request before merging
   - [x] Require approvals: **1**
   - [x] Dismiss stale pull request approvals when new commits are pushed
   - [ ] Require review from Code Owners (optional)

   #### Additional Restrictions
   - [x] Require conversation resolution before merging
   - [ ] Require signed commits (optional, recommended)
   - [ ] Require deployments to succeed before merging (optional)
   - [x] Lock branch (prevent all pushes, including admins) - **OFF**
   - [x] Do not allow bypassing the above settings - **ON**

   #### Force Push Settings
   - [ ] Allow force pushes - **OFF**
   - [ ] Allow deletions - **OFF**

4. **Click "Create" or "Save changes"**

## Verification

After setup, verify branch protection is active:

```bash
# Check protection status
gh api repos/digisapp/digis-app/branches/main/protection | jq '.'
```

Or manually:
1. Try to push directly to `main` - should be blocked
2. Create a PR and verify CI runs
3. Try to merge without approvals - should be blocked

## Current CI Workflows

Your repository has the following workflows that run on PRs:

### Frontend CI (`.github/workflows/frontend-ci.yml`)
- **Triggers**: PRs and pushes to `main` affecting frontend code
- **Jobs**:
  1. `quality-gates` - Lint, typecheck, tests, build
  2. `accessibility` - A11y linting
  3. `summary` - Aggregate results

**Required checks**: `quality-gates`, `accessibility`

### Other Workflows
- `ci.yml` - General CI
- `ci-cd.yml` - Full CI/CD pipeline
- `security-audit.yml` - Security scanning
- `staging-deploy.yml` - Staging deployments
- `deploy-preview.yml` - Preview deployments

## Recommended Next Steps

### 1. Add CODEOWNERS file

Create `.github/CODEOWNERS`:

```
# Default owners for everything
* @yourusername

# Frontend code
/frontend/ @frontend-team

# Backend code
/backend/ @backend-team

# Security-sensitive files
/backend/routes/auth.js @security-team
/backend/routes/payments.js @security-team
SECURITY_BEST_PRACTICES.md @security-team
```

### 2. Enable Signed Commits

Require all commits to be signed with GPG:

```bash
# Enable signed commits requirement
gh api repos/digisapp/digis-app/branches/main/protection \
  --method PUT \
  --field required_signatures[enabled]=true
```

Then set up GPG signing locally:

```bash
# Generate GPG key
gpg --full-generate-key

# List keys
gpg --list-secret-keys --keyid-format=long

# Add to GitHub
gpg --armor --export YOUR_KEY_ID
# Paste into GitHub Settings → SSH and GPG keys

# Configure git
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
```

### 3. Add PR Template

Create `.github/pull_request_template.md`:

```markdown
## Description
<!-- Describe your changes -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing performed

## Security Checklist
- [ ] No sensitive data exposed
- [ ] Input validation added
- [ ] Authentication checked
- [ ] RLS policies updated (if database changes)

## Deployment Notes
<!-- Any special deployment considerations -->
```

## Troubleshooting

### "Required status checks not found"
- Ensure CI workflow has run at least once
- Check workflow names match exactly in branch protection settings

### "Cannot push to protected branch"
- This is expected! Create a branch and PR instead:
  ```bash
  git checkout -b feature/my-feature
  git push origin feature/my-feature
  gh pr create
  ```

### "CI not running on PR"
- Check workflow trigger paths in `.github/workflows/*.yml`
- Ensure PR changes match the `paths` filters

## Disable Protection (Emergency Only)

If you need to disable protection temporarily:

```bash
# Remove protection (use with caution!)
gh api repos/digisapp/digis-app/branches/main/protection \
  --method DELETE
```

**Remember to re-enable after emergency fix!**
