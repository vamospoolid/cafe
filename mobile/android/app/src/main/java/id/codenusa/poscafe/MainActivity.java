package id.codenusa.poscafe;

import android.Manifest;
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
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQ_CODE = 2001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KioskPlugin.class);
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

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
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
            String[] permissions = new String[] {
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            };

            boolean needRequest = false;
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    needRequest = true;
                    break;
                }
            }

            if (needRequest) {
                ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQ_CODE);
            }
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
