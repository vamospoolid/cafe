package id.codenusa.poscafe;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQ_CODE = 2001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KioskPlugin.class);
        registerPlugin(HardwareBridgePlugin.class);
        super.onCreate(savedInstanceState);

        requestAppPermissions();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setGeolocationEnabled(true);
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setDatabaseEnabled(true);
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setAllowFileAccess(true);

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        // Otomatis berikan izin kamera, audio, dan media tanpa dialog ganda
                        request.grant(request.getResources());
                    });
                }

                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                    callback.invoke(origin, true, false);
                }
            });
        }
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissions = new ArrayList<>();
            permissions.add(Manifest.permission.CAMERA);
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);

            // Android 12+ (API 31+) Wajib Runtime Permission untuk Bluetooth Printer
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
                permissions.add(Manifest.permission.BLUETOOTH_SCAN);
            }

            List<String> needRequest = new ArrayList<>();
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    needRequest.add(perm);
                }
            }

            if (!needRequest.isEmpty()) {
                ActivityCompat.requestPermissions(this, needRequest.toArray(new String[0]), PERMISSION_REQ_CODE);
            }
        }
    }
}

@CapacitorPlugin(name = "HardwareBridge")
class HardwareBridgePlugin extends Plugin {

    @PluginMethod()
    public void getHardwareStatus(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            boolean hasCamera = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
            
            BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
            boolean hasBluetooth = btAdapter != null;
            boolean isBluetoothEnabled = btAdapter != null && btAdapter.isEnabled();

            ret.put("hasCamera", hasCamera);
            ret.put("hasBluetooth", hasBluetooth);
            ret.put("isBluetoothEnabled", isBluetoothEnabled);
            ret.put("androidVersion", Build.VERSION.SDK_INT);
            ret.put("isNativeAndroid", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membaca status hardware: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void requestEnableBluetooth(PluginCall call) {
        try {
            BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
            if (btAdapter == null) {
                call.reject("Perangkat ini tidak memiliki adaptor Bluetooth hardware.");
                return;
            }

            if (btAdapter.isEnabled()) {
                JSObject ret = new JSObject();
                ret.put("alreadyEnabled", true);
                call.resolve(ret);
                return;
            }

            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            getActivity().startActivity(enableBtIntent);
            
            JSObject ret = new JSObject();
            ret.put("prompted", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal meminta sistem menyalakan Bluetooth: " + e.getMessage());
        }
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
