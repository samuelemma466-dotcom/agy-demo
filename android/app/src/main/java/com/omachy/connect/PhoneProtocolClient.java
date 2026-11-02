package com.omachy.connect;

import android.content.Context;
import android.net.Uri;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.provider.OpenableColumns;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/** Small, dependency-light client for Omachy phone protocol v1. */
final class PhoneProtocolClient {
    static final long MAX_TRANSFER_BYTES = 10L * 1024 * 1024 * 1024;
    private static final int IO_BUFFER_BYTES = 512 * 1024;

    static final String MDNS_SERVICE_TYPE = "_omachy-connect._tcp";

    /** Endpoint found through mDNS discovery. */
    static final class Discovery {
        final String address;
        final int port;

        Discovery(String address, int port) {
            this.address = address;
            this.port = port;
        }
    }

    /**
     * Find the desktop by its advertised certificate fingerprint.
     *
     * The paired address and port cannot survive a hotspot restart, a new
     * session, or a changed DHCP lease. mDNS gives a fresh endpoint while the
     * TXT record proves it belongs to the desktop this phone already trusts.
     */
    static Discovery discover(Context context, String expectedFingerprint, long timeoutMillis) {
        NsdManager nsd = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        if (nsd == null) return null;
        final CountDownLatch done = new CountDownLatch(1);
        final AtomicReference<Discovery> found = new AtomicReference<>();
        final AtomicBoolean resolving = new AtomicBoolean(false);
        final NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String serviceType) {
            }

