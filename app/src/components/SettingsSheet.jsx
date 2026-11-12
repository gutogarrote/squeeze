import React from 'react';
import Sheet from './Sheet';
import { REST_OPTIONS } from '../lib/storage';

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl bg-zinc-900 p-4 ring-1 ring-white/5">
      <span>
        <span className="block font-medium text-zinc-100">{label}</span>
        {description && <span className="mt-1 block text-sm text-zinc-500">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-lime-300" />
    </label>
  );
}

export default function SettingsSheet({ settings, onChange, wakeLock, nativeAlerts, onClose }) {
  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="space-y-3">
        <Toggle label="Sons" description="Toques aos 5 min, a 1 min e quando o tempo da tarefa acaba."
          checked={settings.sound} onChange={(sound) => onChange({ ...settings, sound })} />
        {nativeAlerts && <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-400" role="status">
          <p>{nativeAlerts.error || (nativeAlerts.permission === 'granted'
            ? 'Notificações permitidas. Os alertas podem tocar com a tela bloqueada; os ajustes de som do aparelho continuam valendo.'
            : nativeAlerts.permission === 'denied'
              ? 'Notificações bloqueadas. Permita notificações e sons nos ajustes do aparelho para receber alertas com a tela bloqueada.'
              : 'Permita notificações para receber alertas com a tela bloqueada.')}</p>
          <p className="mt-2">No Android, a economia de bateria pode atrasar ou agrupar os alertas.</p>
          {(nativeAlerts.permission !== 'granted' || nativeAlerts.error) && <button type="button"
            className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-zinc-100" onClick={nativeAlerts.requestPermission}>
            {nativeAlerts.error ? 'Tentar novamente' : 'Verificar permissão'}
          </button>}
        </div>}
        <Toggle label="Manter a tela acesa" description={wakeLock.message}
          checked={wakeLock.enabled} onChange={wakeLock.toggle} />
        {wakeLock.storageFailed && <p className="text-sm text-amber-300">Não foi possível salvar esta preferência neste navegador.</p>}
        <label className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 p-4 ring-1 ring-white/5">
          <span>
            <span className="block font-medium text-zinc-100">Modo descanso</span>
            <span className="mt-1 block text-sm text-zinc-500">Tela preta durante a rotina, depois de um tempo sem toques. Um toque volta.</span>
          </span>
          <select aria-label="Modo descanso" value={settings.restAfterMin}
            onChange={(e) => onChange({ ...settings, restAfterMin: Number(e.target.value) })}
            className="rounded-lg bg-white/10 px-2 py-2 text-zinc-100 [color-scheme:dark]">
            {REST_OPTIONS.map((m) => <option key={m} value={m}>{m ? `${m} min` : 'Nunca'}</option>)}
          </select>
        </label>
        <p className="pt-2 text-xs text-zinc-600">
          {nativeAlerts ? 'Os alertas pertencem à rotina em andamento. Encerrar a rotina ou desligar os sons cancela os próximos avisos.'
            : 'Com a tela acesa, o app continua tocando os alertas. Em telas OLED o modo descanso quase não gasta bateria.'}
          {' '}<a className="underline" href="/instrucoes">Como criar links de rotina</a>
        </p>
      </div>
    </Sheet>
  );
}
