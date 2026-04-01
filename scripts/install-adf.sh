#!/bin/bash
#
# Install adf command globally
#
# Usage: ./install-adf.sh [--uninstall]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADF_SCRIPT="$SCRIPT_DIR/adf"
INSTALL_DIR="$HOME/bin"
INSTALL_TARGET="$INSTALL_DIR/adf"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INSTALL]${NC} $1"; }
log_success() { echo -e "${GREEN}[INSTALL]${NC} $1"; }
log_error() { echo -e "${RED}[INSTALL]${NC} $1"; }

uninstall() {
    if [[ -f "$INSTALL_TARGET" ]]; then
        rm "$INSTALL_TARGET"
        log_success "Removed $INSTALL_TARGET"
    else
        log_info "Not installed"
    fi
    exit 0
}

install() {
    # Check source exists
    if [[ ! -f "$ADF_SCRIPT" ]]; then
        log_error "Source script not found: $ADF_SCRIPT"
        exit 1
    fi

    # Create ~/bin if needed
    if [[ ! -d "$INSTALL_DIR" ]]; then
        mkdir -p "$INSTALL_DIR"
        log_info "Created $INSTALL_DIR"
    fi

    # Copy script
    cp "$ADF_SCRIPT" "$INSTALL_TARGET"
    chmod +x "$INSTALL_TARGET"
    log_success "Installed to $INSTALL_TARGET"

    # Check PATH
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo ""
        log_info "Add this to your ~/.zshrc or ~/.bashrc:"
        echo ""
        echo '    export PATH="$HOME/bin:$PATH"'
        echo ""
        log_info "Then run: source ~/.zshrc"
    else
        log_success "Ready! Try: adf help"
    fi

    # Show current ADF_HOME
    echo ""
    log_info "Set ADF_HOME env var to your adf repo path:"
    echo ""
    echo "    export ADF_HOME=/path/to/your/adf"
    echo ""
    log_info "Or edit $INSTALL_TARGET directly"
}

case "${1:-}" in
    --uninstall|-u)
        uninstall
        ;;
    *)
        install
        ;;
esac
