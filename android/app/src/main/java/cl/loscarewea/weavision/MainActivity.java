package cl.loscarewea.weavision;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WeaPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
