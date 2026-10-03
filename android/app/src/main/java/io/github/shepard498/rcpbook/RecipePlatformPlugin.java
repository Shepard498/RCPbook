package io.github.shepard498.rcpbook;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "RecipePlatform")
public class RecipePlatformPlugin extends Plugin {
    @PluginMethod
    public void saveBackup(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || call.getString("data") == null) {
            call.reject("Backup filename and data are required.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "backupFileSelected");
        } catch (Exception error) {
            call.reject("Could not open the file picker.", error);
        }
    }

    @ActivityCallback
    private void backupFileSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        String data = call.getString("data");
        if (uri == null || data == null) {
            call.reject("No backup destination or data was available.");
            return;
        }
        // File providers may write to cloud storage; keep this work off the UI thread.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IOException("Could not open the backup destination.");
                stream.write(data.getBytes(StandardCharsets.UTF_8));
            } catch (Exception error) {
                call.reject("Could not save the backup.", error);
                return;
            }
            call.resolve(new JSObject().put("saved", true));
        });
    }

    @PluginMethod
    public void print(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {
                    call.reject("Printing is unavailable on this device.");
                    return;
                }
                String title = call.getString("title", "Recipe Manager");
                manager.print(title, getBridge().getWebView().createPrintDocumentAdapter(title),
                    new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not open the print dialog.", error);
            }
        });
    }
}
