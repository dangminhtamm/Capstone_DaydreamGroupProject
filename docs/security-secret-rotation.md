# Secret Rotation and Git History Cleanup

The repository previously contained live credentials in a committed document.
Treat every value that appeared there as compromised, even after replacing it
with a placeholder in the current branch.

## 1. Rotate credentials first

Rotate or revoke these credentials in their provider dashboards:

- Supabase database password and connection strings
- Supabase JWT signing key, publishable/anon key, and secret/service-role key
- Tuturuuu metered AI API key
- Any Render/Vercel runtime secret and publishable key that was exposed
- Google OAuth client secret if it ever appeared in Git or shared logs

Update the new values only in local `.env` files and deployment environment
settings. Never paste live values into Markdown, issues, commits, screenshots,
or chat logs.

Prefer Supabase's asymmetric JWT signing keys and the newer publishable/secret
API keys. This codebase already validates ES256 access tokens through the
project JWKS endpoint. Keep `SUPABASE_JWT_SECRET` only while legacy HS256 tokens
are still accepted; `SUPABASE_PROJECT_ID` and `SUPABASE_JWKS_URL` support the
asymmetric path.

Create and deploy the replacement Supabase keys before disabling the legacy
keys. After an emergency legacy JWT-secret revocation, sign in again before
testing the API because existing HS256 sessions may no longer be accepted.

## 2. Remove the old values from Git history

Coordinate this with the team because rewriting history changes commit IDs and
requires a force push. Make a protected backup clone before continuing.

Install `git-filter-repo`, then rewrite a fresh mirror clone. Do not run the
history rewrite in a dirty working directory:

```bash
brew install git-filter-repo
cp docs/secret-replacements.example.txt /tmp/second-brain-secret-replacements.txt
# Edit /tmp/second-brain-secret-replacements.txt and replace each OLD_VALUE.
git clone --mirror YOUR_GITHUB_REPOSITORY_URL /tmp/second-brain-cleanup.git
cd /tmp/second-brain-cleanup.git
git filter-repo --replace-text /tmp/second-brain-secret-replacements.txt --force
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push --force --mirror origin
```

`git-filter-repo` intentionally removes the original remote, which is why the
command adds `origin` again before pushing.

Every teammate must re-clone the repository after the force push. Old clones,
forks, CI logs, release archives, and copied files can still contain the leaked
values, which is why rotation is mandatory even after history cleanup.

## 3. Enable GitHub protections

In GitHub, open **Settings > Security > Advanced Security** and enable:

- Secret scanning
- Push protection
- Dependabot alerts
- Dependabot security updates

If the repository belongs to an organization, enable the same controls in the
organization security settings so new repositories inherit them.

## 4. Verify

Run these checks before inviting the team back to the rewritten repository:

```bash
git grep -n -e 'ttr_ai_' -e 'service_role' -e 'postgresql://prisma.'
git log -S 'OLD_SECRET_FRAGMENT' --all --oneline
pnpm db:migrate:deploy
pnpm build
pnpm test
```

The first two commands must not reveal live credentials. Placeholder examples
are acceptable.
