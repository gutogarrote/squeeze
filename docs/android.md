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

Os lembretes depois do fim da tarefa (§10 de specifications.md) também viram alarmes: até 30,
cobrindo cerca de uma hora de atraso. Os sons curtos dos gestos (concluir, adiar, fim da rotina)
tocam pela WebView, no volume de mídia, porque só acontecem com o app aberto.

Os toques usam o **volume de alarme** (`USAGE_ALARM`): soam com o volume de mídia zerado.
Enquanto há alertas agendados, o Android mostra o ícone de alarme na barra de status.

Permissões: `USE_EXACT_ALARM` (API 33+) e `SCHEDULE_EXACT_ALARM` (até a API 32) para os alarmes
exatos, `WAKE_LOCK`, `POST_NOTIFICATIONS` (pedida ao tocar em Começar; recusar não impede o som)
e `VIBRATE` (retorno tátil do swipe). `USE_EXACT_ALARM` é restrita, na Play Store, a apps de
alarme/timer: declarar essa função principal na publicação.

Compartilhar durante a rotina abre a folha de compartilhamento do Android (`SqueezeAlerts.share`),
com o link no endereço público.

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

Os assets copiados, `build/` e `local.properties` são ignorados pelo git.

## Assinatura e atualização

O Android só instala uma versão por cima da outra se as duas tiverem a mesma assinatura; caso
contrário é preciso desinstalar, o que apaga as rotinas salvas no app. Por isso o APK distribuído
é um release assinado com um keystore fixo, que fica fora do repositório.

Gerar o keystore uma única vez (guardar o arquivo e a senha em lugar seguro; perdê-los impede
atualizar o app instalado):

```bash
keytool -genkeypair -v -keystore squeeze-release.jks -alias squeeze \
  -keyalg RSA -keysize 2048 -validity 10000
```

O build lê a assinatura do ambiente: `SQUEEZE_KEYSTORE_FILE` (caminho do `.jks`),
`SQUEEZE_KEYSTORE_PASSWORD`, `SQUEEZE_KEY_ALIAS`, `SQUEEZE_KEY_PASSWORD` e, opcionalmente,
`SQUEEZE_VERSION_CODE`. Com elas definidas, `npm run android:release` gera
`app/android/app/build/outputs/apk/release/app-release.apk` assinado.

No CI, o job `android` usa os secrets `ANDROID_KEYSTORE_BASE64` (o `.jks` em base64),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, numera a versão pelo
número da execução e publica o artefato `squeeze-apk`. Sem os secrets (forks, por exemplo) o
artefato é um APK de debug, que não atualiza o release instalado. Não há publicação em loja.

## Links de rotina no app (App Links)

Links `https://squeeze.ggarrote.workers.dev/?rotina=...` abrem no app quando ele está instalado e
no navegador quando não está. Três peças:

- `AndroidManifest.xml` declara o filtro verificado (`autoVerify`) para a raiz do site. Só a raiz:
  `/instrucoes` continua no navegador.
- `app/public/.well-known/assetlinks.json`, publicado com o site, lista a impressão digital
  SHA-256 do keystore. O Android confere esse arquivo ao instalar o app; sem ele, ou com a
  impressão errada, os links abrem sempre no navegador.
- O plugin emite o evento `routineLink` (retido até a web escutar, para não perder o link numa
  abertura a frio) e `App.jsx` importa a rotina como faz com o endereço na web: vira o rascunho,
  ou pergunta antes de substituir uma rotina em andamento.

Impressão digital para o `assetlinks.json`:

```bash
keytool -list -v -keystore squeeze-release.jks -alias squeeze | grep SHA256
```

Depois de alterar o arquivo é preciso publicar o site (`npm run deploy`) e reinstalar o app para
o Android verificar de novo. Conferir no aparelho com
`adb shell pm get-app-links app.squeeze.android` (esperado: `verified`).

## Verificação manual no aparelho

- Começar uma rotina com uma tarefa de 6 min, apagar a tela: toques aos 5 min, 1 min e zero.
- Repetir com o app removido dos recentes.
- Com o app aberto, cada limite toca uma única vez.
- +5 min e concluir a tarefa reagendam; desligar Sons ou encerrar cancela.
- Tocar num link de rotina (por exemplo, numa mensagem) abre o app com a rotina no planejamento;
  com uma rotina em andamento, o app pergunta antes de substituir.
- Instalar uma versão nova por cima mantém as rotinas salvas.
