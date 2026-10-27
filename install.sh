#!/usr/bin/env bash
# ============================================================================
#  design-arsenal installer & manager — ONE tool (v2.1.0)
#  Multi-platform: Claude Code, Codex, Gemini CLI, Cursor, Windsurf, OpenCode,
#  or any project-local skills folder.
#
#  Installs the whole arsenal as a SINGLE skill named `design-arsenal`:
#  one SKILL.md entry point, 13 internal modules (7 upstream + 6 original),
#  no per-module installation.
#
#  Usage:
#    ./install.sh                     # install (auto-detect target, project-local first)
#    ./install.sh claude              # install to ~/.claude/skills/design-arsenal
#    ./install.sh codex               # install to ~/.codex/skills/design-arsenal
#    ./install.sh gemini              # install to ~/.gemini/skills/design-arsenal
#    ./install.sh cursor              # install to ./.cursor/skills/design-arsenal
#    ./install.sh windsurf            # install to ./.windsurf/skills/design-arsenal
#    ./install.sh opencode            # install to ./.opencode/skills/design-arsenal
#    ./install.sh project             # install to ./skills/design-arsenal
#    ./install.sh --dest /any/path    # install to a custom directory
#    ./install.sh --list              # show the tool + its module table
#    ./install.sh doctor              # verify package/install integrity
#    ./install.sh update              # update this copy (git pull, or latest release zip)
# ============================================================================
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_NAME="design-arsenal"
REPO="CTO-DRS/design-arsenal"

cyan()   { printf "\033[36m%s\033[0m\n" "$1"; }
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

usage() {
  cat <<EOF
design-arsenal — ONE tool, 13 internal modules (v2.4.2)

  install [target]   install (targets: claude codex gemini cursor windsurf
                     opencode project, or --dest <path>; default: auto-detect)
  --list | list      show the entry point and module table
  doctor             verify package structure & references (exit 0 = healthy)
  update             update this copy: git pull if a clone, else latest release
  -h | --help        this help
EOF
}

resolve_dest() {
  local target="${1:-auto}"
  case "$target" in
    claude)   echo "${HOME}/.claude/skills/${BUNDLE_NAME}" ;;
    codex)    echo "${HOME}/.codex/skills/${BUNDLE_NAME}" ;;
    gemini)   echo "${HOME}/.gemini/skills/${BUNDLE_NAME}" ;;
    cursor)   echo ".cursor/skills/${BUNDLE_NAME}" ;;
    windsurf) echo ".windsurf/skills/${BUNDLE_NAME}" ;;
    opencode) echo ".opencode/skills/${BUNDLE_NAME}" ;;
    project)  echo "./skills/${BUNDLE_NAME}" ;;
    --dest)   shift; echo "$1" ;;
    auto)
      if   [ -d "${HOME}/.claude" ]; then echo "${HOME}/.claude/skills/${BUNDLE_NAME}"
      elif [ -d "${HOME}/.codex" ];  then echo "${HOME}/.codex/skills/${BUNDLE_NAME}"
      elif [ -d "${HOME}/.gemini" ]; then echo "${HOME}/.gemini/skills/${BUNDLE_NAME}"
      elif [ -d ".cursor" ];         then echo ".cursor/skills/${BUNDLE_NAME}"
      elif [ -d ".windsurf" ];       then echo ".windsurf/skills/${BUNDLE_NAME}"
      else                                echo "./skills/${BUNDLE_NAME}"
      fi ;;
    *) yellow "Unknown target: $target"; exit 1 ;;
  esac
}

# JSON helper: prefers python3, falls back to node. Emits manualPath lines.
read_manual_paths() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$1" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for m in d.get("modules", []):
    mp = m.get("manualPath")
    if mp: print(mp)
    for sm in m.get("subModules", []):
        mp2 = sm.get("manualPath")
        if mp2: print(mp2)
PY
  elif command -v node >/dev/null 2>&1; then
    node -e '
      const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      for (const m of d.modules || []) {
        if (m.manualPath) console.log(m.manualPath);
        for (const sm of m.subModules || []) if (sm.manualPath) console.log(sm.manualPath);
      }' "$1"
  else
    grep -oh '"manualPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$1" | sed 's/.*"\(.*\)"/\1/'
  fi
}

