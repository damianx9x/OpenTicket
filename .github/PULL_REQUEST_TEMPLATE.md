## Cel
- [ ] Co naprawia / wdraża ten PR?

## Zakres zmian
- [ ] Backend
- [ ] Frontend
- [ ] Desktop
- [ ] iOS
- [ ] Instalator / Deinstalator
- [ ] Dokumentacja

## Testy (wymagane)
- [ ] `./Moj/testy/smoke.sh --no-fresh`
- [ ] `./Moj/testy/auth-smoke.sh --no-fresh`
- [ ] `node ./Moj/testy/ui-random-10.mjs --browser chromium --base-url http://127.0.0.1:3200`
- [ ] `node ./Moj/testy/ui-random-10.mjs --browser webkit --base-url http://127.0.0.1:3200`
- [ ] `./scripts/diagnose.sh --verbose`

## Wpływ na release
- [ ] README zaktualizowany (`Postęp`, `Jak testować`, `Znane problemy`, `Następne kroki`)
- [ ] Link do instalatora `.pkg` poprawny w README
- [ ] Screenshoty UI zaktualizowane (`docs/screenshots/...`)
