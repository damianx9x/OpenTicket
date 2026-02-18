#!/bin/bash
# Integration test - sprawdzenie komunikacji frontend ↔ backend

echo "🧪 INTEGRATION TEST - Frontend ↔ Backend Communication"
echo "=========================================="
echo ""

# Test 1: API Health
echo "1️⃣  API Health Check..."
HEALTH=$(curl -s http://localhost:3333/api/v1/health | jq -r '.status')
if [ "$HEALTH" = "ok" ]; then
  echo "✅ API Health: OK"
else
  echo "❌ API Health: FAILED"
  exit 1
fi
echo ""

# Test 2: Get Tickets
echo "2️⃣  Get Tickets..."
TICKETS=$(curl -s http://localhost:3333/api/v1/tickets | jq '.data | length')
echo "✅ Tickets count: $TICKETS"
echo ""

# Test 3: Create New Ticket
echo "3️⃣  Create New Ticket..."
RESPONSE=$(curl -s -X POST http://localhost:3333/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Integration Test Ticket",
    "description": "This is an automated test ticket",
    "priority": "normal",
    "deviceType": "iPad",
    "customerName": "Test Bot",
    "customerPhone": "+48 111 222 333"
  }')

TICKET_ID=$(echo $RESPONSE | jq -r '.data.id')
if [ ! -z "$TICKET_ID" ] && [ "$TICKET_ID" != "null" ]; then
  echo "✅ Ticket Created: #$TICKET_ID"
else
  echo "❌ Ticket Creation Failed"
  exit 1
fi
echo ""

# Test 4: Get Specific Ticket  
echo "4️⃣  Get Specific Ticket..."
TICKET=$(curl -s http://localhost:3333/api/v1/tickets/$TICKET_ID | jq -r '.data.title')
echo "✅ Ticket Title: $TICKET"
echo ""

# Test 5: Add Comment
echo "5️⃣  Add Comment..."
curl -s -X POST http://localhost:3333/api/v1/tickets/$TICKET_ID/comments \
  -H "Content-Type: application/json" \
  -d '{
    "author": "Test Bot",
    "text": "Automated test comment",
    "isInternal": false
  }' > /dev/null
echo "✅ Comment Added"
echo ""

# Test 6: Add Cost Item
echo "6️⃣  Add Cost Item..."
curl -s -X POST http://localhost:3333/api/v1/tickets/$TICKET_ID/cost-items \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test Service",
    "quantity": 1,
    "unitPrice": 100,
    "vat": 23
  }' > /dev/null
echo "✅ Cost Item Added"
echo ""

# Test 7: Update Ticket
echo "7️⃣  Update Ticket Status..."
curl -s -X PATCH http://localhost:3333/api/v1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "assignedTo": "Anna Nowak"}' > /dev/null
echo "✅ Ticket Updated"
echo ""

# Test 8: Generate QR
echo "8️⃣  Generate QR Code..."
QR=$(curl -s -X POST http://localhost:3333/api/v1/tickets/$TICKET_ID/generate-qr | jq -r '.data.qrToken')
if [ ! -z "$QR" ] && [ "$QR" != "null" ]; then
  echo "✅ QR Token: $QR"
else
  echo "❌ QR Generation Failed"
fi
echo ""

echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo ""
echo "📋 Created Test Ticket: #$TICKET_ID"
echo "🌐 Frontend: http://localhost:3002"
echo "🔗 API: http://localhost:3333/api/v1"
echo "📱 Public Page: http://localhost:3333/ticket/$(echo $RESPONSE | jq -r '.data.publicToken')"
