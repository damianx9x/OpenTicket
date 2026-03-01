# Operator Flow (przydział + filtry)

Poniższy flow jest wdrożony jako logika operacyjna dashboardu i służy do szybkiej triage zgłoszeń bez ręcznego „klikania w ciemno”.

```mermaid
flowchart LR
    A["Nowe zgłoszenie"] --> B{"Czy zgłoszenie ma\nodpowiedniego operatora?"}
    B -- "Tak" --> C{"Czy operator =\nzalogowany użytkownik?"}
    B -- "Nie" --> D["Uruchom auto-kategoryzację\nstatusu i priorytetu"]
    D --> E{"Czy posiada przypisanego\noperatora?"}
    E -- "Nie" --> F["Zastosuj filtry\n'Tylko moje' / '> X dni' / status"]
    E -- "Tak" --> G["Odśwież listę"]
    G --> C
    C -- "Tak" --> H["Pomiń kolejkę i pokaż\nzgłoszenie w widoku operatora"]
    C -- "Nie" --> I["Przejdź kategoryzację,\nzapisz zmiany,\nzamknij lub wróć do kolejki"]
    H --> J["Zamknij krok i wróć do listy"]
    I --> J
    J --> A
    F --> A
```

## Reguły UX
- Operator zawsze widzi priorytetowe zgłoszenia na górze.
- Filtr „Tylko moje” i preset filtrów skracają czas obsługi.
- Zmiany statusu zapisują historię etapów i wspierają reopen.
