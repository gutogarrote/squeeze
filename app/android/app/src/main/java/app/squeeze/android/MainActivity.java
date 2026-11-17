package app.squeeze.android;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // A restored activity gets its old intent again; its link was already imported.
        SqueezeAlertsPlugin.skipNextIntent(savedInstanceState != null);
        registerPlugin(SqueezeAlertsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
