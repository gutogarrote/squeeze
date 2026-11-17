package app.squeeze.android;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.view.WindowManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Bridge used by the web app (lib/native.js):
 * - sync({ alerts }): replaces the exact alarms for the current task's alerts;
 * - play({ alert }): plays one alert now, unless its alarm already did;
 * - keepScreenOn({ on }); requestNotifications();
 * - event "routineLink" { url }: a routine link opened the app (App Links).
 */
@CapacitorPlugin(
    name = "SqueezeAlerts",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class SqueezeAlertsPlugin extends Plugin {

    private static volatile boolean foreground = false;
    private static volatile boolean skipIntent = false;
    private final ExecutorService player = Executors.newSingleThreadExecutor();

    static boolean isInForeground() {
        return foreground;
    }

    static void skipNextIntent(boolean skip) {
        skipIntent = skip;
    }

    // Called for the launch intent and for links opened while the app is running. The event is
    // retained until the web app listens, so a cold start does not lose the link.
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        boolean skip = skipIntent;
        skipIntent = false;
        Uri link = intent.getData();
        boolean fromHistory = (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        if (skip || fromHistory || link == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        JSObject data = new JSObject();
        data.put("url", link.toString());
        notifyListeners("routineLink", data, true);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        foreground = true;
        AlertReceiver.clearNotification(getContext());
    }

    @Override
    protected void handleOnPause() {
        foreground = false;
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        foreground = false;
        player.shutdown();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        JSArray alerts = call.getArray("alerts", new JSArray());
        int scheduled = AlertScheduler.schedule(getContext(), alerts);
        JSObject result = new JSObject();
        result.put("scheduled", scheduled);
        call.resolve(result);
    }

    @PluginMethod
    public void play(PluginCall call) {
        final JSONObject alert = call.getObject("alert");
        if (alert == null) {
            call.reject("alert is required");
            return;
        }
        player.execute(() -> {
            boolean played = AlertReceiver.deliver(getContext(), alert, false);
            JSObject result = new JSObject();
            result.put("played", played);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveNotifications(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsResult");
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        resolveNotifications(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void resolveNotifications(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
