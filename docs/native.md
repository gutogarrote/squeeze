# Android e iPhone — Squeeze

O mesmo React/Vite é distribuído como PWA e como app Capacitor 8. Os projetos ficam em
`app/android` e `app/ios`; o identificador é `dev.ggarrote.squeeze`. O app nativo inclui
os arquivos do build e funciona offline desde a primeira abertura. Não há servidor,
login, sincronização, push remoto ou modo de execução contínua em segundo plano.

## Preparar e compilar

Use Node 26.13.0 (`nvm use` na raiz). A partir de `app/`:

```sh
npm ci
npm run native:sync
```

Esse comando gera o build, sintetiza os três WAVs a partir de `src/lib/alertTones.mjs`
e sincroniza assets e plugins nos dois projetos. Os WAVs e os arquivos copiados do
build são ignorados pelo Git. Sempre rode o comando depois de mudar o código web,
configuração ou dependências. Os projetos nativos, referências dos sons no Xcode e
Gradle Wrapper são versionados. O app nativo não registra o service worker da PWA.

**Android:** Android Studio, JDK 21 e SDK Android 36. A versão mínima é Android 7
(API 24). Configure o SDK pelo Android Studio ou `ANDROID_HOME`.

```sh
npm run android:open
# Ou, para gerar um APK de desenvolvimento:
npm run android:build
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

O APK de desenvolvimento serve para testes e instalação pessoal. Para distribuição
estável, use **Build → Generate Signed App Bundle / APK** no Android Studio e guarde
a chave de assinatura fora do repositório. Preserve a mesma chave para atualizar sem
desinstalar e perder dados. Não é necessário publicar na Play Store. As exigências
de verificação de desenvolvedor dependem da região; existe cadastro gratuito de
distribuição limitada para uso pessoal/pequenos grupos.

**iPhone:** um Mac com Xcode 26 ou posterior, iPhone com iOS 15 ou posterior e uma
conta Apple. A partir de `app/`:

```sh
npm run ios:open
```

No Xcode, selecione o target **App**, configure sua equipe em **Signing & Capabilities**,
conecte o iPhone e execute. O projeto usa Swift Package Manager. Uma conta gratuita
permite testes pessoais, mas exige reinstalação a cada sete dias. TestFlight exige
assinatura do Apple Developer Program, revisão inicial para testes externos e novos
builds antes da expiração de 90 dias. Não há equipe, certificado ou segredo fixado
no projeto. Compilar/assinar iOS exige macOS; `native:sync` também funciona no Linux.

## Sons com a tela bloqueada

- Na primeira rotina com sons ativados, o app solicita permissão de notificações.
  **Ajustes** mostra a permissão e permite verificar/tentar novamente. Se a permissão
  foi negada, habilite notificações **e sons** nos ajustes do aparelho.
- Com o app ativo, o relógio e Web Audio mantêm os alertas existentes. Ao perder foco,
  o app entrega ao sistema somente os limites futuros da tarefa atual: 5 min, 1 min
  e zero. Os próximos cartões não são agendados: tarefas nunca terminam sozinhas.
- Ao retornar, o app cancela os avisos pendentes e atualiza a referência pelo relógio
  real, sem repetir limites já passados. Uma mudança de tarefa, edição, +5 min,
  alteração de deadline, encerramento ou desativação de sons invalida o agendamento.
  Cancelamentos e novos agendamentos são serializados, incluindo respostas nativas
  atrasadas. Um som que já começou não pode ser desfeito.
- Os WAVs são PCM mono de 16 bits, menores que 30 s, com as mesmas frequências,
  ritmos e envelopes dos sons web. Android usa um canal por som; ajustes de canal
  feitos pelo usuário prevalecem. Não há alerta em tela cheia, som contínuo, AlarmKit
  nem exceção a silencioso/Focus/Não Perturbe.
- Android usa notificações **inexatas**, `isExactNotification: false` e
  `allowWhileIdle: true` para permitir acordar o aparelho sem modo de despertador.
  A permissão `SCHEDULE_EXACT_ALARM` herdada do plugin é removida pelo manifest.
  Não há pedido de “Alarmes e lembretes” nem indicador de próximo despertador.
  O Android pode agrupar/atrasar avisos, inclusive por vários minutos; Doze limita
  avisos próximos. Agendar para daqui a quatro segundos não garante entrega em
  quatro segundos. Esse compromisso é intencional; a PWA continua dependendo de
  manter a tela acesa.
- Notificações dependem do sistema, da permissão e dos ajustes de som. Force-stop no
  Android, desinstalação e restrições do fabricante podem impedir a entrega. Uma
  rotina ativa pode continuar notificando depois que sua interface foi suspensa.

Os dados nativos ficam no `localStorage` privado do WebView e não são compartilhados
com navegador/PWA nem entre aparelhos. A primeira instalação começa com dados próprios.
Desinstalar remove esses dados. Links copiados pelo app usam o endereço público
`https://squeeze.ggarrote.workers.dev/`, nunca o localhost interno do Capacitor.

## Verificação

```sh
npm run lint -- --max-warnings=0
npm test -- --run
npm run native:sync
# Com SDK/JDK configurados:
cd android
./gradlew assembleDebug lintDebug
```

O workflow de CI inclui compilação Android e iOS para simulador (sem assinatura). Testes de JavaScript
cobrem cálculo de limites, orçamento comprimido, cancelamento/reagendamento, +5 min,
mudança de tarefa, edição, deadline, conclusão/reativação, encerramento, mute,
permissões, falhas nativas, corridas assíncronas, retorno do segundo plano, StrictMode
e geração dos sons. Eles verificam a intenção de agendar, não a entrega pelo aparelho.

Antes de distribuir, valide em Android e iPhone **reais**:

1. Comece uma tarefa, permita notificações, bloqueie a tela e confira os três sons,
   também sem rede. Verifique em segundo plano pelo botão Home/troca de aplicativo.
2. Com 5:04 restantes, acrescente minutos ou mude a tarefa. Bloqueie novamente: o
   aviso antigo não deve tocar; os novos devem corresponder à tarefa/orçamento atual.
3. Teste tarefas curtas, edição, +5 deadline, conclusão, adiamento e reativação; nenhum
   aviso da tarefa anterior deve permanecer. Confira os avisos imediatos existentes
   quando uma tarefa já abaixo de um limite vira a atual.
4. Desative sons ou encerre a rotina: nenhum novo aviso. Retorne após um limite ter
   passado: não deve haver repetição entre Web Audio e notificação. Reabra o processo
   e confira a rotina salva; o tempo deve incluir o período fechado.
5. Negue e depois conceda permissão nas configurações. Teste silencioso/Focus,
   canais Android sem som e economia de bateria. Confirme que o comportamento
   respeita esses ajustes e aceite os atrasos do agendamento inexato.
6. No Android de teste, use `adb shell dumpsys deviceidle force-idle` para observar
   o adiamento/agrupamento, e `adb shell dumpsys deviceidle unforce` ao terminar.
   Confira a ausência de “Alarmes e lembretes” no fluxo e de permissões de alarme
   exato no manifest compilado. Não use Doze como teste de precisão.
7. Confira o layout com notch/teclado, atualize o APK com a mesma assinatura e teste
   o build iOS/TestFlight instalado. Simuladores e browser não validam sons bloqueados.
