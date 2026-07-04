# Local Climate Link - next audit prompt

Skopiuj ponizszy prompt do Deep Research / modelu audytowego.

```text
Jestes senior staff engineerem, reviewerem produktu embedded/mobile i krytycznym mentorem dla projektu Local Climate Link.

Projekt:
- Repo: https://github.com/MichalMatu/local-climate-link-starter
- Glowny branch roboczy: work
- main ma byc release-only: jeden snapshot commit na publiczna wersje, bez zwyklego merge z work.
- Aktualny produkt: aplikacja Android/Ionic/React jako konfigurator Shelly Plug S Gen3 + termometr BLE Xiaomi/PVVX BTHome v2 albo TP357. Telefon sluzy do konfiguracji i diagnostyki, runtime automatyzacji dziala na Shelly.
- Wartosc produktu: uzytkownik kupuje tanie, dostepne komponenty BLE + Shelly i w kilka klikniec dostaje lokalny termostat/higrostat/VPD automation bez Home Assistant, MQTT, cloud, Docker, YAML i bez stale dzialajacego telefonu.

Kontekst ostatnich poprawek:
- Tryb AUTO ma zawsze wysylac decyzje reguly przy kazdej ewaluacji runtime, zeby reczne klikniecie przekaznika Shelly nie zostawialo stanu niezgodnego z regula.
- Ekran Diag zostal uproszczony wedlug IPO: Input -> Processing -> Output. Dane uzyte do decyzji sa w jednej karcie; telemetria Shelly jest nizej, bo nie steruje regula.
- Snapshot diagnostyki zmienil nazwy pol z datopodobnych na uptime:
  - lastSeenUptimeMs
  - lastChangeUptimeMs
  - onStartedUptimeMs
  - lastPacketSeenUptimeMs
- UI pokazuje "ile temu" liczone z uptime Shelly oraz osobny "wiek snapshotu" liczony od pobrania diagnostyki przez aplikacje.
- Ukryty auto-preload historii Xiaomi/PVVX zostal usuniety. Historia PVVX ma byc pobierana tylko jawnie przyciskiem uzytkownika, bo auto-preload mogl konkurowac z live scanem BLE i mieszac mentalny model.
- CI zostal wlaczony rowniez na branchu work i zawiera test:coverage:core.
- Publiczne linki Android release powinny wskazywac na v2.0.4.

Twoje zadanie:
Przeprowadz bardzo krytyczny audyt kodu, produktu i procesu. Nie pisz ogolnikow. Porownaj raportowane zalozenia z faktycznym kodem. Szukaj rzeczy, ktore moga realnie zablokowac platna bete, testy u klientow albo bezpieczne uzycie ze sprzetem.

Zakres audytu:
1. Runtime Shelly i logika automatyzacji:
   - Czy reguly heating/cooling/humidifying/dehumidifying sa spojne?
   - Czy AUTO faktycznie wymusza stan reguly przy kazdej ewaluacji?
   - Czy fail-safe OFF, stale timeout, min change, max on i consecutive hits sa dobrze zaimplementowane?
   - Czy runtime odroznia "ostatni pakiet BLE" od "ostatni pelny pomiar uzyteczny dla reguly"?
   - Czy VPD assist moze podjac zla decyzje przy czesciowych/starych danych temperatury/wilgotnosci?
   - Czy dane diagnostyczne sa stabilne po restarcie Shelly i po braku synchronizacji czasu?

2. Diagnostyka i mentalny model uzytkownika:
   - Czy ekran Diag faktycznie pokazuje IPO w sposob przydatny podczas realnego debugowania?
   - Czy "Przekaznik reguly" i "Przekaznik Shelly" sa wystarczajaco jasne?
   - Czy "wiek snapshotu" moze byc mylony z wiekiem pomiaru?
   - Czy ukryte/zwijane sekcje nie chowaja informacji potrzebnych przy awarii?
   - Czy support report ma te same kluczowe dane, ktore widac w UI?

3. BLE, PVVX, TP357 i GATT:
   - Czy usuniecie auto-preload PVVX zostawilo martwy kod, martwe typy, martwe testy albo mylaca dokumentacje?
   - Czy live scan telefonu moze konfliktowac z GATT history/time sync?
   - Czy aplikacja dobrze pauzuje i wznawia BLE scan przed sesjami GATT?
   - Czy TP357 ma jasny zakres wsparcia, skoro nie ma historii GATT?
   - Czy parsery i profile sa odporne na czesciowe ramki, baterie-only frames, slabsze RSSI i duplikaty?

4. Architektura i modularyzacja:
   - Czy granice miedzy apps/mobile, automation-core, script-generator, ble-core, shelly-client i ui sa dobre?
   - Gdzie komponenty React sa za duze lub lacza zbyt wiele odpowiedzialnosci?
   - Czy store, mutation hooks, UI pages i helpers sa wystarczajaco testowalne?
   - Czy sa nazwy/API, ktore udaja kompatybilnosc wsteczna albo zostawily stare sciezki? Globalna zasada projektu: nie zostawiac redundantnych backward-compatibility paths przy zmianie internal API.

5. Testy i tooling:
   - Czy unit/integration/e2e testy lapia realne regresje sprzetowe?
   - Czy testy sa za bardzo mockowane i przez to daja falszywe poczucie bezpieczenstwa?
   - Czy CI na work i release-only main jest wystarczajacy?
   - Czy release Android ma kompletna walidacje artefaktow, checksum i podpisow?
   - Czy brakuje testu na konkretne bugi: reczny ON Shelly w AUTO, stale snapshot, BLE/GATT conflict, zly chain danych VPD?

6. UX, onboarding i landing page:
   - Czy strona i aplikacja mowia tym samym jezykiem o produkcie?
   - Czy uzytkownik bez technicznej wiedzy zrozumie co kupic, co kliknac, kiedy jest gotowe i co zrobic przy awarii?
   - Czy onboarding faktycznie da sie pokazac jednym filmem YouTube?
   - Czy copy nie obiecuje wiecej niz aktualny kod dowozi?
   - Czy Android beta/release links sa aktualne i wiarygodne?

7. Bezpieczenstwo i ryzyko realnego sprzetu:
   - Czy bezpieczne OFF jest wymuszane przy bledach, usuwaniu skryptu, stopowaniu, out_of_memory i utracie BLE?
   - Czy app moze przypadkiem zostawic grzanie/nawilzanie wlaczone?
   - Czy limit max on jest wystarczajaco obronny?
   - Czy uzytkownik dostaje jasne ostrzezenia przy uzyciu z grzaniem, wilgocia i tanimi gniazdkami?

8. Gotowosc do platnej bety:
   - Co jest minimalnym zakresem do pierwszych 3-5 platnych testerow?
   - Co absolutnie blokuje sprzedaz?
   - Co jest nice-to-have i nie powinno opozniac bety?
   - Jakie 5 rzeczy trzeba zmierzyc w realnych instalacjach?

Wymagany format odpowiedzi:
1. Executive summary: 5-10 punktow, bez marketingu.
2. Findings ordered by severity:
   - Severity: Blocker / High / Medium / Low
   - Evidence: konkretny plik i linia albo opis miejsca w kodzie
   - Why it matters: realny skutek dla klienta/sprzetu/bety
   - Suggested fix: konkretny nastepny krok
   - Test to add/change
3. "Most valuable next 7 days": priorytety dzien po dniu.
4. "Do not do now": rzeczy, ktore kusza, ale beda strata czasu przed beta.
5. Lista pytan, ktore trzeba rozstrzygnac realnym testem na Shelly + termometrze.

Badz brutalnie konkretny. Jezeli cos wyglada dobrze, powiedz dlaczego. Jezeli cos jest ryzykiem, nie owijaj w bawelne. Nie proponuj przepisywania projektu od zera, chyba ze wskazesz minimalny, inkrementalny plan migracji.
```