cmd_list() {
  local size; size="$(du -sh "$SRC_DIR" 2>/dev/null | cut -f1)"
  cyan "design-arsenal — ONE tool, 13 modules (${size})"
  cyan "Entry point:  SKILL.md  (single skill — nothing else registers as a tool)"
  echo
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$SRC_DIR/index.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print(f"  version {d.get('version')} · pipeline: {' → '.join(d.get('pipeline', []))}")
print()
for i, m in enumerate(d.get("modules", []), 1):
    subs = m.get("subModules", [])
    extra = f"  (+{len(subs)} sub-modules)" if subs else ""
    origin = "original" if m.get("origin") == "original" else "upstream"
    print(f"  {i:>2}. {m['slug']:<12} [{origin:<8}] {m['name']}{extra}")
    print(f"       └─ {m['manualPath']}")
PY
  else
    cyan "Modules (from disk):"
    find "$SRC_DIR" -name MANUAL.md -o -name CATALOG.md | sort | sed "s|$SRC_DIR/|   |"
  fi
}

cmd_doctor() {
  local fails=0
  doc_ok() { green "  ✓ $1"; }
  doc_bad() { red "  ✗ $1"; fails=$((fails+1)); }

  cyan "design-arsenal doctor — checking $(basename "$SRC_DIR")"

  # 1. single entry point
  if [ -f "$SRC_DIR/SKILL.md" ]; then doc_ok "root SKILL.md present (single entry point)"
  else doc_bad "root SKILL.md MISSING — agents will not register the tool"; fi

  # 2. no nested SKILL.md (single-tool architecture)
  local nested; nested="$(find "$SRC_DIR/skills" -name 'SKILL.md' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$nested" = "0" ]; then doc_ok "no nested SKILL.md under skills/ (manuals only)"
  else doc_bad "$nested nested SKILL.md found under skills/ — must be renamed MANUAL.md"; fi

  # 3. index.json valid
  local version=""
  if command -v python3 >/dev/null 2>&1; then
    version="$(python3 -c "import json;print(json.load(open('$SRC_DIR/index.json')).get('version',''))" 2>/dev/null || true)"
  elif command -v node >/dev/null 2>&1; then
    version="$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$SRC_DIR/index.json','utf8')).version||'')}catch(e){}" 2>/dev/null || true)"
  fi
  if [ -n "$version" ]; then doc_ok "index.json valid — version $version"
  else doc_bad "index.json missing or invalid JSON"; fi

  # 4. every manualPath in index.json exists
  local missing=0 count=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    count=$((count+1))
    if [ ! -f "$SRC_DIR/$p" ]; then doc_bad "referenced manual missing: $p"; missing=$((missing+1)); fi
  done < <(read_manual_paths "$SRC_DIR/index.json" 2>/dev/null || true)
  [ "$missing" = "0" ] && doc_ok "all $count manual paths from index.json exist on disk"

  # 5. every manual path referenced in SKILL.md exists
  local sk_missing=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ ! -f "$SRC_DIR/$p" ]; then doc_bad "SKILL.md references missing file: $p"; sk_missing=$((sk_missing+1)); fi
  done < <(grep -oh 'skills/[A-Za-z0-9/_.-]*\(MANUAL\|CATALOG\)\.md' "$SRC_DIR/SKILL.md" 2>/dev/null | sort -u)
  [ "$sk_missing" = "0" ] && doc_ok "all module paths referenced in SKILL.md resolve"

  # 6. scripts present and runnable
  for s in skills/a11y/scripts/contrast.mjs skills/design-tokens/scripts/convert.mjs skills/web-vitals/scripts/webvitals.mjs skills/dark-mode/scripts/theme.mjs skills/responsive/scripts/responsive.mjs; do
    if [ -f "$SRC_DIR/$s" ]; then
      if node --check "$SRC_DIR/$s" >/dev/null 2>&1 || node -e "import('$SRC_DIR/$s')" >/dev/null 2>&1 \
         || node "$SRC_DIR/$s" --help >/dev/null 2>&1; then
        doc_ok "script OK: $s"
      else
        doc_ok "script present: $s"
      fi
    else
      doc_bad "expected script missing: $s"
    fi
  done

  echo
  if [ "$fails" = "0" ]; then
    green "✓ healthy — one tool, all references resolve."
    return 0
  else
    red "✗ $fails check(s) failed."
    return 1
  fi
}

