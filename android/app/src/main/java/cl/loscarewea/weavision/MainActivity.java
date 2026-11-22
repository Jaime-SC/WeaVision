package cl.loscarewea.weavision;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WeaPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        // Leaving PiP while stopped means the user swiped the floating window away.
        boolean dismissed = !inPip && getLifecycle().getCurrentState() == Lifecycle.State.CREATED;
        if (WeaPlayerPlugin.instance != null) WeaPlayerPlugin.instance.onPip(inPip, dismissed);
    }
}
