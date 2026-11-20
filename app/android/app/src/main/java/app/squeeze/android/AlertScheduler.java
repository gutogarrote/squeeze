package app.squeeze.android;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Turns the stored alerts into exact alarms that fire with the screen off and in Doze. */
final class AlertScheduler {

    static final String ACTION = "app.squeeze.android.ALERT";
    static final String EXTRA_KEY = "key";
    // One slot per threshold of the current task (5 min, 1 min, zero) and per overrun
    // reminder (lib/nativeAlerts.js MAX_REMINDERS), with room to spare.
    static final int SLOTS = 40;

    private AlertScheduler() {}

    private static PendingIntent operation(Context context, int slot, String key) {
        Intent intent = new Intent(context, AlertReceiver.class).setAction(ACTION);
        if (key != null) intent.putExtra(EXTRA_KEY, key);
        return PendingIntent.getBroadcast(context, slot, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 100, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelAll(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        for (int slot = 0; slot < SLOTS; slot++) alarms.cancel(operation(context, slot, null));
    }

    /** Replaces every pending alarm. Returns how many were scheduled. */
    static int schedule(Context context, JSONArray alerts) {
        cancelAll(context);
        AlertStore.saveAlerts(context, alerts);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return 0;
        long now = System.currentTimeMillis();
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
        int slot = 0;
        for (int i = 0; i < alerts.length() && slot < SLOTS; i++) {
            JSONObject alert = alerts.optJSONObject(i);
            if (alert == null) continue;
            long at = alert.optLong("atMs", 0);
            String key = alert.optString("key", "");
            if (at <= now || key.isEmpty()) continue;
            PendingIntent operation = operation(context, slot, key);
            try {
                if (exact) alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showApp(context)), operation);
                else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
            } catch (SecurityException e) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
            }
            slot++;
        }
        return slot;
    }
}
