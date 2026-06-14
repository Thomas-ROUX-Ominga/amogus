#!/usr/bin/env bash
# Logs in as testoperator and saves Playwright auth state.
# Re-run when the JWT expires (24h) or Redis is reset.
# Usage: bash scripts/setup-playwright-auth.sh

set -e

echo "Opening login page..."
playwright-cli open http://localhost:3000/login

echo "Filling credentials..."
playwright-cli fill "getByRole('textbox', { name: 'ID...' })" "testoperator"
playwright-cli fill "getByRole('textbox', { name: 'SECRET...' })" "TestPass123!"
playwright-cli click "getByRole('button', { name: 'INITIALIZE SESSION' })"

echo "Saving auth state..."
playwright-cli state-save .playwright-cli/testoperator-auth.json
playwright-cli close

echo "Done — auth state saved to .playwright-cli/testoperator-auth.json"
echo "Load it at the start of a test session with:"
echo "  playwright-cli state-load .playwright-cli/testoperator-auth.json"
