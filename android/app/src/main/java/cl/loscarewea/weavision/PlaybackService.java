package cl.loscarewea.weavision;

import android.content.Intent;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Media session for notifications, lock screen, TV and Android Auto (audio only in the car). */
public class PlaybackService extends MediaLibraryService {
    private MediaLibrarySession session;

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaLibrarySession.Builder(this, Players.get(this), new Callback()).build();
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player p = session.getPlayer();
        if (!p.getPlayWhenReady() || p.getMediaItemCount() == 0) stopSelf();
    }

    @Override
    public void onDestroy() {
        session.release(); // the shared player lives on for the app screen
        super.onDestroy();
    }

    private final class Callback implements MediaLibrarySession.Callback {
        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
                MediaLibrarySession s, MediaSession.ControllerInfo browser, @Nullable LibraryParams params) {
            return Futures.immediateFuture(LibraryResult.ofItem(Library.root(), params));
        }

        @Override
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
                MediaLibrarySession s, MediaSession.ControllerInfo browser, String parentId,
                int page, int pageSize, @Nullable LibraryParams params) {
            List<MediaItem> all = Library.children(PlaybackService.this, parentId);
            int from = Math.min(all.size(), page * pageSize);
            int to = Math.min(all.size(), from + pageSize);
            return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(all.subList(from, to)), params));
        }

        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
                MediaLibrarySession s, MediaSession.ControllerInfo browser, String mediaId) {
            JSONObject ch = Library.find(PlaybackService.this, mediaId);
            if (ch == null) return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE));
            return Futures.immediateFuture(LibraryResult.ofItem(
                Players.item(mediaId, ch.optString("name"), Library.opt(ch, "group"), Library.opt(ch, "logo"), false), null));
        }

        @Override
        public ListenableFuture<List<MediaItem>> onAddMediaItems(
                MediaSession s, MediaSession.ControllerInfo controller, List<MediaItem> items) {
            List<MediaItem> resolved = new ArrayList<>();
            for (MediaItem item : items) {
                JSONObject ch = Library.find(PlaybackService.this, item.mediaId);
                if (ch == null) {
                    if (item.localConfiguration != null) resolved.add(item);
                    continue;
                }
                Players.setHeaders(Library.opt(ch, "userAgent"), Library.opt(ch, "referrer"));
                resolved.add(Players.item(item.mediaId, ch.optString("name"), Library.opt(ch, "group"), Library.opt(ch, "logo"), true));
            }
            return Futures.immediateFuture(resolved);
        }
    }
}
