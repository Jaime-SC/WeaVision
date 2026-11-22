package cl.loscarewea.weavision;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Favourites and recents synced from the web app, browsed by Android Auto. */
final class Library {
    static final String ROOT = "root";
    static final String FAVORITES = "favorites";
    static final String RECENT = "recent";
    private static final String PREFS = "weavision_library";

    private Library() {}

    static void save(Context ctx, String key, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(key, json).apply();
    }

    static MediaItem root() {
        return folder(ROOT, "WeaVision");
    }

    static List<MediaItem> children(Context ctx, String parentId) {
        List<MediaItem> out = new ArrayList<>();
        if (ROOT.equals(parentId)) {
            out.add(folder(FAVORITES, "Favoritos"));
            out.add(folder(RECENT, "Recientes"));
            return out;
        }
        for (JSONObject ch : channels(ctx, parentId)) {
            out.add(Players.item(ch.optString("url"), ch.optString("name"), opt(ch, "group"), opt(ch, "logo"), false));
        }
        return out;
    }

    /** Finds a synced channel by its URL (the media id). */
    @Nullable
    static JSONObject find(Context ctx, String url) {
        for (String key : new String[] {FAVORITES, RECENT}) {
            for (JSONObject ch : channels(ctx, key)) if (url.equals(ch.optString("url"))) return ch;
        }
        return null;
    }

    @Nullable
    static String opt(JSONObject o, String key) {
        String v = o.optString(key, "");
        return v.isEmpty() ? null : v;
    }

    private static List<JSONObject> channels(Context ctx, String key) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        List<JSONObject> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(p.getString(key, "[]"));
            for (int i = 0; i < arr.length(); i++) out.add(arr.getJSONObject(i));
        } catch (JSONException ignored) {
            // A corrupt sync just shows an empty folder; the next sync rewrites it.
        }
        return out;
    }

    private static MediaItem folder(String id, String title) {
        return new MediaItem.Builder()
            .setMediaId(id)
            .setMediaMetadata(new MediaMetadata.Builder()
                .setTitle(title)
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS)
                .build())
            .build();
    }
}
