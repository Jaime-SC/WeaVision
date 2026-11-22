package cl.loscarewea.weavision;

import android.content.Context;
import android.net.Uri;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.HashMap;
import java.util.Map;

/** The one ExoPlayer shared by the app screen (video) and the Android Auto service (audio). */
final class Players {
    static final String DEFAULT_UA = "WeaVision/2.0 (Android)";
    private static ExoPlayer player;
    private static DefaultHttpDataSource.Factory http;

    private Players() {}

    /** Must be called on the main thread. */
    static synchronized ExoPlayer get(Context context) {
        if (player == null) {
            Context app = context.getApplicationContext();
            http = new DefaultHttpDataSource.Factory()
                .setUserAgent(DEFAULT_UA)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);
            AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                .build();
            player = new ExoPlayer.Builder(app)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(app).setDataSourceFactory(new DefaultDataSource.Factory(app, http)))
                .setAudioAttributes(audio, true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();
        }
        return player;
    }

    // shortcut: headers are global to the player, fine because only one stream plays at a time.
    static void setHeaders(@Nullable String userAgent, @Nullable String referrer) {
        if (http == null) return;
        http.setUserAgent(userAgent == null || userAgent.isEmpty() ? DEFAULT_UA : userAgent);
        Map<String, String> props = new HashMap<>();
        if (referrer != null && !referrer.isEmpty()) props.put("Referer", referrer);
        http.setDefaultRequestProperties(props);
    }

    static MediaItem item(String url, String title, @Nullable String group, @Nullable String logo, boolean withUri) {
        MediaMetadata.Builder meta = new MediaMetadata.Builder()
            .setTitle(title)
            .setDisplayTitle(title)
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION);
        if (group != null) meta.setArtist(group);
        if (logo != null && logo.startsWith("http")) meta.setArtworkUri(Uri.parse(logo));
        MediaItem.Builder b = new MediaItem.Builder().setMediaId(url).setMediaMetadata(meta.build());
        if (withUri) {
            b.setUri(url);
            String path = url.toLowerCase().split("[?#]")[0];
            // Lists often hide HLS behind URLs without .m3u8; ExoPlayer sniffs MPEG-TS on its own.
            if (path.endsWith(".m3u8") || path.contains("/hls/")) b.setMimeType(MimeTypes.APPLICATION_M3U8);
        }
        return b.build();
    }
}
