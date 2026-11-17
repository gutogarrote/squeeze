# App Android

O app Android empacota o mesmo cliente web (`app/build`) com [Capacitor](https://capacitorjs.com) 8.
O projeto nativo fica em `app/android/` (pacote `app.squeeze.android`, minSdk 24, targetSdk 36).
Não há backend: os dados continuam no `localStorage` da WebView do app.

## Alertas com a tela apagada

No navegador, os toques dependem do JavaScript da página, que o sistema suspende quando a tela
apaga. No app, quem toca é o Android:

1. `lib/nativeAlerts.js` converte os limites da tarefa atual (5 min, 1 min, zero) em horários
   absolutos, cada um com uma chave (`tarefa:ativação:nível:horário`) e a receita dos tons de
   `lib/sound.js`.
2. `hooks/useNativeAlerts.js` envia esse plano ao plugin `SqueezeAlerts` sempre que ele muda
   (nova tarefa atual, +5 min, edição, sons desligados, rotina encerrada), não a cada segundo.
3. `AlertScheduler` agenda alarmes exatos (`AlarmManager.setAlarmClock`), que disparam com a tela
   apagada, em Doze e mesmo com o app fechado. `AlertReceiver` segura um wake lock curto,
   sintetiza os tons (`AlertSounds`, mesma receita do Web Audio) e mostra uma notificação
   silenciosa quando o app não está em primeiro plano.
4. Com o app aberto, `useAlerts` continua decidindo o que tocar, mas chama `SqueezeAlerts.play`
   em vez do Web Audio. A chave garante que alarme e WebView nunca toquem o mesmo alerta
   duas vezes (`AlertStore.claim`).

Os toques usam o **volume de alarme** (`USAGE_ALARM`): soam com o volume de mídia zerado.
Enquanto há alertas agendados, o Android mostra o ícone de alarme na barra de status.

Permissões: `USE_EXACT_ALARM` (API 33+) e `SCHEDULE_EXACT_ALARM` (até a API 32) para os alarmes
exatos, `WAKE_LOCK`, `POST_NOTIFICATIONS` (pedida ao tocar em Começar; recusar não impede o som)
e `VIBRATE` (retorno tátil do swipe). `USE_EXACT_ALARM` é restrita, na Play Store, a apps de
alarme/timer: declarar essa função principal na publicação.

Outras diferenças do app: "Manter a tela acesa" usa a flag nativa da janela quando a WebView não
tem a Screen Wake Lock API (`installWakeLock`); o service worker da PWA não é registrado; links
compartilhados usam o endereço público (`PUBLIC_URL` em `lib/native.js`). Alarmes não são
reagendados após reiniciar o aparelho: abrir o app os recria.

## Build

Requisitos: Node da `.nvmrc`, JDK 21 e Android SDK (plataforma 36, build-tools 36) com
`ANDROID_HOME` definido. A partir de `app/`:

```bash
npm ci
npm run android:sync   # build web + cópia para app/android
npm run android:apk    # idem + ./gradlew assembleDebug
# APK: app/android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android   # abre no Android Studio
```

O CI (`android` em `.github/workflows/ci.yml`) gera o mesmo APK de debug e o publica como
artefato `squeeze-debug-apk`. Não há assinatura de release nem publicação configuradas; não
versionar keystores. Os assets copiados, `build/` e `local.properties` são ignorados pelo git.

## Verificação manual no aparelho

- Começar uma rotina com uma tarefa de 6 min, apagar a tela: toques aos 5 min, 1 min e zero.
- Repetir com o app removido dos recentes.
- Com o app aberto, cada limite toca uma única vez.
- +5 min e concluir a tarefa reagendam; desligar Sons ou encerrar cancela.
