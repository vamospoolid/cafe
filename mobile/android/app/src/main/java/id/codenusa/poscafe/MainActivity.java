package id.codenusa.poscafe;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KioskPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

@CapacitorPlugin(name = "KioskPlugin")
class KioskPlugin extends Plugin {
    @PluginMethod()
    public void enableKiosk(com.getcapacitor.PluginCall call) {
        try {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    getActivity().startLockTask();
                    call.resolve();
                }
            });
        } catch (Exception e) {
            call.reject("Gagal mengaktifkan Kiosk Mode: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void disableKiosk(com.getcapacitor.PluginCall call) {
        try {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    getActivity().stopLockTask();
                    call.resolve();
                }
            });
        } catch (Exception e) {
            call.reject("Gagal menonaktifkan Kiosk Mode: " + e.getMessage());
        }
    }
}
