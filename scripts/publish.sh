#!/bin/bash
# BNB Claw - npm publish script
# Usage: ./scripts/publish.sh [patch|minor|major]

set -e

VERSION_TYPE="${1:-patch}"

echo "📦 Publishing BNB Claw packages..."

# ── Preflight checks ────────────────────────────────────────────────────────

# Ensure working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Working directory is not clean. Commit or stash your changes first."
  exit 1
fi

# Ensure we are on main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "⚠️  Warning: Publishing from branch '$CURRENT_BRANCH' (expected 'main')."
fi

# Ensure npm authentication
if ! npm whoami &>/dev/null; then
  echo "❌ Not logged in to npm. Run 'npm login' first."
  exit 1
fi

# ── Tests ────────────────────────────────────────────────────────────────────

echo "🧪 Running tests..."
pnpm test

# ── Build ────────────────────────────────────────────────────────────────────

echo "🔨 Building packages..."
pnpm build

# ── Version bump ─────────────────────────────────────────────────────────────

echo "📝 Bumping version ($VERSION_TYPE)..."
pnpm -r exec -- npm version "$VERSION_TYPE" --no-git-tag-version

# Bump root package too
npm version "$VERSION_TYPE" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
echo "   New version: v$NEW_VERSION"

# ── Changelog ────────────────────────────────────────────────────────────────

CHANGELOG_ENTRY="## v$NEW_VERSION ($(date -u +%Y-%m-%d))

### Changes
$(git log --oneline "$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)"..HEAD 2>/dev/null || echo '- Initial release')
"

if [[ -f CHANGELOG.md ]]; then
  # Prepend new entry after first line (title)
  TMP=$(mktemp)
  head -1 CHANGELOG.md > "$TMP"
  echo "" >> "$TMP"
  echo "$CHANGELOG_ENTRY" >> "$TMP"
  tail -n +2 CHANGELOG.md >> "$TMP"
  mv "$TMP" CHANGELOG.md
else
  printf "# Changelog\n\n%s" "$CHANGELOG_ENTRY" > CHANGELOG.md
fi

# ── Git commit & tag ──────────────────────────────────────────────────────────

git add -A
git commit -m "chore: release v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# ── Publish ──────────────────────────────────────────────────────────────────

echo "🚀 Publishing packages to npm..."
pnpm -r publish --access public --no-git-checks

# ── Push ─────────────────────────────────────────────────────────────────────

echo "⬆️  Pushing git commits and tag..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Successfully published v$NEW_VERSION!"
echo "   📦 @bnb-claw/core@$NEW_VERSION"
echo "   📦 @bnb-claw/modules@$NEW_VERSION"
echo "   🏷️  git tag: v$NEW_VERSION"
