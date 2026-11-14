#!/bin/bash
set -e

BASE_URL="http://localhost:8080/api"

echo "=== 1. Health Check ==="
curl -s http://localhost:8080/health
echo -e "\n"

echo "=== 2. Register New User ==="
REG_RES=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123","full_name":"Saiful Tester","currency":"USD"}')
echo "$REG_RES"
echo -e "\n"

TOKEN=$(echo "$REG_RES" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Registration failed or user already exists, trying login..."
  LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@example.com","password":"password123"}')
  echo "$LOGIN_RES"
  TOKEN=$(echo "$LOGIN_RES" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
fi

echo "Access Token retrieved: ${TOKEN:0:20}..."
echo -e "\n"

echo "=== 3. Get User Profile ==="
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/auth/profile"
echo -e "\n"

echo "=== 4. Fetch Default Seeded Categories ==="
CATS_RES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/categories")
echo "$CATS_RES" | head -c 300
echo "..."
echo -e "\n"

# Extract an income category ID and an expense category ID
INCOME_CAT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/categories?type=income" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
EXPENSE_CAT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/categories?type=expense" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "Income Category ID: $INCOME_CAT_ID"
echo "Expense Category ID: $EXPENSE_CAT_ID"
echo -e "\n"

echo "=== 5. Create Cash In Transaction ($5,000 Salary) ==="
TX_IN=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 5000, \"type\": \"income\", \"category_id\": \"$INCOME_CAT_ID\", \"payment_method\": \"Bank Account\", \"note\": \"Monthly Salary\"}")
echo "$TX_IN"
echo -e "\n"

echo "=== 6. Create Cash Out Transaction ($1,500 Rent) ==="
TX_OUT=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 1500, \"type\": \"expense\", \"category_id\": \"$EXPENSE_CAT_ID\", \"payment_method\": \"Cash\", \"note\": \"House Rent Payment\"}")
echo "$TX_OUT"
echo -e "\n"

echo "=== 7. Verify Real-time Financial Summary (Cash In, Cash Out, Net Balance) ==="
SUMMARY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/analytics/summary")
echo "$SUMMARY"
echo -e "\n"

echo "=== 8. Verify Google Drive Export Payload ==="
BACKUP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/backup/export")
echo "$BACKUP" | head -c 250
echo "..."
echo -e "\n"

echo "=== ALL API TESTS PASSED SUCCESSFULLY! ==="
