#!/usr/bin/env bash
# ============================================================================
#  design-arsenal installer — ONE tool, multi-platform (Claude Code, Codex,
#  Gemini CLI, Cursor, Windsurf, OpenCode, or any project-local skills folder)
#
#  Installs the whole arsenal as a SINGLE skill named `design-arsenal`:
#  one SKILL.md entry point, 7 internal modules (no per-module installation).
#
#  Usage:
#    ./install.sh                     # auto-detect + install (project-local first)
#    ./install.sh claude              # install to ~/.claude/skills/design-arsenal
#    ./install.sh codex               # install to ~/.codex/skills/design-arsenal
#    ./install.sh gemini              # install to ~/.gemini/skills/design-arsenal
#    ./install.sh cursor              # install to ./.cursor/skills/design-arsenal
#    ./install.sh windsurf            # install to ./.windsurf/skills/design-arsenal
#    ./install.sh opencode            # install to ./.opencode/skills/design-arsenal
#    ./install.sh project             # install to ./skills/design-arsenal
#    ./install.sh --dest /any/path    # install to a custom directory
#    ./install.sh --list              # show what would be installed
# ============================================================================
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_NAME="design-arsenal"

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

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
      # Prefer the first agent that exists on this machine, else project-local
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

TARGET="auto"
CUSTOM=""
for arg in "$@"; do
  case "$arg" in
    --list) LIST_ONLY=1 ;;
    --dest) TARGET="--dest" ;;
    claude|codex|gemini|cursor|windsurf|opencode|project|auto) TARGET="$arg" ;;
    *) if [ "$TARGET" = "--dest" ]; then CUSTOM="$arg"; fi ;;
  esac
done

if [ "${LIST_ONLY:-0}" = "1" ]; then
  cyan "One tool, 7 modules ($(du -sh "$SRC_DIR" | cut -f1)):"
  cyan "Entry point:  SKILL.md (single skill — nothing else registers as a tool)"
  cyan "Modules:"
  find "$SRC_DIR" -name MANUAL.md | sort | sed "s|$SRC_DIR/|   |"
  exit 0
fi

DEST="$(resolve_dest "$TARGET")"
[ -n "$CUSTOM" ] && DEST="$CUSTOM"

cyan "→ Installing ${BUNDLE_NAME}"
echo "   from: ${SRC_DIR}"
echo "   to:   ${DEST}"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -r "$SRC_DIR" "$DEST"
# self-cleanup: don't keep the installer copy inside itself
rm -f "${DEST}/install.sh"

green "✓ Installed as ONE skill: design-arsenal (entry: SKILL.md, 7 internal modules)."
echo
echo "  Next steps:"
echo "   1. Restart/reload your coding agent — it will register exactly ONE tool."
echo "   2. Open a task and say, for example (the tool routes internally):"
echo "        - 'extract the design system from stripe.com'   (→ extract module)"
echo "        - 'build a landing page for a fintech app'      (→ taste → build)"
echo "        - '/impeccable audit src/'                      (→ polish module)"
echo "        - 'add a modal transition'                      (→ transitions module)"
echo "        - 'animate the hero with GSAP'                  (→ gsap module)"
echo "        - 'screenshot the page at mobile width'         (→ verify module)"
echo
echo "  Agent-specific notes:"
echo "   • Claude Code : skills under ~/.claude/skills are picked up automatically."
echo "   • Codex CLI   : skills under ~/.codex/skills are read by the CLI."
echo "   • Gemini CLI  : skills under ~/.gemini/skills are read by the CLI."
echo "   • Cursor / Windsurf / OpenCode: project folders above must exist (created if needed)."
echo "   • Any agent   : point it at ${DEST}/SKILL.md in its settings."
echo
yellow "  Optional CLI companions (install separately, per project):"
echo "   npx designlang <url>                 # design extractor runtime"
echo "   npm install -g @playwright/cli && playwright-cli install-browser chromium"
echo "   npm install gsap                     # GSAP runtime for the animation skills"
