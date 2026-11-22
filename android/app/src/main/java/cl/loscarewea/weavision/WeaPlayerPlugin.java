package cl.loscarewea.weavision;

import android.app.PictureInPictureParams;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Rational;
import android.view.Window;
import android.view.WindowManager;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridges the web UI to ExoPlayer, which renders beneath the transparent WebView. */
@CapacitorPlugin(name = "WeaPlayer")
public class WeaPlayerPlugin extends Plugin {
    /** MainActivity forwards picture-in-picture changes here. */
    static WeaPlayerPlugin instance;
    private ExoPlayer player;
    private PlayerView view;
    private boolean fullscreen;

    private final Player.Listener listener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) { emit(null); }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) { emit(null); }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) { emit(error.getErrorCodeName()); }
    };

    @Override
    public void load() {
        instance = this;
        getActivity().runOnUiThread(() -> {
            // The app offers no brightness control on a TV: always the panel's maximum.
            if (isTv()) setBrightness(1f);
            player = Players.get(getContext());
            WebView web = getBridge().getWebView();
            web.setBackgroundColor(Color.TRANSPARENT);
            view = new PlayerView(getContext());
            view.setUseController(false);
            view.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
            view.setShutterBackgroundColor(Color.BLACK);
            view.setKeepScreenOn(true);
            view.setPlayer(player);
            ((ViewGroup) web.getParent()).addView(view, 0, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            player.addListener(listener);
        });
    }

    private void emit(String errorCode) {
        String state;
        if (errorCode != null) state = "error";
        else if (player.isPlaying()) state = "playing";
        else if (player.getPlaybackState() == Player.STATE_BUFFERING) state = "loading";
        else if (player.getPlaybackState() == Player.STATE_READY) state = "paused";
        else state = "idle";
        JSObject data = new JSObject();
        data.put("state", state);
        if (errorCode != null) data.put("message", errorCode);
        notifyListeners("state", data);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Falta la URL");
            return;
        }
        String title = call.getString("title", "WeaVision");
        getActivity().runOnUiThread(() -> {
            Players.setHeaders(call.getString("userAgent"), call.getString("referrer"));
            player.setMediaItem(Players.item(url, title, call.getString("group"), call.getString("logo"), true));
            player.prepare();
            player.play();
            // Keeps the session alive for the notification, lock screen and Android Auto.
            getContext().startService(new Intent(getContext(), PlaybackService.class));
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) { onUi(call, () -> player.pause()); }

    @PluginMethod
    public void resume(PluginCall call) { onUi(call, () -> player.play()); }

    @PluginMethod
    public void stop(PluginCall call) { onUi(call, () -> { player.stop(); player.clearMediaItems(); }); }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float v = call.getFloat("volume", 1f);
        onUi(call, () -> player.setVolume(Math.max(0f, Math.min(1f, v))));
    }

    /** Hides status and navigation bars (swipe to peek) and uses the area around the camera cutout. */
    @PluginMethod
    public void setFullscreen(PluginCall call) {
        fullscreen = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            applyFullscreen();
            call.resolve();
        });
    }

    private void applyFullscreen() {
        Window w = getActivity().getWindow();
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(w, w.getDecorView());
        if (fullscreen) {
            bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            bars.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            bars.show(WindowInsetsCompat.Type.systemBars());
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = fullscreen
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            w.setAttributes(lp);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Android shows the bars again after switching apps; restore the player's fullscreen.
        if (fullscreen) getActivity().runOnUiThread(this::applyFullscreen);
    }

    private boolean isTv() {
        UiModeManager ui = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        return ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private boolean pipSupported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    /** What the device is, so the web UI shows only the controls that make sense on it. */
    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("tv", isTv());
        r.put("pip", pipSupported());
        call.resolve(r);
    }

    /** Current media volume and screen brightness, both 0..1, for the swipe gestures. */
    @PluginMethod
    public void levels(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            float brightness = getActivity().getWindow().getAttributes().screenBrightness;
            if (brightness < 0) {
                try {
                    brightness = Settings.System.getInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f;
                } catch (Settings.SettingNotFoundException e) {
                    brightness = 0.5f;
                }
            }
            JSObject r = new JSObject();
            r.put("volume", max > 0 ? audio.getStreamVolume(AudioManager.STREAM_MUSIC) / (float) max : 0);
            r.put("volumeSteps", max);
            r.put("brightness", Math.min(1f, brightness));
            call.resolve(r);
        });
    }

    /** kind "volume" sets the system media volume; "brightness" this window's (-1 = back to the system's). */
    @PluginMethod
    public void setLevel(PluginCall call) {
        String kind = call.getString("kind", "volume");
        float v = call.getFloat("value", 0f);
        onUi(call, () -> {
            if ("brightness".equals(kind)) {
                setBrightness(isTv() ? 1f : v < 0 ? -1f : Math.max(0.01f, Math.min(1f, v)));
            } else {
                AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(Math.max(0f, Math.min(1f, v)) * max), 0);
            }
        });
    }

    private void setBrightness(float v) {
        Window w = getActivity().getWindow();
        WindowManager.LayoutParams lp = w.getAttributes();
        lp.screenBrightness = v;
        w.setAttributes(lp);
    }

    @PluginMethod
    public void enterPip(PluginCall call) {
        if (!pipSupported()) {
            call.reject("Imagen en imagen no está disponible en este equipo");
            return;
        }
        getActivity().runOnUiThread(() -> {
            VideoSize size = player.getVideoSize();
            Rational ratio = size.width > 0 && size.height > 0 ? new Rational(size.width, size.height) : new Rational(16, 9);
            // Android only accepts ratios between 1:2.39 and 2.39:1.
            float f = ratio.floatValue();
            if (f > 2.39f || f < 1 / 2.39f) ratio = new Rational(16, 9);
            try {
                getActivity().enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(ratio).build());
                call.resolve();
            } catch (IllegalStateException e) {
                call.reject(e.getMessage());
            }
        });
    }

    void onPip(boolean on, boolean dismissed) {
        // Swiping the floating window away ends the picture, as in any video app.
        if (dismissed && player != null) player.pause();
        JSObject data = new JSObject();
        data.put("on", on);
        notifyListeners("pip", data);
    }

    @PluginMethod
    public void syncLibrary(PluginCall call) {
        JSArray favorites = call.getArray("favorites", new JSArray());
        JSArray recent = call.getArray("recent", new JSArray());
        Library.save(getContext(), Library.FAVORITES, favorites.toString());
        Library.save(getContext(), Library.RECENT, recent.toString());
        call.resolve();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        // On a TV, leaving the app must stop the picture; on phones audio may keep playing in background.
        if (player != null && isTv()) player.pause();
    }

    private void onUi(PluginCall call, Runnable r) {
        getActivity().runOnUiThread(() -> {
            r.run();
            call.resolve();
        });
    }
}