cmd_install() {
  local target="${1:-auto}"
  local custom=""
  if [ "$target" = "--dest" ]; then
    custom="${2:-}"
    if [ -z "$custom" ]; then red "--dest requires a path"; exit 1; fi
  fi
  local dest
  if [ -n "$custom" ]; then dest="$custom"; else dest="$(resolve_dest "$target")"; fi
  cyan "→ Installing ${BUNDLE_NAME}"
  echo "   from: ${SRC_DIR}"
  echo "   to:   ${dest}"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -r "$SRC_DIR" "$dest"
  # self-cleanup: don't keep the installer copy inside itself
  rm -f "${dest}/install.sh"
  green "✓ Installed as ONE skill: design-arsenal (entry: SKILL.md, 13 internal modules)."
  echo
  echo "  Next steps:"
  echo "   1. Restart/reload your coding agent — it will register exactly ONE tool."
  echo "   2. Open a task and say, for example (the tool routes internally):"
  echo "        - 'extract the design system from stripe.com'   (→ extract module)"
  echo "        - 'build a landing page for a fintech app'      (→ taste → build)"
  echo "        - 'build this dashboard in Arabic'              (→ rtl-arabic layer)"
  echo "        - 'make the contrast accessible'                (→ a11y module)"
  echo "        - 'turn this screenshot into design tokens'     (→ tokens module)"
  echo "        - '/impeccable audit src/'                      (→ polish module)"
  echo "        - 'add a modal transition'                      (→ transitions module)"
  echo "        - 'animate the hero with GSAP'                  (→ gsap module)"
  echo "        - 'screenshot the page at mobile width'         (→ verify module)"
  echo
  echo "  Manage the tool:"
  echo "        bash ${dest}/../design-arsenal/../*/install.sh 2>/dev/null || true"
  echo "        (re-run install.sh doctor / update from the source folder anytime)"
  echo
  yellow "  Optional CLI companions (install separately, per project):"
  echo "   npx designlang <url>                 # design extractor runtime"
  echo "   npm install -g @playwright/cli && playwright-cli install-browser chromium"
  echo "   npm install gsap                     # GSAP runtime for the animation skills"
}

cmd_update() {
  if [ -d "$SRC_DIR/.git" ]; then
    cyan "→ Updating via git (clone detected at $SRC_DIR)"
    git -C "$SRC_DIR" pull --ff-only
  else
    cyan "→ Updating via latest GitHub release"
    command -v curl >/dev/null 2>&1 || { red "curl required for update"; exit 1; }
    command -v unzip >/dev/null 2>&1 || { red "unzip required for update"; exit 1; }
    local tag
    tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
    [ -n "$tag" ] || { red "could not determine latest release"; exit 1; }
    local zip="design-arsenal-${tag}.zip"
    local tmp; tmp="$(mktemp -d)"
    cyan "   downloading ${zip} (release ${tag})"
    curl -fsSL -o "${tmp}/${zip}" "https://github.com/${REPO}/releases/download/${tag}/${zip}"
    unzip -qo "${tmp}/${zip}" -d "$tmp"
    local inner; inner="$(find "$tmp" -maxdepth 2 -type d -name "$BUNDLE_NAME" | head -1)"
    [ -n "$inner" ] || inner="$tmp"
    rm -rf "$SRC_DIR/SKILL.md" "$SRC_DIR/skills" "$SRC_DIR/examples" "$SRC_DIR/demo" "$SRC_DIR/index.json" "$SRC_DIR/ATTRIBUTION.md" "$SRC_DIR/README.md"
    cp -r "${inner}/." "$SRC_DIR/"
    rm -rf "$tmp"
    green "✓ updated to ${tag}"
  fi
  cmd_doctor || true
}

# ---------------- arg routing ----------------
CMD="${1:-install}"
case "$CMD" in
  install)            shift 2>/dev/null || true; cmd_install "${1:-auto}" ;;
  --list|list)        cmd_list ;;
  doctor|--doctor)    cmd_doctor ;;
  update|--update)    cmd_update ;;
  claude|codex|gemini|cursor|windsurf|opencode|project|auto) cmd_install "$CMD" ;;
  --dest)             shift; cmd_install "--dest" "$@" ;;
  -h|--help|help)     usage ;;
  *)                  usage; exit 2 ;;
esac
