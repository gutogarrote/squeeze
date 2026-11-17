package app.squeeze.android;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import org.json.JSONArray;
import org.json.JSONObject;

/** Fires at each alert time, even with the screen off or the app closed. */
public class AlertReceiver extends BroadcastReceiver {

    static final String CHANNEL = "alerts";
    static final int NOTIFICATION_ID = 1;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!AlertScheduler.ACTION.equals(intent.getAction())) return;
        String key = intent.getStringExtra(AlertScheduler.EXTRA_KEY);
        if (key == null) return;
        JSONObject alert = AlertStore.findAlert(context, key);
        if (alert == null) return;
        final Context app = context.getApplicationContext();
        final PendingResult result = goAsync();
        new Thread(() -> {
            try {
                deliver(app, alert, !SqueezeAlertsPlugin.isInForeground());
            } finally {
                result.finish();
            }
        }, "squeeze-alert").start();
    }

    /** Plays one alert unless its key already played. Blocks until the sound ends. */
    static boolean deliver(Context context, JSONObject alert, boolean notify) {
        String key = alert.optString("key", "");
        JSONArray tones = alert.optJSONArray("tones");
        if (key.isEmpty() || tones == null || !AlertStore.claim(context, key)) return false;
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock lock = power == null ? null
            : power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "squeeze:alert");
        try {
            if (lock != null) lock.acquire(15000);
            if (notify) showNotification(context, alert);
            AlertSounds.play(tones);
        } finally {
            if (lock != null && lock.isHeld()) lock.release();
        }
        return true;
    }

    static void clearNotification(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
    }

    private static void showNotification(Context context, JSONObject alert) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Silent channel: the tone itself is synthesized and played on the alarm stream.
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                context.getString(R.string.alerts_channel), NotificationManager.IMPORTANCE_HIGH);
            channel.setSound(null, null);
            channel.enableVibration(true);
            manager.createNotificationChannel(channel);
            builder = new Notification.Builder(context, CHANNEL);
        } else {
            builder = new Notification.Builder(context);
        }
        Intent open = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        builder.setSmallIcon(R.drawable.ic_stat_squeeze)
            .setContentTitle(alert.optString("title", context.getString(R.string.app_name)))
            .setContentText(alert.optString("body", ""))
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setWhen(alert.optLong("atMs", System.currentTimeMillis()))
            .setShowWhen(true)
            .setContentIntent(PendingIntent.getActivity(context, 101, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        try {
            manager.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // Notifications are optional; the sound still plays.
        }
    }
}
