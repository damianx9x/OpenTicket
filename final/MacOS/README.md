# macOS App Distribution

## 📦 ticket-system-installer.dmg

Natywna aplikacja macOS dla systemu ticketowego.

### 🚀 Instalacja

1. **Otwórz** plik `ticket-system-installer.dmg`
2. **Przeciągnij** ikonę aplikacji na folder Applications
3. **Potwierdź** instalację (możliwe pytanie o hasło admin)
4. **Uruchom** z Launchpad lub Spotlight (`Cmd+Space` → "Apple Service")

### ℹ️ Wymagania

- macOS 10.14+
- Procesor: Intel lub Apple Silicon (M1+)
- RAM: 512 MB minimum
- Dysk: 150 MB

### ✨ Cechy

- Native Swift application
- SwiftUI interface
- Dark mode support
- Full offline capability
- Notification center integration

### 📋 Zawartość DMG

```
ticket-system-installer.dmg
├── Apple Service (aplikacja)
├── Applications (shortcut)
└── Installation guide
```

### 🔧 Troubleshooting

**"Nie można otworzyć aplikację"**
```bash
sudo spctl --master-disable
# lub
xattr -d com.apple.quarantine /Applications/Apple\ Service.app
```

**Aplikacja zawiesza się**
- Restartuj aplikację
- Sprawdź ilość wolnej pamięci RAM
- Spróbuj ponownie zainstalować

---

**Format:** macOS DMG (Universal Binary)  
**Wersja:** 1.0.0  
**Kompatybilność:** macOS 10.14 - 14.x  
**Aktualizacja:** 16.02.2026
