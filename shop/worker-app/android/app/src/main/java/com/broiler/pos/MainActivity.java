package com.broiler.pos;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PairedPrintersPlugin.class);
        super.onCreate(savedInstanceState);
        // The till stays awake while the app is open. A tablet that falls asleep between customers drops the Bluetooth
        // link to the printer and can stop the app's work in the background, which is the first thing to go wrong at
        // a busy counter. (Plug the tablet in at the counter: this costs battery.)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onStart() {
        super.onStart();
        // Android's "font size" and "display size" settings would otherwise enlarge every word in the web page and push
        // the layout apart (a big weight overlapping its price). The page is laid out for 100%.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Bars come back for a moment after a swipe from the edge or a dialog; hide them again.
        if (hasFocus) hideSystemBars();
    }

    /** Full-screen: the status and navigation bars are hidden; a swipe from the edge shows them briefly. */
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
