# Signing Guide

This document describes how to sign the Phlix Windows client for release builds.

## Why Signing Is Required

Code signing authenticates the identity of the application publisher and ensures that executables and packages have not been tampered with since they were signed. Windows SmartScreen, antivirus heuristics, and the Windows Store all check for valid signatures before trusting an application.

Two types of artifacts are produced by this project:

| Artifact | Signing Method |
|---|---|
| **NSIS installer** (`.exe`) | Authenticode (code signing certificate) |
| **APPX package** (`.appx`) | APPX signing certificate (same identity used for Microsoft Store submission) |

---

## Required Credentials

| Credential | Purpose |
|---|---|
| Authenticode / Code Signing Certificate (`.pfx` or `.p12`) | Signs `.exe` NSIS installer |
| APPX Signing Certificate (`.pfx` or `.p12`) | Signs `.appx` package for Windows Store |
| Certificate Password | Protects the private key in the `.pfx` file |

### Certificate Types

- **Standard Code Signing Certificate**: Valid for Authenticode (`.exe` signing). Can be purchased from DigiCert, Sectigo, SSL.com, or similar CAs.
- **EV Code Signing Certificate**: Provides instant SmartScreen reputation (recommended for production). Same format as standard but stored on a hardware token (HSM/cloud) in some cases.
- **Self-Signed Certificate**: Suitable for internal distribution and testing only. Not trusted by Windows SmartScreen or the Microsoft Store.

---

## Signing the NSIS Installer (Authenticode)

### Prerequisites

- A valid **Authenticode / Code Signing Certificate** in `.pfx` or `.p12` format
- The certificate's password
- The `signtool.exe` utility (included in the Windows SDK)

### Step-by-Step Manual Signing

#### 1. Locate SignTool

If you have the Windows SDK installed:

```
C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\signtool.exe
```

If not, download the Windows SDK from [developer.microsoft.com/windows/downloads/windows-sdk](https://developer.microsoft.com/windows/downloads/windows-sdk/).

#### 2. Sign the Executable

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign \
  /f certificate.pfx \
  /p <certificate-password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  release\Phlix-1.0.0-setup.exe
```

**Flags explained:**
- `/f` — path to your `.pfx` certificate file
- `/p` — password protecting the certificate's private key
- `/fd` — file digest algorithm (SHA256 recommended)
- `/tr` — RFC 3161 timestamp server URL (provides timestamping so the signature remains valid after the certificate expires)
- `/td` — timestamp digest algorithm

#### 3. Verify the Signature

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" verify /pa /v release\Phlix-1.0.0-setup.exe
```

Expected output: `Successfully verified: release\Phlix-1.0.0-setup.exe`

#### 4. (Recommended) Timestamp the Signature

The `/tr` flag in step 2 already handles this. If you are re-signing an existing file:

```powershell
& signtool.exe timestamp /t http://timestamp.digicert.com release\Phlix-1.0.0-setup.exe
```

---

## Signing the APPX Package

### Prerequisites

- A valid **APPX Signing Certificate** (a `.pfx` file with the `CN=Phlix` publisher identity matching the APPX manifest)
- The certificate password
- `makeappx.exe` and `signtool.exe` (both included in the Windows SDK)

### Step-by-Step Manual Signing

#### 1. Build the APPX Package

```bash
npm run build
npx electron-builder --win appx --publish never
```

The unsigned `.appx` is output to the `release/` directory.

#### 2. Sign the APPX

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign \
  /f appx-certificate.pfx \
  /p <certificate-password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  release\Phlix.appx
```

#### 3. Verify the Signature

```powershell
& signtool.exe verify /pa /v release\Phlix.appx
```

---

## CI Signing Configuration (When Ready)

When you are ready to wire CI to automatically sign builds:

### NSIS Authenticode

1. Store as **GitHub Actions secrets**:
   - `AUTHENTICODE_CERT` — base64-encoded `.pfx` certificate
   - `AUTHENTICODE_CERT_PASSWORD` — certificate password

2. In `.github/workflows/build.yml`, decode the certificate before the package step:

```yaml
- name: Import Authenticode Certificate
  env:
    AUTHENTICODE_CERT: ${{ secrets.AUTHENTICODE_CERT }}
    AUTHENTICODE_CERT_PASSWORD: ${{ secrets.AUTHENTICODE_CERT_PASSWORD }}
  run: |
    echo "$AUTHENTICODE_CERT" | base64 --decode --output cert.pfx

- name: Sign NSIS Installer
  run: |
    & "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign \
      /f cert.pfx \
      /p "$env:AUTHENTICODE_CERT_PASSWORD" \
      /fd SHA256 \
      /tr http://timestamp.digicert.com \
      /td SHA256 \
      release/Phlix-*.exe
  working-directory: .
```

### APPX Signing

1. Store as **GitHub Actions secrets**:
   - `APPX_SIGNING_CERT` — base64-encoded `.pfx` certificate
   - `APPX_SIGNING_CERT_PASSWORD` — certificate password

2. In `.github/workflows/build.yml`, after the APPX is built:

```yaml
- name: Sign APPX
  env:
    APPX_SIGNING_CERT: ${{ secrets.APPX_SIGNING_CERT }}
    APPX_SIGNING_CERT_PASSWORD: ${{ secrets.APPX_SIGNING_CERT_PASSWORD }}
  run: |
    echo "$APPX_SIGNING_CERT" | base64 --decode --output appx-cert.pfx
    & "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign \
      /f appx-cert.pfx \
      /p "$env:APPX_SIGNING_CERT_PASSWORD" \
      /fd SHA256 \
      /tr http://timestamp.digicert.com \
      /td SHA256 \
      release/Phlix.appx
```

> **Note**: The APPX `publisher` in `package.json` (`"publisher": "CN=Phlix"`) must match the `CN` field of the signing certificate exactly. If your certificate's CN differs, update `package.json` before signing.

> **Important**: Never commit private certificates or raw passwords to version control. Always use GitHub Actions secrets (or a comparable secrets manager) to inject credentials at runtime.

---

## Known Issues

- **"The signer's certificate chain is not trusted"**: The signing certificate is not installed in the machine's trusted root store (for self-signed certs) or the timestamp server is unreachable. For self-signed certs used in testing, install the certificate as a trusted root on the test machine.
- **SmartScreen "Unknown Publisher"**: This is expected for newly issued certificates. EV certificates get instant reputation. Standard certificates accumulate reputation over time as users run the application.
- **"Certificate expired"**: The signing certificate has passed its validity period. The timestamp ensures signatures made before expiry remain valid, but you cannot sign new binaries with an expired certificate.
- **APPX publisher mismatch**: The `publisher` field in `package.json`'s `appx` section must exactly match the subject CN of the signing certificate (e.g., `CN=Phlix`). Mismatches cause `signtool` to fail during APPX signing.
- **Missing Windows SDK**: `signtool.exe` and `makeappx.exe` are not included in a standard Visual Studio installation. Install the Windows SDK from [developer.microsoft.com/windows/downloads/windows-sdk](https://developer.microsoft.com/windows/downloads/windows-sdk/).
