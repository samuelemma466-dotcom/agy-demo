package com.omachy.connect;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.BarcodeView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/** Phone companion for the short-lived, TLS-pinned Omachy protocol v1 session. */
public final class MainActivity extends Activity {
    private static final int PICK_UPLOAD = 41;
    private static final int PICK_DOWNLOAD = 42;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, Uri> outgoingFiles = new HashMap<>();
    private final Map<String, Long> outgoingSizes = new HashMap<>();
    private final Set<String> uploadsInProgress = new HashSet<>();
    private final Set<String> downloadsInProgress = new HashSet<>();

    private LinearLayout root;
    private LinearLayout transferList;
    private EditText pairingText;
    private TextView status;
    private TextView sessionInfo;
    private Button sendButton;
    private BarcodeView barcodeView;
    private boolean scanning;
    private PhoneProtocolClient client;
    private PhoneProtocolClient.Pairing pairing;
    private String pairRequestId;
    private String deviceToken;
    private android.content.SharedPreferences prefs;
    private String savedDeviceToken;
    private String savedAddress;
    private int savedPort;
    private String savedFingerprint;
    private String downloadTransferId;
    private ScheduledFuture<?> pairPoll;
    private ScheduledFuture<?> transferPoll;
    private ScheduledFuture<?> autoPoll;
    private long lastProgressUiUpdate;
    private long lastProgressSampleAt;
    private long lastProgressSampleBytes;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff101925);
        getWindow().setNavigationBarColor(0xff101925);
        prefs = getSharedPreferences("omachy_connect", Context.MODE_PRIVATE);
        buildUi();
        restoreSession();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 77 && grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            if (scanning) {
                scanQr();
            }
        }
    }

    private void restoreSession() {
        savedDeviceToken = prefs.getString("device_token", null);
        savedAddress = prefs.getString("address", null);
        savedPort = prefs.getInt("port", 0);
        savedFingerprint = prefs.getString("fingerprint", null);
        if (savedDeviceToken != null && savedAddress != null && savedPort > 0 && savedFingerprint != null) {
            final String pairingAddress = savedAddress;
            final int pairingPort = savedPort;
            worker.execute(() -> {
                String label = connectUsing(pairingAddress, pairingPort);
                if (label == null) label = discoverAndConnect(8000);
                if (label != null) {
                    stopPairPoll();
                    resumePolling();
                    setStatus("Reconnected to " + label + ". Send or receive files while the session stays active.");
                    return;
                }
                android.util.Log.e("OmachyConnect", "restoreSession failed for " + pairingAddress + ":" + pairingPort);
                setStatus("Saved pairing is out of date. Searching for the computer automatically…");
            });
        } else {
            // No saved credentials — kick off mDNS discovery right away
            // so the phone can find the desktop even without a prior pairing.
            setStatus("No saved pairing. Searching for the computer…");
            if (autoPoll == null) {
                autoPoll = worker.scheduleWithFixedDelay(MainActivity.this::autoReconnectTick, 5, 15, TimeUnit.SECONDS);
            }
        }
    }

    /**
     * Connect to one endpoint, remembering it when the ping succeeds.
     * Returns the desktop's device label, or null when it is unreachable.
     */
    private String connectUsing(String address, int port) {
        try {
            // If we have a saved device token, use it to re-establish the existing session.
            if (savedDeviceToken != null && !savedDeviceToken.isEmpty()) {
                PhoneProtocolClient.Pairing candidate =
                        new PhoneProtocolClient.Pairing(address, port, savedFingerprint, savedDeviceToken);
                PhoneProtocolClient candidateClient = new PhoneProtocolClient(MainActivity.this, candidate);
                JSONObject ping = candidateClient.ping(savedDeviceToken);
                if (!ping.optBoolean("connected")) return null;
                client = candidateClient;
                pairing = candidate;
                deviceToken = savedDeviceToken;
                if (address.equals(savedAddress) && port == savedPort) {
                    // Already current; nothing else to persist.
                } else {
                    savedAddress = address;
                    savedPort = port;
                    prefs.edit().putString("address", address).putInt("port", port).apply();
                }
                final String label = ping.optString("device", "your computer");
                main.post(() -> {
                    sendButton.setEnabled(true);
                    sessionInfo.setText("Connected to " + label + " · files can be sent at any time while this app is open");
                });
                return label;
            }

            // No saved device token — initiate the pairing flow via mDNS discovery.
            PhoneProtocolClient.Pairing candidate =
                    new PhoneProtocolClient.Pairing(address, port, savedFingerprint, null);
            PhoneProtocolClient candidateClient = new PhoneProtocolClient(MainActivity.this, candidate);
            JSONObject response = candidateClient.requestPair(
                    android.os.Build.MODEL == null ? "Android phone" : android.os.Build.MODEL);
            String requestId = response.getString("request_id");
            pairing = candidate;
            client = candidateClient;
            pairRequestId = requestId;

            pairPoll = worker.scheduleWithFixedDelay(MainActivity.this::pollPairing, 1, 1, TimeUnit.SECONDS);
            main.post(() -> {
                sessionInfo.setText("Computer: " + pairing.address + ":" + pairing.port + " · waiting for approval on the computer");
                setStatus("Pairing request sent. Approve this phone in Omachy Connect on your computer.");
            });
            return null;
        } catch (Exception error) {
            android.util.Log.e("OmachyConnect", "connect failed for " + address + ":" + port, error);
            return null;
        }
    }

    /** Ask mDNS for the desktop and connect to whatever endpoint it advertises. */
    private String discoverAndConnect(long timeoutMillis) {
        PhoneProtocolClient.Discovery found =
                PhoneProtocolClient.discover(this, savedFingerprint, timeoutMillis);
        if (found == null) return null;
        String label = connectUsing(found.address, found.port);
        if (label != null) {
            android.util.Log.i("OmachyConnect", "rediscovered desktop at " + found.address + ":" + found.port);
        }
        return label;
    }

    private void resumePolling() {
        stopTransferPoll();
        transferPoll = worker.scheduleWithFixedDelay(MainActivity.this::refreshTransfers, 0, 2, TimeUnit.SECONDS);
        if (autoPoll == null) {
            autoPoll = worker.scheduleWithFixedDelay(MainActivity.this::autoReconnectTick, 15, 15, TimeUnit.SECONDS);
        }
    }

    private void autoReconnectTick() {
        worker.execute(() -> {
            if (transferPoll != null) return;
            // If we have saved credentials, try re-establishing the existing session.
            if (savedDeviceToken != null && !savedDeviceToken.isEmpty()) {
                if (connectUsing(savedAddress, savedPort) != null) {
                    resumePolling();
                    setStatus("Reconnected to the computer. You can send or receive files again.");
                    return;
                }
            }
            // No saved token — initiate mDNS discovery and pairing flow.
            // The pairing request will be pending until approved on the computer.
            if (discoverAndConnect(7000) != null) {
                resumePolling();
                setStatus("Found the computer automatically and reconnected.");
            }
        });
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(22), dp(20), dp(28));
        root.setBackgroundColor(0xff101925);
        scroll.addView(root);
        setContentView(scroll);

        TextView title = text("Omachy Connect", 25, 0xfff4f7fb, true);
        root.addView(title);
        root.addView(text("Private phone-to-computer pairing and file transfer", 14, 0xffadbac9, false), margin(0, 5, 0, 18));

        status = text("Not connected. Join the computer’s Wi-Fi network or hotspot first.", 14, 0xffd9e3ed, false);
        status.setPadding(dp(14), dp(13), dp(14), dp(13));
        status.setBackgroundColor(0xff1a2939);
        root.addView(status, margin(0, 0, 0, 16));

        barcodeView = new BarcodeView(this);
        LinearLayout.LayoutParams barcodeParams = margin(0, 0, 0, 8);
        barcodeParams.height = dp(280);
        root.addView(barcodeView, barcodeParams);

        Button scan = button("Scan Omachy QR code (optional)");
        scan.setOnClickListener(view -> scanQr());
        root.addView(scan, margin(0, 0, 0, 8));

        pairingText = new EditText(this);
        pairingText.setHint("Paste the pairing code or QR text from your computer");
        pairingText.setTextColor(0xfff4f7fb);
        pairingText.setHintTextColor(0xff8292a5);
        pairingText.setTextSize(13);
        pairingText.setMinLines(3);
        pairingText.setGravity(android.view.Gravity.TOP | android.view.Gravity.START);
        pairingText.setPadding(dp(12), dp(10), dp(12), dp(10));
        pairingText.setBackgroundColor(0xff182434);
        root.addView(pairingText, margin(0, 0, 0, 8));

        Button pair = button("Pair with this computer");
        pair.setOnClickListener(view -> beginPairing(pairingText.getText().toString()));
        root.addView(pair, margin(0, 0, 0, 16));

        sessionInfo = text("Pair once and this phone reconnects automatically while the computer session is on.", 12, 0xff9aaabd, false);
        root.addView(sessionInfo, margin(0, 0, 0, 14));

        sendButton = button("Choose a file to send to computer");
        sendButton.setEnabled(false);
        sendButton.setOnClickListener(view -> chooseUpload());
        root.addView(sendButton, margin(0, 0, 0, 20));

        root.addView(text("Transfers", 18, 0xfff4f7fb, true), margin(0, 0, 0, 8));
        transferList = new LinearLayout(this);
        transferList.setOrientation(LinearLayout.VERTICAL);
        root.addView(transferList);
    }

    private void scanQr() {
        if (scanning) return;
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{android.Manifest.permission.CAMERA}, 77);
            return;
        }
        scanning = true;
        setStatus("Scanning for the Omachy pairing code…");
        barcodeView.decodeContinuous(new BarcodeCallback() {
            @Override
            public void barcodeResult(BarcodeResult barcodeResult) {
                scanning = false;
                String raw = barcodeResult == null ? null : barcodeResult.getText();
                if (raw == null || raw.trim().isEmpty()) {
                    setStatus("No QR data was read. You can paste the code instead.");
                    return;
                }
                String text = raw.trim();
                pairingText.setText(text);
                beginPairing(text);
            }
        });
        barcodeView.resume();
    }

    private void beginPairing(String raw) {
        if (pairing != null || deviceToken != null) {
            setStatus("A pairing session is already in progress. Stop it from Omachy Connect on the computer before starting another.");
            return;
        }
        setStatus("Checking the temporary pairing code…");
        worker.execute(() -> {
            PhoneProtocolClient.Pairing[] target = new PhoneProtocolClient.Pairing[1];
            try {
                target[0] = PhoneProtocolClient.parseQr(raw.trim());
                PhoneProtocolClient.Pairing nextPairing = target[0];
                PhoneProtocolClient nextClient = new PhoneProtocolClient(this, nextPairing);
                String model = android.os.Build.MODEL == null ? "Android phone" : android.os.Build.MODEL;
                if (model.length() > 80) model = model.substring(0, 80);
                JSONObject response = nextClient.requestPair(model);
                String requestId = response.getString("request_id");
                pairing = nextPairing;
                client = nextClient;
                pairRequestId = requestId;
                main.post(() -> {
                    pairingText.setText("");
                    sessionInfo.setText("Computer: " + nextPairing.address + ":" + nextPairing.port + " · waiting for approval on the computer");
                    setStatus("Pairing request sent. Approve this phone in Omachy Connect on your computer.");
                });
                pairPoll = worker.scheduleWithFixedDelay(this::pollPairing, 1, 1, TimeUnit.SECONDS);
            } catch (Exception error) {
                clearPairingState();
                setStatus("Could not pair: " + pairingFailure(error, target[0]));
            }
        });
    }

    private void pollPairing() {
        try {
            JSONObject response = client.pairStatus(pairRequestId);
            String state = response.optString("state");
            if ("awaiting_approval".equals(state)) return;
            if ("rejected".equals(state)) {
                stopPairPoll();
                clearPairingState();
                setStatus("The computer rejected this pairing request.");
                return;
            }
            if ("paired".equals(state)) {
                String token = response.getString("device_token");
                JSONObject ping = client.ping(token);
                if (!ping.optBoolean("connected")) throw new IOException("The computer did not confirm the connection.");
                deviceToken = token;
                stopPairPoll();
                if (autoPoll != null) {
                    autoPoll.cancel(false);
                    autoPoll = null;
                }
                transferPoll = worker.scheduleWithFixedDelay(MainActivity.this::refreshTransfers, 0, 2, TimeUnit.SECONDS);
                autoPoll = worker.scheduleWithFixedDelay(MainActivity.this::autoReconnectTick, 15, 15, TimeUnit.SECONDS);
                main.post(() -> {
                    sendButton.setEnabled(true);
                    sessionInfo.setText("Connected to " + ping.optString("device", "your computer") + " · keep this app open during transfers");
                    setStatus("Phone paired securely. You can send a file or accept a file offer below.");
                });
                android.content.SharedPreferences.Editor saved = prefs.edit();
                saved.putString("device_token", token);
                saved.putString("address", pairing.address);
                saved.putInt("port", pairing.port);
                saved.putString("fingerprint", pairing.fingerprint);
                saved.apply();
            }
        } catch (Exception error) {
            stopPairPoll();
            String reason = pairingFailure(error, pairing);
            clearPairingState();
            setStatus("Pairing ended: " + reason + ". Paste the pairing code from the computer to pair again.");
        }
    }

    private void refreshTransfers() {
        try {
            JSONArray transfers = client.transfers(deviceToken);
            main.post(() -> renderTransfers(transfers));
            for (int i = 0; i < transfers.length(); i++) {
                JSONObject item = transfers.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id");
                String direction = item.optString("direction");
                String state = item.optString("status");
                if ("phone_to_desktop".equals(direction) && "accepted".equals(state)
                        && outgoingFiles.containsKey(id) && uploadsInProgress.add(id)) {
                    Uri uri = outgoingFiles.get(id);
                    long size = outgoingSizes.getOrDefault(id, -1L);
                    worker.execute(() -> uploadFile(id, uri, size));
                }
            }
        } catch (Exception error) {
            stopTransferPoll();
            if (deviceToken != null) {
                // Keep the paired credential and retry the connection quietly.
                setStatus("Connection lost. Reconnecting automatically…");
                if (autoPoll == null) {
                    autoPoll = worker.scheduleWithFixedDelay(MainActivity.this::autoReconnectTick, 15, 15, TimeUnit.SECONDS);
                }
                return;
            }
            setStatus("Connection lost: " + safeMessage(error) + ". Start a new session in Connect.");
            clearPairingState();
            main.post(() -> sessionInfo.setText("Session ended. Start a new session in Omachy Connect to pair again."));
        }
    }

    private void renderTransfers(JSONArray transfers) {
        transferList.removeAllViews();
        if (transfers.length() == 0) {
            transferList.addView(text("No file offers yet.", 13, 0xff9aaabd, false));
            return;
        }
        for (int i = 0; i < transfers.length(); i++) {
            JSONObject item = transfers.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id");
            String name = item.optString("name", "File");
            long size = item.optLong("size", 0);
            String direction = item.optString("direction");
            String state = item.optString("status");
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(13), dp(12), dp(13), dp(12));
            card.setBackgroundColor(0xff182434);
            TextView label = text(name + " · " + readableSize(size), 14, 0xfff4f7fb, true);
            card.addView(label);
            card.addView(text(direction.replace('_', ' ') + " · " + state, 12, 0xffadbac9, false), margin(0, 5, 0, 8));
            if ("desktop_to_phone".equals(direction) && "offered".equals(state)) {
                card.addView(text("Incoming file from the computer", 12, 0xffadbac9, false), margin(0, 2, 0, 6));
                LinearLayout actions = new LinearLayout(this);
                actions.setOrientation(LinearLayout.HORIZONTAL);
                Button approve = button("Approve");
                approve.setOnClickListener(view -> chooseDownload(id, name));
                Button reject = button("Reject");
                reject.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff5a2b33));
                reject.setOnClickListener(view -> rejectOffer(id));
                LinearLayout.LayoutParams approveParams = new LinearLayout.LayoutParams(0, dp(48), 1f);
                approveParams.setMargins(0, 0, dp(8), 0);
                actions.addView(approve, approveParams);
                actions.addView(reject, new LinearLayout.LayoutParams(dp(112), dp(48)));
                card.addView(actions, margin(0, 0, 0, 0));
            } else if ("phone_to_desktop".equals(direction) && "offered".equals(state)) {
                card.addView(text("Waiting for approval in Omachy Drop on the computer.", 12, 0xffadbac9, false));
            } else if ("phone_to_desktop".equals(direction) && "accepted".equals(state)) {
                card.addView(text("Preparing to send…", 12, 0xffadbac9, false));
            } else if ("transferring".equals(state) || "source_uploading".equals(state) || "awaiting_verification".equals(state)) {
                card.addView(text(String.format(java.util.Locale.ROOT, "%.1f%%", item.optDouble("progress", 0)), 12, 0xff7dd3fc, false));
            }
            transferList.addView(card, margin(0, 0, 0, 9));
        }
    }

    private void chooseUpload() {
        if (deviceToken == null) return;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        try {
            startActivityForResult(intent, PICK_UPLOAD);
        } catch (ActivityNotFoundException | SecurityException error) {
            setStatus("Android could not open a file picker. Enable the system Documents/Files app and try again.");
        }
    }

    private void chooseDownload(String transferId, String fileName) {
        if (!downloadsInProgress.add(transferId)) return;
        downloadTransferId = transferId;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            startActivityForResult(intent, PICK_DOWNLOAD);
        } catch (ActivityNotFoundException | SecurityException error) {
            downloadsInProgress.remove(transferId);
            downloadTransferId = null;
            setStatus("Android could not open a save-location picker. Enable the system Documents/Files app and try again.");
        }
    }

    private void rejectOffer(String transferId) {
        worker.execute(() -> {
            try {
                client.decision(deviceToken, transferId, false);
                setStatus("File offer rejected.");
                refreshTransfers();
            } catch (Exception error) { setStatus("Could not reject offer: " + safeMessage(error)); }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            if (requestCode == PICK_DOWNLOAD && downloadTransferId != null) downloadsInProgress.remove(downloadTransferId);
            return;
        }
        Uri uri = data.getData();
        if (requestCode == PICK_UPLOAD) stageUpload(uri);
        else if (requestCode == PICK_DOWNLOAD) acceptAndDownload(downloadTransferId, uri);
    }

    @Override
    protected void onDestroy() {
        stopPairPoll();
        stopTransferPoll();
        if (autoPoll != null) {
            autoPoll.cancel(false);
            autoPoll = null;
        }
        if (barcodeView != null) {
            try { barcodeView.stopDecoding(); } catch (Exception ignored) { }
        }
        worker.shutdownNow();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onDestroy();
    }

    private void stageUpload(Uri uri) {
        setStatus("Checking file and preparing its checksum…");
        worker.execute(() -> {
            try {
                String name = PhoneProtocolClient.displayName(this, uri);
                long size = PhoneProtocolClient.fileSize(this, uri);
                if (size < 0) throw new IOException("This file provider did not report a size. Choose a file stored on the device.");
                JSONObject offer = client.offerFile(deviceToken, uri, name, size);
                String id = offer.getString("id");
                outgoingFiles.put(id, uri);
                outgoingSizes.put(id, size);
                setStatus("File offered to the computer. Approve it in Omachy Drop; the transfer will begin automatically.");
                refreshTransfers();
            } catch (Exception error) { setStatus("Could not offer file: " + safeMessage(error)); }
        });
    }

    private void uploadFile(String id, Uri uri, long size) {
        keepScreenOn(true);
        beginProgress();
        setStatus("Sending file to the computer… keep Omachy Connect open.");
        try {
            JSONObject result = client.upload(deviceToken, id, uri, size, this::showProgress);
            if (!"completed".equals(result.optString("status"))) throw new IOException(result.optString("error", "The computer did not verify the file."));
            setStatus("File sent and SHA-256 verified by the computer.");
        } catch (Exception error) {
            setStatus("File transfer failed: " + safeMessage(error));
        } finally {
            uploadsInProgress.remove(id);
            keepScreenOn(false);
            refreshTransfers();
        }
    }

    private void acceptAndDownload(String id, Uri destination) {
        if (id == null) return;
        downloadTransferId = null;
        setStatus("Accepting file offer…");
        worker.execute(() -> {
            keepScreenOn(true);
            beginProgress();
            try {
                client.decision(deviceToken, id, true);
                client.download(deviceToken, id, destination, this::showProgress);
                setStatus("File received and SHA-256 verified.");
            } catch (Exception error) {
                try { getContentResolver().delete(destination, null, null); } catch (Exception ignored) { }
                setStatus("File receive failed: " + safeMessage(error));
            } finally {
                downloadsInProgress.remove(id);
                keepScreenOn(false);
                refreshTransfers();
            }
        });
    }

    private void showProgress(long transferred, long total) {
        long now = System.currentTimeMillis();
        if (now - lastProgressUiUpdate < 500 && (total < 0 || transferred < total)) return;
        double seconds = Math.max((now - lastProgressSampleAt) / 1000.0, 0.001);
        double rate = Math.max(transferred - lastProgressSampleBytes, 0) / seconds / (1024.0 * 1024.0);
        lastProgressUiUpdate = now;
        lastProgressSampleAt = now;
        lastProgressSampleBytes = transferred;
        String value = total > 0
                ? String.format(java.util.Locale.ROOT, "Transferring %.1f%% · %.1f MB/s", transferred * 100.0 / total, rate)
                : String.format(java.util.Locale.ROOT, "Transferred %s · %.1f MB/s", readableSize(transferred), rate);
        setStatus(value);
    }

    private void beginProgress() {
        lastProgressUiUpdate = 0;
        lastProgressSampleAt = System.currentTimeMillis();
        lastProgressSampleBytes = 0;
    }

    private void keepScreenOn(boolean enabled) {
        main.post(() -> {
            if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    private void stopPairPoll() {
        if (pairPoll != null) pairPoll.cancel(false);
        pairPoll = null;
    }

    private void stopTransferPoll() {
        if (transferPoll != null) transferPoll.cancel(false);
        transferPoll = null;
    }

    private void clearPairingState() {
        client = null;
        pairing = null;
        pairRequestId = null;
        deviceToken = null;
        main.post(() -> sendButton.setEnabled(false));
        if (autoPoll != null) {
            autoPoll.cancel(false);
            autoPoll = null;
        }
    }

    private void setStatus(String value) {
        main.post(() -> status.setText(value));
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return error.getClass().getSimpleName();
        return message.length() > 220 ? message.substring(0, 220) : message;
    }

    private String pairingFailure(Exception error, PhoneProtocolClient.Pairing target) {
        if (target == null) return safeMessage(error);
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConnectException || cause instanceof NoRouteToHostException
                    || cause instanceof SocketTimeoutException) {
                return "The phone cannot reach " + target.address + ":" + target.port
                        + ". Connect the computer to this phone hotspot, select its Wi-Fi address in Omachy Connect, "
                        + "and check whether the computer firewall allows the Omachy Connect port.";
            }
        }
        return safeMessage(error);
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private Button button(String value) {
        Button view = new Button(this);
        view.setText(value);
        view.setTextSize(13);
        view.setAllCaps(false);
        view.setTextColor(0xfff4f7fb);
        view.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff176d86));
        return view;
    }

    private LinearLayout.LayoutParams margin(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.width = LinearLayout.LayoutParams.MATCH_PARENT;
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private String readableSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024L * 1024) return String.format(java.util.Locale.ROOT, "%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format(java.util.Locale.ROOT, "%.1f MB", bytes / (1024.0 * 1024));
        return String.format(java.util.Locale.ROOT, "%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

}
