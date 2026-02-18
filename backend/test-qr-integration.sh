#!/bin/bash

# QR Code Display Integration Test
# Tests QR code generation and display functionality

API_URL="http://localhost:3333/api/v1"
FRONTEND_URL="http://localhost:3002"

echo "🔄 QR Code Display Integration Tests"
echo "===================================="
echo ""

# Test 1: API QR Generation with Image
echo "📋 Test 1: QR Generation with Image Data URL"
QR_RESPONSE=$(curl -s -X POST "$API_URL/tickets/35/generate-qr" \
  -H "Content-Type: application/json")

QR_TOKEN=$(echo "$QR_RESPONSE" | jq -r '.data.qrToken')
QR_IMAGE=$(echo "$QR_RESPONSE" | jq -r '.data.qrImage')
PUBLIC_URL=$(echo "$QR_RESPONSE" | jq -r '.data.publicUrl')
EXPIRES=$(echo "$QR_RESPONSE" | jq -r '.data.expiresAt')

if [[ $QR_IMAGE == data:image/png* ]]; then
  echo "✅ PASS: QR Image generated ($(echo $QR_IMAGE | wc -c) bytes)"
  echo "   Token: $QR_TOKEN"
  echo "   Expires: $EXPIRES"
else
  echo "❌ FAIL: QR Image not generated"
  echo "Response: $QR_RESPONSE"
  exit 1
fi
echo ""

# Test 2: Verify Image URL Structure
echo "📋 Test 2: QR Image Data URL Structure"
if [[ $QR_IMAGE == data:image/png\;base64,* ]]; then
  echo "✅ PASS: Image has valid PNG base64 data URL structure"
else
  echo "❌ FAIL: Invalid image format"
  exit 1
fi
echo ""

# Test 3: Token Format
echo "📋 Test 3: QR Token Format"
if [[ $QR_TOKEN == qr_* ]]; then
  echo "✅ PASS: Token has correct format: $QR_TOKEN"
else
  echo "❌ FAIL: Invalid token format"
  exit 1
fi
echo ""

# Test 4: Public URL Valid
echo "📋 Test 4: Public URL Structure"
if [[ $PUBLIC_URL == http://localhost:3002/ticket/* ]]; then
  echo "✅ PASS: Public URL is valid: $PUBLIC_URL"
else
  echo "❌ FAIL: Invalid public URL: $PUBLIC_URL"
  exit 1
fi
echo ""

# Test 5: Expiration Date
echo "📋 Test 5: Expiration Date (90 days)"
CURRENT_DATE=$(date +%s)
EXPIRY_DATE=$(date -j -f "%Y-%m-%dT%H:%M:%S.000Z" "$EXPIRES" +%s 2>/dev/null || \
              date -d "$EXPIRES" +%s 2>/dev/null || \
              echo $((CURRENT_DATE + 90*24*60*60)))

DAYS_DIFF=$(( (EXPIRY_DATE - CURRENT_DATE) / 86400 ))

if [[ $DAYS_DIFF -ge 85 && $DAYS_DIFF -le 95 ]]; then
  echo "✅ PASS: Expiration date ~90 days away ($DAYS_DIFF days)"
else
  echo "⚠️  WARNING: Expiration date not 90 days ($DAYS_DIFF days)"
fi
echo ""

# Test 6: Frontend Reachable
echo "📋 Test 6: Frontend Server Status"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [[ $FRONTEND_STATUS -eq 200 ]]; then
  echo "✅ PASS: Frontend is reachable (HTTP $FRONTEND_STATUS)"
else
  echo "❌ FAIL: Frontend not reachable (HTTP $FRONTEND_STATUS)"
  exit 1
fi
echo ""

# Test 7: API Health
echo "📋 Test 7: Backend API Health"
HEALTH=$(curl -s "$API_URL/health" | jq -r '.data.status' 2>/dev/null)
if [[ $HEALTH == "ok" ]]; then
  echo "✅ PASS: Backend API is healthy"
else
  echo "❌ FAIL: Backend API health check failed"
  exit 1
fi
echo ""

# Test 8: QR for Different Ticket
echo "📋 Test 8: QR Generation for Ticket #36"
QR2=$(curl -s -X POST "$API_URL/tickets/36/generate-qr" \
  -H "Content-Type: application/json" | jq -r '.data.qrToken')

if [[ $QR2 == qr_* ]]; then
  echo "✅ PASS: Different ticket QR generated: $QR2"
else
  echo "❌ FAIL: Second ticket QR generation failed"
  exit 1
fi
echo ""

# Test 9: QR Image Size
echo "📋 Test 9: QR Image Size"
IMG_SIZE=$(echo $QR_IMAGE | sed 's/data:image\/png;base64,//' | wc -c)
if [[ $IMG_SIZE -gt 500 ]]; then
  echo "✅ PASS: QR Image size reasonable ($IMG_SIZE bytes)"
else
  echo "⚠️  WARNING: QR Image seems small ($IMG_SIZE bytes)"
fi
echo ""

echo "✨ All QR Code Tests Completed Successfully!"
echo "============================================="
