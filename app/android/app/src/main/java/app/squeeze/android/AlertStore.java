package app.squeeze.android;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Persists the alerts scheduled for the current task and the keys already played. An alert is
 * { key, level, atMs, title, body, tones }; the same key reaches us from the alarm and from
 * the web view, and only the first one plays.
 */
final class AlertStore {

    private static final String PREFS = "squeeze_alerts";
    private static final String ALERTS = "alerts";
    private static final String PLAYED = "played";
    private static final int PLAYED_LIMIT = 64;

    private AlertStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void saveAlerts(Context context, JSONArray alerts) {
        prefs(context).edit().putString(ALERTS, alerts.toString()).apply();
    }

    static synchronized JSONArray loadAlerts(Context context) {
        try {
            return new JSONArray(prefs(context).getString(ALERTS, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static JSONObject findAlert(Context context, String key) {
        JSONArray alerts = loadAlerts(context);
        for (int i = 0; i < alerts.length(); i++) {
            JSONObject alert = alerts.optJSONObject(i);
            if (alert != null && key.equals(alert.optString("key"))) return alert;
        }
        return null;
    }

    /** Returns true only for the first caller with this key. */
    static synchronized boolean claim(Context context, String key) {
        SharedPreferences prefs = prefs(context);
        JSONArray played;
        try {
            played = new JSONArray(prefs.getString(PLAYED, "[]"));
        } catch (JSONException e) {
            played = new JSONArray();
        }
        JSONArray next = new JSONArray();
        int from = Math.max(0, played.length() - PLAYED_LIMIT + 1);
        for (int i = 0; i < played.length(); i++) {
            String item = played.optString(i);
            if (key.equals(item)) return false;
            if (i >= from) next.put(item);
        }
        next.put(key);
        // commit(): the receiver may be the last thing this process does.
        prefs.edit().putString(PLAYED, next.toString()).commit();
        return true;
    }
}
