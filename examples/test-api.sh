#!/bin/bash
#
# MPC Wallet API Test Script
# Tests the full vault lifecycle using curl
#
# Usage:
#   1. Start server with TEST_MODE: TEST_MODE=true npm run dev
#   2. Run this script: ./examples/test-api.sh
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_CODE="000000"  # TEST_MODE verification code

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_test() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

# Check if server is running
check_server() {
    print_header "Checking Server Connection"
    print_test "Connecting to $BASE_URL..."

    if curl -s --connect-timeout 5 "$BASE_URL/health" > /dev/null 2>&1; then
        print_success "Server is running"
        return 0
    else
        print_error "Server is not running at $BASE_URL"
        echo ""
        echo "Please start the server with:"
        echo "  TEST_MODE=true npm run dev"
        echo ""
        exit 1
    fi
}

# Test health endpoint
test_health() {
    print_header "1. Health Check"
    print_test "GET /health"

    RESPONSE=$(curl -s "$BASE_URL/health")
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

    if echo "$RESPONSE" | grep -q "healthy\|ok"; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
    fi
}

# Test root endpoint
test_root() {
    print_header "2. API Info"
    print_test "GET /"

    RESPONSE=$(curl -s "$BASE_URL/")
    echo "$RESPONSE" | jq -r '.message, .endpoints[]' 2>/dev/null || echo "$RESPONSE"
    print_success "API info retrieved"
}

# Create a fast vault
test_create_vault() {
    print_header "3. Create Fast Vault"
    print_test "POST /api/vaults/fast"

    RESPONSE=$(curl -s -X POST "$BASE_URL/api/vaults/fast" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Wallet",
            "email": "test@example.com",
            "password": "TestPassword123",
            "userId": "test-user-001"
        }')

    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

    VAULT_ID=$(echo "$RESPONSE" | jq -r '.data.vaultId // .vaultId // empty')

    if [ -n "$VAULT_ID" ] && [ "$VAULT_ID" != "null" ]; then
        print_success "Vault created: $VAULT_ID"
        echo "$VAULT_ID"
    else
        print_error "Failed to create vault"
        echo ""
        exit 1
    fi
}

# Verify vault
test_verify_vault() {
    local VAULT_ID=$1

    print_header "4. Verify Vault"
    print_test "POST /api/vaults/$VAULT_ID/verify (using TEST_MODE code: $TEST_CODE)"

    RESPONSE=$(curl -s -X POST "$BASE_URL/api/vaults/$VAULT_ID/verify" \
        -H "Content-Type: application/json" \
        -d "{\"verificationCode\": \"$TEST_CODE\"}")

    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

    if echo "$RESPONSE" | grep -qi "success\|true\|verified"; then
        print_success "Vault verified"
    else
        print_error "Vault verification failed"
        print_info "Make sure server is running with TEST_MODE=true"
    fi
}

# Get addresses for multiple chains
test_get_addresses() {
    local VAULT_ID=$1

    print_header "5. Get Blockchain Addresses"

    CHAINS=("Bitcoin" "Ethereum" "Solana" "Polygon" "Avalanche")

    for CHAIN in "${CHAINS[@]}"; do
        print_test "GET /api/vaults/$VAULT_ID/address/$CHAIN"

        RESPONSE=$(curl -s "$BASE_URL/api/vaults/$VAULT_ID/address/$CHAIN")
        ADDRESS=$(echo "$RESPONSE" | jq -r '.data.address // .address // empty')

        if [ -n "$ADDRESS" ] && [ "$ADDRESS" != "null" ]; then
            print_success "$CHAIN: $ADDRESS"
        else
            print_error "Failed to get $CHAIN address"
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
    done
}

# Get vault metadata
test_get_metadata() {
    local VAULT_ID=$1

    print_header "6. Get Vault Metadata"
    print_test "GET /api/vaults/$VAULT_ID"

    RESPONSE=$(curl -s "$BASE_URL/api/vaults/$VAULT_ID")
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    print_success "Metadata retrieved"
}

# List all vaults
test_list_vaults() {
    print_header "7. List All Vaults"
    print_test "GET /api/vaults"

    RESPONSE=$(curl -s "$BASE_URL/api/vaults")
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

    COUNT=$(echo "$RESPONSE" | jq '.data | length // 0' 2>/dev/null || echo "?")
    print_success "Found $COUNT vault(s)"
}

# List vaults by userId
test_list_vaults_by_user() {
    print_header "8. List Vaults by User"
    print_test "GET /api/vaults?userId=test-user-001"

    RESPONSE=$(curl -s "$BASE_URL/api/vaults?userId=test-user-001")
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    print_success "User vaults retrieved"
}

# Export vault
test_export_vault() {
    local VAULT_ID=$1

    print_header "9. Export Vault Backup"
    print_test "POST /api/vaults/$VAULT_ID/export"

    RESPONSE=$(curl -s -X POST "$BASE_URL/api/vaults/$VAULT_ID/export" \
        -H "Content-Type: application/json" \
        -d '{"password": "BackupPassword123"}')

    BACKUP=$(echo "$RESPONSE" | jq -r '.data.backup // .backup // empty')

    if [ -n "$BACKUP" ] && [ "$BACKUP" != "null" ]; then
        print_success "Backup exported (base64, ${#BACKUP} chars)"
        print_info "First 50 chars: ${BACKUP:0:50}..."
    else
        print_error "Export failed (may require real vault in non-TEST_MODE)"
        echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    fi
}

# Test error handling - invalid vault ID
test_error_invalid_vault() {
    print_header "10. Error Handling Tests"
    print_test "GET /api/vaults/invalid-id/address/Bitcoin (should fail)"

    RESPONSE=$(curl -s "$BASE_URL/api/vaults/invalid-vault-id-12345/address/Bitcoin")

    if echo "$RESPONSE" | grep -qi "error\|not found\|false"; then
        print_success "Error handled correctly"
        echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        print_error "Expected error response"
    fi
}

# Main test flow
main() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     MPC Wallet API Test Suite                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check server is running
    check_server

    # Run tests
    test_health
    test_root

    # Create and get vault ID
    VAULT_ID=$(test_create_vault | tail -1)

    # Test vault operations
    test_verify_vault "$VAULT_ID"
    test_get_addresses "$VAULT_ID"
    test_get_metadata "$VAULT_ID"
    test_list_vaults
    test_list_vaults_by_user
    test_export_vault "$VAULT_ID"
    test_error_invalid_vault

    # Summary
    print_header "Test Summary"
    print_success "All tests completed!"
    echo ""
    print_info "Vault ID used: $VAULT_ID"
    print_info "Server: $BASE_URL"
    echo ""
}

# Run main
main
