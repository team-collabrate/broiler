package com.broiler.pos;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The till stays awake while the app is open. A tablet that falls asleep between customers drops the Bluetooth
        // link to the printer and can stop the app's work in the background, which is the first thing to go wrong at
        // a busy counter. (Plug the tablet in at the counter: this costs battery.)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
