import React from 'react';
import Sheet from './Sheet';
import { ALERT_STYLES, REMINDER_OPTIONS, REST_OPTIONS } from '../lib/storage';

const STYLE_LABELS = { urgent: 'Urgentes', soft: 'Suaves' };
import { PUBLIC_URL } from '../lib/native';

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

export default function SettingsSheet({ settings, onChange, wakeLock, onClose, native = false }) {
  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="space-y-3">
        <Toggle label="Sons" description={native
          ? 'Alertas a cada 5 min, a 1 min e quando o tempo da tarefa acaba, mesmo com a tela apagada, no volume de alarme. Sons curtos ao concluir e adiar.'
          : 'Alertas a cada 5 min, a 1 min e quando o tempo da tarefa acaba. Sons curtos ao concluir e adiar.'}
          checked={settings.sound} onChange={(sound) => onChange({ ...settings, sound })} />
        <Toggle label="Manter a tela acesa" description={wakeLock.message}
          checked={wakeLock.enabled} onChange={wakeLock.toggle} />
        {wakeLock.storageFailed && <p className="text-sm text-amber-300">Não foi possível salvar esta preferência neste navegador.</p>}
        <label className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 p-4 ring-1 ring-white/5">
          <span>
            <span className="block font-medium text-zinc-100">Tipo de alerta</span>
            <span className="mt-1 block text-sm text-zinc-500">Urgentes avisam que o tempo está acabando; suaves só marcam a passagem do tempo.</span>
          </span>
          <select aria-label="Tipo de alerta" value={settings.alertStyle}
            onChange={(e) => onChange({ ...settings, alertStyle: e.target.value })}
            className="rounded-lg bg-white/10 px-2 py-2 text-zinc-100 [color-scheme:dark]">
            {ALERT_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 p-4 ring-1 ring-white/5">
          <span>
            <span className="block font-medium text-zinc-100">Lembrete depois do tempo</span>
            <span className="mt-1 block text-sm text-zinc-500">Toque curto e suave enquanto a tarefa passa do tempo.</span>
          </span>
          <select aria-label="Lembrete depois do tempo" value={settings.reminderMin}
            onChange={(e) => onChange({ ...settings, reminderMin: Number(e.target.value) })}
            className="rounded-lg bg-white/10 px-2 py-2 text-zinc-100 [color-scheme:dark]">
            {REMINDER_OPTIONS.map((m) => <option key={m} value={m}>{m ? `A cada ${m} min` : 'Nunca'}</option>)}
          </select>
        </label>
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
          {native ? 'Os alertas tocam com a tela apagada ou acesa.' : 'Com a tela acesa, o app continua tocando os alertas.'} Em telas OLED o modo descanso quase não gasta bateria.
          {' '}<a className="underline" href={native ? `${PUBLIC_URL}instrucoes` : '/instrucoes'}>Como criar links de rotina</a>
        </p>
      </div>
    </Sheet>
  );
}
