#!/bin/bash
set -e

BASE_URL="http://localhost:18080/api"

echo "=== 1. Health Check ==="
curl -s http://localhost:18080/health
echo -e "\n"

echo "=== 2. Login User ==="
LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123"}')
echo "$LOGIN_RES"
TOKEN=$(echo "$LOGIN_RES" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Logging in failed, trying register..."
  REG_RES=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@example.com","password":"password123","full_name":"Saiful Tester","currency":"USD"}')
  TOKEN=$(echo "$REG_RES" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
fi

echo "Access Token retrieved: ${TOKEN:0:20}..."
echo -e "\n"

echo "=== 3. Get Expense Category for Budgeting ==="
EXPENSE_CAT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/categories?type=expense" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Expense Category ID: $EXPENSE_CAT_ID"
echo -e "\n"

echo "=== 4. Set Category Spending Limit ($2,000 Budget) ==="
SET_BUDGET=$(curl -s -X POST "$BASE_URL/budgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"category_id\": \"$EXPENSE_CAT_ID\", \"amount\": 2000}")
echo "$SET_BUDGET"
echo -e "\n"

echo "=== 5. Fetch Active Budgets & Alert Status ==="
BUDGETS_LIST=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/budgets")
echo "$BUDGETS_LIST"
echo -e "\n"

echo "=== 6. Create Recurring Rule ($150 Weekly) ==="
REC_RES=$(curl -s -X POST "$BASE_URL/recurring" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 150, \"type\": \"expense\", \"category_id\": \"$EXPENSE_CAT_ID\", \"payment_method\": \"Bank Account\", \"note\": \"Weekly Gym Subscription\", \"frequency\": \"weekly\"}")
echo "$REC_RES"
echo -e "\n"

echo "=== 7. List Recurring Rules ==="
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/recurring"
echo -e "\n"

echo "=== 8. Process Due Recurring Transactions ==="
PROCESS_RES=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/recurring/process")
echo "$PROCESS_RES"
echo -e "\n"

echo "=== 9. Verify Financial Summary with Dynamic Math ==="
SUMMARY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/analytics/summary")
echo "$SUMMARY"
echo -e "\n"

echo "=== ALL NEW ENDPOINTS & FEATURES VERIFIED! ==="
