package app.squeeze.android;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SqueezeAlertsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
