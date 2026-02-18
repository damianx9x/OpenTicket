# iOS Ticket System App

SwiftUI companion app for the Ticket System desktop application. Scans QR codes from desktop setup wizard to auto-configure connection.

## Features

- **QR Code Scanner:** Scan setup QR codes from desktop app
- **Secure Token Storage:** Uses iOS Keychain for JWT token persistence
- **Dynamic API URL:** Connects to any local network instance
- **Ticket Management:** View and manage tickets from any device
- **Offline Support:** UserDefaults caching of API configuration
- **Network Detection:** Automatic retry on connection failure

## Architecture

```
ContentView.swift
├── DisconnectedView (QR scanner & manual entry)
├── ConnectedView (Tab navigation)
│   ├── TicketsView (Ticket list + detail)
│   └── SettingsView (Connection management)
└── ErrorView (Connection failures)

Models.swift
├── SetupResponse
├── QRCodeData
├── Ticket, TicketsResponse
└── ConnectionStatus enum

StorageManagers:
├── NetworkManager (API communication)
├── KeychainManager (Secure token storage)
└── UserDefaults (API URL + settings)
```

## File Structure

```
ios/
├── SwiftUI/
│   ├── TicketApp.swift              # Main app entry point
│   ├── ContentView.swift            # Main UI with state management
│   ├── Models.swift                 # Data models & responses
│   ├── NetworkManager.swift         # API client & connection logic
│   ├── KeychainManager.swift        # Secure token storage
│   └── QRCodeScanner.swift          # AVFoundation wrapper
└── README.md (this file)
```

## How It Works

### 1. Initial Connection (QR Scan)

```
User opens app
    ↓
See "Connect to System" screen
    ↓
Scan Desktop QR Code
    ↓
QR contains: { apiBase: "http://192.168.1.100:3000", token: "..." }
    ↓
Save apiBase → UserDefaults
Save token → Keychain (iOS Keychain framework)
    ↓
Test connection to apiBase/api/v1/setup/status
    ↓
If successful: Connected state
If failed: Error state with retry option
```

### 2. API Communication

All API calls use:
- **Base URL:** From UserDefaults after QR scan
- **Auth:** Bearer token from Keychain
- **Format:** JSON with proper Content-Type headers

### 3. Ticket Display

```
TicketsView
├── Fetches from /api/v1/tickets
├── Displays list with status/priority badges
├── Tap row → TicketDetailView
└── Pull to refresh
```

## Security Considerations

1. **Token Storage:** Uses iOS Keychain (encrypted on device)
2. **API URL:** Stored in UserDefaults (hostname/port only)
3. **No Caching:** Sensitive ticket data is not persisted
4. **HTTPS Ready:** All requests use https when available
5. **Disconnect:** Full wipe of credentials and cached data

## Integration with Desktop App

### QR Code Format

The desktop setup wizard generates:
```json
{
  "apiBase": "http://192.168.1.100:3000",
  "token": "eyJhbGc..."
}
```

### Required Desktop API Endpoints

- `POST /api/v1/setup/status` - Health check (no auth)
- `GET /api/v1/tickets` - Ticket list (Bearer auth)
- `GET /api/v1/tickets/:id` - Ticket detail (Bearer auth)
- `POST /api/v1/tickets` - Create ticket (Bearer auth)
- `PATCH /api/v1/tickets/:id` - Update ticket (Bearer auth)

## Development

### Requirements

- Xcode 14+
- iOS 14+
- Swift 5.7+

### Building

```bash
# Open in Xcode
open ios/TicketApp.xcodeproj

# Or create new project
1. Create new project in Xcode
2. Copy SwiftUI folder files to your project
3. Update bundle identifier
```

## State Management

Uses SwiftUI's `@ObservedObject` and `@State`:

```
@StateObject networkManager
└── Published properties:
    ├── connectionStatus → UI state
    ├── tickets → displayed in TicketsView
    ├── isLoading → progress indicators
    └── errorMessage → error alerts
```

## Key Features Implemented

- [x] QR Code Scanner (AVFoundation)
- [x] Secure token storage (Keychain)
- [x] API communication (URLSession)
- [x] Ticket list view
- [x] Ticket detail view  
- [x] Connection management
- [x] Error handling & retry logic
- [x] Settings screen
- [x] Manual URL entry (fallback)

## Future Enhancements

- [ ] Create/edit tickets
- [ ] Push notifications
- [ ] Offline mode with sync
- [ ] iPad support
- [ ] Dark mode
- [ ] Ticket search & filtering
- [ ] Comments/attachments
- [ ] Auto-reconnect on network change

## Troubleshooting

### "Cannot connect to server"
- Check network connectivity
- Verify desktop app running and accessible
- Check firewall allowing port 3000

### "Camera permission denied"
- Settings → Privacy → Camera → Enable app

### Token issues
- Rescan QR code from desktop
- Or manually re-enter API URL

## See Also

- [Desktop README](../desktop/README.md) - Electron wrapper
- [Backend README](../backend/README.md) - NestJS API
- [Frontend README](../frontend/README.md) - Setup wizard
