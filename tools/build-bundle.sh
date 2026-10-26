#!/usr/bin/env bash
# ============================================================================
#  tools/build-bundle.sh — rebuild the design-arsenal skills/ + examples/
#  from the 7 upstream repositories (used by .github/workflows/refresh.yml
#  and safe to run locally).
#
#  Usage:
#    bash tools/build-bundle.sh [target-dir] [repos-dir]
#
#    target-dir   output bundle root             (default: bundle)
#    repos-dir    shallow upstream clones land   (default: build/repos)
#
#  What it does:
#    1. Shallow-clone (or refresh) the 7 upstream repos.
#    2. Assemble skills/ + examples/ with the documented mappings.
#    3. Compile impeccable's SKILL.src.md template -> MANUAL.md.
#    4. Trim react-bits to ts-default/ + ts-tailwind/ and regenerate catalog.
#    5. Apply the single-tool architecture: rename every nested SKILL.md to
#       MANUAL.md and rewrite internal cross-references.
#    6. Overlay the curated bundle files (SKILL.md, index.json, install.sh,
#       README.md, ATTRIBUTION.md, demo/) from the current checkout.
#    7. Validate the result.
# ============================================================================
set -euo pipefail

TARGET_DIR="${1:-bundle}"
REPOS_DIR="${2:-build/repos}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${UPSTREAM_BRANCH:-main}"

UPSTREAMS=(
  "https://github.com/Manavarya09/design-extract"
  "https://github.com/Leonxlnx/taste-skill"
  "https://github.com/pbakaus/impeccable"
  "https://github.com/greensock/gsap-skills"
  "https://github.com/DavidHDev/react-bits"
  "https://github.com/Jakubantalik/transitions.dev"
  "https://github.com/microsoft/playwright-cli"
)

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }

clone_repo() {
  local url="$1" name; name="$(basename "$url" .git)"
  if [ -d "$REPOS_DIR/$name/.git" ]; then
    cyan "refresh $name"
    git -C "$REPOS_DIR/$name" fetch --depth 1 origin "$BRANCH"
    git -C "$REPOS_DIR/$name" reset --hard FETCH_HEAD
  else
    cyan "clone  $name (shallow)"
    git clone --quiet --depth 1 --branch "$BRANCH" "$url" "$REPOS_DIR/$name"
  fi
}

mkdir -p "$REPOS_DIR"
for url in "${UPSTREAMS[@]}"; do clone_repo "$url"; done

# Fresh assembly area
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/skills" "$TARGET_DIR/examples"

# ----------------------------------------------------------------------------
# 1) extract-design (designlang)
cyan "assemble extract-design"
cp -r "$REPOS_DIR/design-extract/skills/extract-design" "$TARGET_DIR/skills/extract-design"
mkdir -p "$TARGET_DIR/skills/extract-design/docs"
cp "$REPOS_DIR/design-extract/README.md" "$TARGET_DIR/skills/extract-design/docs/UPSTREAM-README.md"

# 2) taste (taste-skill v2) — ship the run, library, references and scripts;
#    the inner README becomes UPSTREAM-README.md; assets/ and evals/ stay upstream-only
cyan "assemble taste"
cp -r "$REPOS_DIR/taste-skill/skills/taste-skill" "$TARGET_DIR/skills/taste"
cp "$REPOS_DIR/taste-skill/skills/taste-skill/README.md" "$TARGET_DIR/skills/taste/UPSTREAM-README.md"
rm -rf "$TARGET_DIR/skills/taste/README.md" "$TARGET_DIR/skills/taste/assets" "$TARGET_DIR/skills/taste/evals"

# 3) polish (impeccable) — compile SKILL.src.md template, drop the template itself
cyan "assemble impeccable (compile SKILL.src.md -> MANUAL.md)"
mkdir -p "$TARGET_DIR/skills/impeccable"
for entry in agents reference scripts; do
  cp -r "$REPOS_DIR/impeccable/skill/$entry" "$TARGET_DIR/skills/impeccable/$entry"
done
sed \
  -e 's|{{scripts_path}}|<skill-base-dir>/scripts|g' \
  -e 's|{{command_prefix}}|/impeccable |g' \
  -e 's|{{command_hint}}|<command>|g' \
  "$REPOS_DIR/impeccable/skill/SKILL.src.md" > "$TARGET_DIR/skills/impeccable/MANUAL.md"

