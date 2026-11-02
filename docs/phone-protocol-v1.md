# Omachy local phone protocol v1

The loopback UI service at `127.0.0.1:48123` remains private to the computer
and is shared by the Connect and Drop windows. The app runner starts it as a
separate, unprivileged user process so its lifetime does not depend on the
window that first opened it. Diagnostics go to
`~/.local/state/omachy/service.log` (or `$XDG_STATE_HOME/omachy/service.log`).
Connect starts a separate TLS listener only after an explicit user action. The
listener binds to one selected IPv4 address returned by `ip -j -4 addr show
up`, uses stable TCP port 32975, and closes on Stop or after the five-minute
session timeout. OpenSSL creates a session-only P-256 ECDSA self-signed
certificate; the QR code carries its SHA-256 fingerprint and a random,
one-session pairing credential. The QR payload fields are `protocol` (the
string `omachy-connect`), `version` (integer 1), `address`, `port`,
`fingerprint_sha256` (lowercase SHA-256 of the DER certificate), and
`pairing_token`.

The native phone client must complete TLS, compare the peer certificate's DER
SHA-256 to the QR fingerprint, and only then send the token. Trusting a
self-signed certificate without this pin check is not allowed. All HTTP
requests use a bearer credential; the listener does not rely on Host or Origin
for authentication. JSON bodies are capped at 8 KiB. At most eight concurrent
connections are served; pairing is limited to five attempts per source per
minute. Request logs are suppressed.

## Pairing

- `POST /v1/pair`, bearer pairing token, exact JSON
  `{"protocol":1,"device_name":"..."}`. Creates a pending request; scanning
  the QR alone does not pair the phone.
- The desktop user approves or rejects the request in Connect.
- `GET /v1/pair/status/<request_id>`, still using the pairing token. Approval
  returns one random device credential once and invalidates the QR token.
- `GET /v1/ping`, device bearer credential, confirms authenticated access.

Credentials remain in memory and are dropped when the listener stops/expires.
There is no permanent trusted-device store yet.

## Transfer messages

Every transfer is associated with the authenticated paired device. Filenames
are NFC-normalized, limited to 255 UTF-8 bytes, and reject path separators,
control characters, hidden names, and traversal components. The transfer cap
is 10 GiB. Sender offers include an exact byte size, SHA-256, and optional
Unix mtime (1980–2100). Unknown methods, IDs, fields and protocol versions
are rejected.

### Phone to computer

1. Phone `POST /v1/transfers/offers` with JSON fields `protocol`, `name`,
   `size`, `sha256`, and optional `mtime`.
2. Desktop user accepts or rejects through the loopback-only UI API.
3. On acceptance, phone `PUT /v1/transfers/<id>/content` with a required
   `Content-Length` exactly matching the offer. Desktop reads at most 256 KiB
   at a time, hashes while writing a private `.part` file, and discards partial
   content on disconnect or cancellation.
4. After the expected SHA-256 matches, a hard link without replacement places
   the file in `~/Downloads/OmachyDrop`. Existing names get ` (2)`, ` (3)`,
   etc. Symlink targets are never followed. The accepted mtime is restored.

### Computer to phone

1. Desktop selects a file. It is staged in the private session directory using
   sequential 1 MiB chunks over the loopback API; the server computes SHA-256.
2. Phone polls `GET /v1/transfers` and accepts/rejects the offer using
   `POST /v1/transfers/<id>/decision` with `{"accepted":true|false}`.
3. After acceptance, phone `GET /v1/transfers/<id>/content`. The server streams
   bounded 256 KiB blocks and sends the expected hash in `X-Omachy-SHA256`.
4. The phone must stream to its user-selected document destination, verify the
   digest, and only then `POST /v1/transfers/<id>/complete` with
   `{"protocol":1,"sha256":"..."}`. Desktop records success only on a match.

`DELETE /v1/transfers/<id>` cancels a transfer. Transfer progress/history is
real but session-scoped in memory; received files remain on disk after session
shutdown. No automatic startup, firewall changes, privileged listeners, or
system settings are used.

## Current boundary

The desktop pairing and transfer protocol plus Connect/Drop interfaces are
implemented and local protocol-tested. A native Android client exists and
uses the fingerprint-pinned TLS protocol and Android document pickers. A real
phone can be paired only while it can route to the selected computer Wi-Fi
address; the complete real-device transfer path still needs to be verified in
the target hotspot/firewall setup. A manual short-code pairing fallback and
durable trusted-device/transfer history are not implemented.
