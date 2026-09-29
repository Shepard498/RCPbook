package io.github.shepard498.rcpbook;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecipePlatformPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