# 4) motion/gsap (official GSAP skills) + starter examples
cyan "assemble gsap"
cp -r "$REPOS_DIR/gsap-skills/skills/." "$TARGET_DIR/skills/gsap/"
cp -r "$REPOS_DIR/gsap-skills/examples" "$TARGET_DIR/examples/gsap"

# 5) components (react-bits) — only the two MIT source flavors, then regenerate catalog
cyan "assemble react-bits (ts-default + ts-tailwind only)"
mkdir -p "$TARGET_DIR/skills/react-bits"
cp -r "$REPOS_DIR/react-bits/src/ts-default"   "$TARGET_DIR/skills/react-bits/ts-default"
cp -r "$REPOS_DIR/react-bits/src/ts-tailwind"  "$TARGET_DIR/skills/react-bits/ts-tailwind"
node "$REPO_ROOT/tools/gen_reactbits_catalog.mjs" \
  "$REPOS_DIR/react-bits/src" "$TARGET_DIR/skills/react-bits"
cp "$REPOS_DIR/react-bits/LICENSE.md" "$TARGET_DIR/skills/react-bits/LICENSE.md"

# 6) motion/transitions (transitions.dev)
cyan "assemble transitions"
cp -r "$REPOS_DIR/transitions.dev/skills/." "$TARGET_DIR/skills/transitions/"

# 7) verify (playwright-cli)
cyan "assemble playwright-cli"
cp -r "$REPOS_DIR/playwright-cli/skills/playwright-cli" "$TARGET_DIR/skills/playwright-cli"

# ----------------------------------------------------------------------------
# Single-tool architecture: exactly ONE SKILL.md (the bundle root entry point).
# Every module's SKILL.md becomes a reference MANUAL.md and all internal
# cross-references follow.
cyan "apply single-tool architecture (SKILL.md -> MANUAL.md under skills/)"
while IFS= read -r -d '' f; do
  mv "$f" "$(dirname "$f")/MANUAL.md"
done < <(find "$TARGET_DIR/skills" -name "SKILL.md" -type f -print0)

while IFS= read -r -d '' f; do
  sed -i 's/SKILL\.md/MANUAL.md/g' "$f"
done < <(grep -rlZ 'SKILL\.md' "$TARGET_DIR/skills" 2>/dev/null || true)

# gsap llms.txt: describe the single-tool module layout instead of upstream's
# multi-skill layout (the blanket sed above already renamed SKILL.md -> MANUAL.md there)
sed -i 's|Use this file to discover which skill to load\. Each skill lives in a directory of the same name under skills/ and contains MANUAL.md\.|Use this file to discover which GSAP module to load. Each module lives in a directory of the same name under gsap/ and contains MANUAL.md (the module reference inside the single design-arsenal skill).|' "$TARGET_DIR/skills/gsap/llms.txt"

# ----------------------------------------------------------------------------
# Overlay curated bundle files from the current checkout
cyan "overlay bundle core files (SKILL.md, index.json, install.sh, README.md, ATTRIBUTION.md, demo/)"
for f in SKILL.md index.json install.sh README.md ATTRIBUTION.md; do
  cp "$REPO_ROOT/$f" "$TARGET_DIR/$f"
done
cp -r "$REPO_ROOT/demo" "$TARGET_DIR/demo"

# ----------------------------------------------------------------------------
# Validation
cyan "validate"
fail() { printf "\033[31mFAIL:\033[0m %s\n" "$1"; exit 1; }

root_skills=$(find "$TARGET_DIR" -name "SKILL.md" | wc -l)
[ "$root_skills" -eq 1 ] || fail "expected exactly 1 SKILL.md, found $root_skills"

manuals=$(find "$TARGET_DIR/skills" -name "MANUAL.md" | wc -l)
[ "$manuals" -eq 15 ] || fail "expected 15 MANUAL.md modules, found $manuals"

if grep -rq '{{' "$TARGET_DIR/skills/impeccable/MANUAL.md"; then
  fail "unresolved template variables left in impeccable MANUAL.md"
fi

if grep -rq 'SKILL\.md' "$TARGET_DIR/skills" 2>/dev/null; then
  fail "stale SKILL.md references remain under skills/"
fi

[ -f "$TARGET_DIR/skills/react-bits/catalog.json" ] || fail "catalog.json missing"
total=$(python3 -c "import json;print(json.load(open('$TARGET_DIR/skills/react-bits/catalog.json'))['totalComponents'])")
[ "$total" -gt 0 ] || fail "catalog.json has no components"

green "✓ bundle rebuilt at $TARGET_DIR — 1 SKILL.md, $manuals MANUAL.md modules, $total react-bits components"