            @Override
            public void onServiceFound(NsdServiceInfo info) {
                if (found.get() != null || !resolving.compareAndSet(false, true)) return;
                try {
                    nsd.resolveService(info, new NsdManager.ResolveListener() {
                        @Override
                        public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                            resolving.set(false);
                        }

                        @Override
                        public void onServiceResolved(NsdServiceInfo serviceInfo) {
                            resolving.set(false);
                            if (found.get() != null) return;
                            Map<String, byte[]> attributes = serviceInfo.getAttributes();
                            byte[] advertised = attributes == null ? null : attributes.get("fp");
                            String remote = advertised == null ? "" : new String(advertised, StandardCharsets.US_ASCII);
                            if (expectedFingerprint != null && !expectedFingerprint.equalsIgnoreCase(remote)) {
                                return;
                            }
                            InetAddress host = serviceInfo.getHost();
                            if (host == null) return;
                            String address = host.getHostAddress();
                            if (address == null) return;
                            // A link-local IPv6 literal without a scope cannot be dialled.
                            if (address.toLowerCase(Locale.ROOT).startsWith("fe80:")) return;
                            if (address.indexOf('%') >= 0) address = address.substring(0, address.indexOf('%'));
                            if (found.compareAndSet(null, new Discovery(address, serviceInfo.getPort()))) {
                                done.countDown();
                            }
                        }
                    });
                } catch (Exception error) {
                    resolving.set(false);
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                done.countDown();
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
            }
        };
        try {
            nsd.discoverServices(MDNS_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener);
            done.await(timeoutMillis, TimeUnit.MILLISECONDS);
        } catch (Exception ignored) {
            // Fall back to the saved endpoint.
        } finally {
            try {
                nsd.stopServiceDiscovery(listener);
            } catch (Exception ignored) {
            }
        }
        return found.get();
    }

    static final class Pairing {
        final String address;
        final int port;
        final String fingerprint;
        final String pairingToken;

        Pairing(String address, int port, String fingerprint, String pairingToken) {
            this.address = address;
            this.port = port;
            this.fingerprint = fingerprint;
            this.pairingToken = pairingToken;
        }

        String baseUrl() {
            // IPv6 literals must be bracketed to form a valid URL.
            String host = address.contains(":") && !address.startsWith("[") ? "[" + address + "]" : address;
            return "https://" + host + ":" + port;
        }
    }

    interface ProgressListener {
        void onProgress(long transferred, long total);
    }

    private final Context context;
    private final Pairing pairing;
    private final SSLSocketFactory socketFactory;
    private final HostnameVerifier hostnameVerifier = (hostname, session) -> true;

    PhoneProtocolClient(Context context, Pairing pairing) throws Exception {
        this.context = context.getApplicationContext();
        this.pairing = pairing;
        this.socketFactory = pinnedSocketFactory(pairing.fingerprint);
    }

    static Pairing parseQr(String raw) throws Exception {
        if (raw == null || raw.length() > 4096) throw new IOException("QR data is empty or too large.");
        JSONObject json = new JSONObject(raw);
        if (!"omachy-connect".equals(json.optString("protocol")) || json.optInt("version", -1) != 1) {
            throw new IOException("This QR code is not a supported Omachy pairing code.");
        }
        String address = json.optString("address", "");
        if (!address.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) {
            throw new IOException("The QR code does not contain a local IPv4 address.");
        }
        InetAddress parsed = InetAddress.getByName(address);
        if (!parsed.getHostAddress().equals(address) || parsed.isLoopbackAddress() || parsed.isAnyLocalAddress() || parsed.isMulticastAddress()) {
            throw new IOException("The QR code contains an unusable address.");
        }
        int port = json.optInt("port", -1);
        String fingerprint = json.optString("fingerprint_sha256", "").toLowerCase(Locale.ROOT);
        String token = json.optString("pairing_token", "");
        if (port < 1 || port > 65535) throw new IOException("The QR code contains an invalid port.");
        if (!fingerprint.matches("[0-9a-f]{64}")) throw new IOException("The QR code contains an invalid certificate fingerprint.");
        if (!token.matches("[A-Za-z0-9_-]{30,100}")) throw new IOException("The QR code contains an invalid temporary pairing token.");
        return new Pairing(address, port, fingerprint, token);
    }

    JSONObject requestPair(String deviceName) throws Exception {
        JSONObject body = new JSONObject();
        body.put("protocol", 1);
        body.put("device_name", deviceName);
        return jsonRequest("POST", "/v1/pair", pairing.pairingToken, body);
    }

    JSONObject pairStatus(String requestId) throws Exception {
        return jsonRequest("GET", "/v1/pair/status/" + requestId, pairing.pairingToken, null);
    }

    JSONObject ping(String deviceToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("protocol", 1);
        return jsonRequest("POST", "/v1/ping", deviceToken, body);
    }

    JSONArray transfers(String deviceToken) throws Exception {
        return jsonRequest("GET", "/v1/transfers", deviceToken, null).getJSONArray("transfers");
    }

    JSONObject decision(String deviceToken, String transferId, boolean accepted) throws Exception {
        JSONObject body = new JSONObject();
        body.put("accepted", accepted);
        return jsonRequest("POST", "/v1/transfers/" + transferId + "/decision", deviceToken, body);
    }

    JSONObject offerFile(String deviceToken, Uri uri, String displayName, long size) throws Exception {
        if (size < 0 || size > MAX_TRANSFER_BYTES) throw new IOException("File size is unavailable or exceeds 10 GiB.");
        String digest = hashUri(uri);
        JSONObject body = new JSONObject();
        body.put("protocol", 1);
        body.put("name", displayName);
        body.put("size", size);
        body.put("sha256", digest);
        return jsonRequest("POST", "/v1/transfers/offers", deviceToken, body);
    }

    JSONObject upload(String deviceToken, String transferId, Uri uri, long size, ProgressListener progress) throws Exception {
        HttpsURLConnection connection = open("PUT", "/v1/transfers/" + transferId + "/content", deviceToken);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/octet-stream");
        connection.setFixedLengthStreamingMode(size);
        try {
            InputStream rawInput = context.getContentResolver().openInputStream(uri);
            if (rawInput == null) throw new IOException("Android could not reopen the selected file.");
            try (InputStream input = new BufferedInputStream(rawInput, IO_BUFFER_BYTES);
                 OutputStream output = new BufferedOutputStream(connection.getOutputStream(), IO_BUFFER_BYTES)) {
                byte[] buffer = new byte[IO_BUFFER_BYTES];
                long sent = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    sent += read;
                    progress.onProgress(sent, size);
                }
                if (sent != size) throw new IOException("The selected file changed while it was being sent.");
            }
            return readJsonResponse(connection);
        } finally {
            connection.disconnect();
        }
    }

    /** Files at least this large are fetched over several parallel streams. */
    private static final long PARALLEL_MIN_BYTES = 12L * 1024 * 1024;
    private static final int PARALLEL_STREAMS = 3;

    String download(String deviceToken, String transferId, Uri destination, ProgressListener progress) throws Exception {
        long size = -1;
        String expected = "";
        try {
            JSONObject record = jsonRequest("GET", "/v1/transfers/" + transferId, deviceToken, null);
            size = record.optLong("size", -1);
            expected = record.optString("sha256", "").toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
            // Fall back to the single-stream path below.
        }
        if (size >= PARALLEL_MIN_BYTES && expected.matches("[0-9a-f]{64}") && supportsRanges(deviceToken, transferId)) {
            try {
                return parallelDownload(deviceToken, transferId, size, expected, destination, progress);
            } catch (Exception error) {
                android.util.Log.w("OmachyConnect", "Parallel download failed; retrying as one stream", error);
            }
        }
        return sequentialDownload(deviceToken, transferId, destination, progress);
    }

    private boolean supportsRanges(String deviceToken, String transferId) {
        HttpsURLConnection connection = null;
        try {
            connection = open("GET", "/v1/transfers/" + transferId + "/content", deviceToken);
            connection.setRequestProperty("Range", "bytes=0-0");
            if (connection.getResponseCode() != 206) return false;
            try (InputStream input = connection.getInputStream()) {
                byte[] single = new byte[1];
                return input.read(single) == 1;
            }
        } catch (Exception error) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String parallelDownload(String deviceToken, String transferId, long size, String expected,
                                    Uri destination, ProgressListener progress) throws Exception {
        int parts = (int) Math.min(PARALLEL_STREAMS,
                Math.max(2, (size + PARALLEL_MIN_BYTES - 1) / PARALLEL_MIN_BYTES));
        long segment = (size + parts - 1) / parts;
        final AtomicLong done = new AtomicLong(0);
        final File[] files = new File[parts];
        ExecutorService pool = Executors.newFixedThreadPool(parts);
        try {
            List<Future<?>> jobs = new ArrayList<>(parts);
            for (int index = 0; index < parts; index++) {
                final long start = index * segment;
                final long end = Math.min(size, start + segment) - 1;
                final File target = new File(context.getCacheDir(), "omachy-" + transferId + "-" + index + ".part");
                files[index] = target;
                jobs.add(pool.submit(() -> {
                    fetchRange(deviceToken, transferId, start, end, target, done, progress, size);
                    return null;
                }));
            }
            for (Future<?> job : jobs) {
                try {
                    job.get();
                } catch (ExecutionException failure) {
                    Throwable cause = failure.getCause();
                    if (cause instanceof Exception) throw (Exception) cause;
                    throw failure;
                }
            }
        } catch (Exception error) {
            for (File file : files) {
                if (file != null) file.delete();
            }
            throw error;
        } finally {
            pool.shutdownNow();
        }
        return mergeParts(deviceToken, transferId, size, expected, destination, files);
    }

    private static final int SEGMENT_ATTEMPTS = 3;

    private void fetchRange(String deviceToken, String transferId, long start, long end, File target,
                            AtomicLong done, ProgressListener progress, long total) throws Exception {
        long expectedLength = end - start + 1;
        long written = 0;
        Exception lastFailure = null;
        for (int attempt = 1; attempt <= SEGMENT_ATTEMPTS && written < expectedLength; attempt++) {
            if (attempt > 1) {
                // Discard anything the previous attempt buffered but did not count,
                // then ask for the remaining bytes of this segment only.
                try (FileOutputStream trim = new FileOutputStream(target, true)) {
                    trim.getChannel().truncate(written);
                }
            }
            long from = start + written;
            HttpsURLConnection connection = open("GET", "/v1/transfers/" + transferId + "/content", deviceToken);
            connection.setRequestProperty("Range", "bytes=" + from + "-" + end);
            try {
                int status = connection.getResponseCode();
                if (status != 206) throw new IOException("Desktop returned HTTP " + status + " for a partial download.");
                try (InputStream input = new BufferedInputStream(connection.getInputStream(), IO_BUFFER_BYTES);
                     OutputStream output = new FileOutputStream(target, true)) {
                    byte[] buffer = new byte[IO_BUFFER_BYTES];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        written += read;
                        progress.onProgress(done.addAndGet(read), total);
                    }
                }
            } catch (IOException failure) {
                lastFailure = failure;
            } finally {
                connection.disconnect();
            }
        }
        if (written != expectedLength) {
            throw new IOException("A parallel segment arrived incomplete.", lastFailure);
        }
    }

    private String mergeParts(String deviceToken, String transferId, long size, String expected,
                              Uri destination, File[] files) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        OutputStream rawOutput = context.getContentResolver().openOutputStream(destination, "wt");
        if (rawOutput == null) throw new IOException("Android could not create the destination file.");
        long merged = 0;
        try (OutputStream output = new BufferedOutputStream(rawOutput, IO_BUFFER_BYTES)) {
            byte[] buffer = new byte[IO_BUFFER_BYTES];
            for (File file : files) {
                try (InputStream input = new BufferedInputStream(new FileInputStream(file), IO_BUFFER_BYTES)) {
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        merged += read;
                    }
                }
                file.delete();
            }
        }
        if (merged != size) throw new IOException("The assembled file was incomplete.");
        String actual = hex(digest.digest());
        if (!MessageDigest.isEqual(expected.getBytes("US-ASCII"), actual.getBytes("US-ASCII"))) {
            throw new IOException("SHA-256 mismatch. The received file was not complete.");
        }
        JSONObject complete = new JSONObject();
        complete.put("protocol", 1);
        complete.put("sha256", actual);
        JSONObject result = jsonRequest("POST", "/v1/transfers/" + transferId + "/complete", deviceToken, complete);
        if (!"completed".equals(result.optString("status"))) throw new IOException("The desktop did not confirm the verified transfer.");
        return actual;
    }

    private String sequentialDownload(String deviceToken, String transferId, Uri destination, ProgressListener progress) throws Exception {
        HttpsURLConnection connection = open("GET", "/v1/transfers/" + transferId + "/content", deviceToken);
        try {
            int status = connection.getResponseCode();
            if (status != 200) throw responseError(connection, status);
            String expectedHash = connection.getHeaderField("X-Omachy-SHA256");
            if (expectedHash == null || !expectedHash.matches("[0-9a-f]{64}")) {
                throw new IOException("The desktop did not provide a valid file checksum.");
            }
            long total = connection.getContentLengthLong();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            InputStream rawInput = connection.getInputStream();
            OutputStream rawOutput = context.getContentResolver().openOutputStream(destination, "wt");
            if (rawOutput == null) throw new IOException("Android could not create the destination file.");
            try (InputStream input = new BufferedInputStream(rawInput, IO_BUFFER_BYTES);
                 OutputStream output = new BufferedOutputStream(rawOutput, IO_BUFFER_BYTES)) {
                byte[] buffer = new byte[IO_BUFFER_BYTES];
                long received = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    received += read;
                    progress.onProgress(received, total);
                }
            }
            String actual = hex(digest.digest());
            if (!MessageDigest.isEqual(expectedHash.getBytes("US-ASCII"), actual.getBytes("US-ASCII"))) {
                throw new IOException("SHA-256 mismatch. The received file was not reported as complete.");
            }
            JSONObject complete = new JSONObject();
            complete.put("protocol", 1);
            complete.put("sha256", actual);
            JSONObject result = jsonRequest("POST", "/v1/transfers/" + transferId + "/complete", deviceToken, complete);
            if (!"completed".equals(result.optString("status"))) throw new IOException("The desktop did not confirm the verified transfer.");
            return actual;
        } finally {
            connection.disconnect();
        }
    }

    static String displayName(Context context, Uri uri) {
        String name = null;
        try (android.database.Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) name = cursor.getString(index);
            }
        } catch (Exception ignored) { }
        if (name == null || name.trim().isEmpty()) name = uri.getLastPathSegment();
        return name == null ? "file" : name;
    }

    static long fileSize(Context context, Uri uri) {
        try (android.database.Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index);
            }
        } catch (Exception ignored) { }
        return -1;
    }

    private String hashUri(Uri uri) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long count = 0;
        InputStream rawInput = context.getContentResolver().openInputStream(uri);
        if (rawInput == null) throw new IOException("Android could not read the selected file.");
        try (InputStream input = new BufferedInputStream(rawInput, IO_BUFFER_BYTES)) {
            byte[] buffer = new byte[IO_BUFFER_BYTES];
            int read;
            while ((read = input.read(buffer)) != -1) {
                count += read;
                if (count > MAX_TRANSFER_BYTES) throw new IOException("File is larger than 10 GiB.");
                digest.update(buffer, 0, read);
            }
        }
        return hex(digest.digest());
    }

    private JSONObject jsonRequest(String method, String path, String bearer, JSONObject body) throws Exception {
        HttpsURLConnection connection = open(method, path, bearer);
        if (body != null) {
            byte[] bytes = body.toString().getBytes("UTF-8");
            if (bytes.length > 8192) throw new IOException("Request is too large.");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
        }
        // Leave the socket in the keep-alive pool so the 2-second transfer
        // poll reuses the same TLS connection instead of handshaking anew.
        return readJsonResponse(connection);
    }

    private HttpsURLConnection open(String method, String path, String bearer) throws Exception {
        URL url = new URL(pairing.baseUrl() + path);
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        connection.setSSLSocketFactory(socketFactory);
        connection.setHostnameVerifier(hostnameVerifier);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod(method);
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(30000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Authorization", "Bearer " + bearer);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        return connection;
    }

    private static JSONObject readJsonResponse(HttpsURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        if (stream == null) throw new IOException("Desktop returned HTTP " + status + ".");
        byte[] bytes;
        try (InputStream input = stream) { bytes = readBounded(input, 64 * 1024); }
        String raw = new String(bytes, "UTF-8");
        JSONObject json;
        try { json = new JSONObject(raw); }
        catch (JSONException error) { throw new IOException("Desktop returned an invalid response (HTTP " + status + ")."); }
        if (status < 200 || status >= 300) throw new IOException(json.optString("error", "Desktop returned HTTP " + status + "."));
        return json;
    }

    private static IOException responseError(HttpsURLConnection connection, int status) {
        try {
            InputStream input = connection.getErrorStream();
            if (input != null) {
                try (InputStream stream = input) {
                    JSONObject json = new JSONObject(new String(readBounded(stream, 64 * 1024), "UTF-8"));
                    return new IOException(json.optString("error", "Desktop returned HTTP " + status + "."));
                }
            }
        } catch (Exception ignored) { }
        return new IOException("Desktop returned HTTP " + status + ".");
    }

    private static byte[] readBounded(InputStream input, int maxBytes) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (output.size() + count > maxBytes) throw new IOException("Desktop response is too large.");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private static SSLSocketFactory pinnedSocketFactory(String expectedFingerprint) throws Exception {
        final byte[] expected = fromHex(expectedFingerprint);
        X509TrustManager trustManager = new X509TrustManager() {
            @Override public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                throw new CertificateException("Client certificates are not accepted.");
            }

            @Override public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                if (chain == null || chain.length == 0) throw new CertificateException("The server did not provide a certificate.");
                try {
                    byte[] actual = MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());
                    if (!MessageDigest.isEqual(expected, actual)) throw new CertificateException("TLS fingerprint does not match the QR code.");
                } catch (CertificateException error) {
                    throw error;
                } catch (Exception error) {
                    throw new CertificateException("Could not verify the pinned TLS certificate.", error);
                }
            }

            @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        };
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[]{trustManager}, null);
        return context.getSocketFactory();
    }

    private static byte[] fromHex(String value) {
        byte[] result = new byte[value.length() / 2];
        for (int i = 0; i < result.length; i++) result[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        return result;
    }

    private static String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) value.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        return value.toString();
    }
}
