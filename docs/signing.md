# Signing Guide

This document describes how to sign the Phlix Windows client for release builds.

> **CURRENT STATUS (measured 2026-10-29): signing is NOT active — releases
> ship UNSIGNED.** No certificate secret is provisioned for this repo, no CI
> step signs anything (the block in `.github/workflows/build.yml` is a
> commented, inactive sketch pointing back at this file), and every published
> artifact — the rolling "latest" prerelease and any future tag release — is a
> bare unsigned `.exe`/`.appx`. Users therefore see SmartScreen's "Windows
> protected your PC" with publisher **Unknown** on first run; the shipped
> user-facing posture (verify `SHA256SUMS.txt` with `Get-FileHash`, then More
> info → Run anyway) lives in README, *"First run: 'Windows protected your
> PC'"*. README, the build.yml comment, and this file must always tell that
> one story — a round-trip test pins the secret names shared between build.yml
> and the CI section below. Provisioning the certificates is a repo-OWNER
> action; until then, treat everything below this banner as the runbook for a
> FUTURE state: how to sign once a certificate exists, plus manual signing for
> internal/local builds.

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

If you have the Windows SDK installed (adjust `<version>` to your installed
SDK — enumerate and pick the newest, do not hard-pin a version):

```
C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\signtool.exe
```

```powershell
# PowerShell discovery — the examples below reuse its result as $ST:
$ST = (Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
  Select-Object -Last 1).FullName
```

If not, download the Windows SDK from [developer.microsoft.com/windows/downloads/windows-sdk](https://developer.microsoft.com/windows/downloads/windows-sdk/).

#### 2. Sign the Executable

```powershell
& $ST sign \
  /f certificate.pfx \
  /p <certificate-password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  release\Phlix-Setup-1.0.0.exe
```

**Flags explained:**
- `/f` — path to your `.pfx` certificate file
- `/p` — password protecting the certificate's private key
- `/fd` — file digest algorithm (SHA256 recommended)
- `/tr` — RFC 3161 timestamp server URL (provides timestamping so the signature remains valid after the certificate expires)
- `/td` — timestamp digest algorithm

#### 3. Verify the Signature

```powershell
& $ST verify /pa /v release\Phlix-Setup-1.0.0.exe
```

Expected output: `Successfully verified: release\Phlix-Setup-1.0.0.exe`

#### 4. (Recommended) Timestamp the Signature

The `/tr` flag in step 2 already handles this. If you are re-signing an existing file:

```powershell
& $ST timestamp /t http://timestamp.digicert.com release\Phlix-Setup-1.0.0.exe
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
& $ST sign \
  /f appx-certificate.pfx \
  /p <certificate-password> \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  release\Phlix.1.0.0.appx
```

(The asset name carries the `package.json` version — e.g. `Phlix.1.0.0.appx`, matching the release page listing; `1.0.0` is today's version.)

#### 3. Verify the Signature

```powershell
& $ST verify /pa /v release\Phlix.1.0.0.appx
```

---

## forceCodeSigning: Why It Stays `false` (Vendor-Proven)

`forceCodeSigning` is **not** a cosmetic label — against the locked
`electron-builder` (app-builder-lib, installed version under
`node_modules/app-builder-lib`), turning it on without a certificate
**fails every build**:

1. `out/codeSign/windowsSignToolManager.js` — `signFile` resolves the
   certificate info (`signtoolOptions.certificateFile`, else
   `WIN_CSC_LINK`); with neither configured it logs
   `"no code signing certificate configured, signing is skipped"` and
   **returns `false`**.
2. `out/winPackager.js` — `_sign` takes that as `didSignSuccessfully =
   false`, and with `forceCodeSigning` true it **throws
   `InvalidConfigurationError`** (`App is not signed and
   "forceCodeSigning" is set to true…`). A second throw guards
   `signAndEditExecutable: false` the same way.

So the flag's only honest pre-cert state is `false`, and `build.win`
carries no `forceCodeSigning`, `certificateFile`, `certificateSubject`,
`signtoolOptions` or `azureSignOptions` at all — it is exactly
`{target, icon}`.

**Where the policy lives:** `package.json` root key `signingPosture`
(status `unsigned`, `forceCodeSigning: false`, `flipGate`). It cannot
live inside `build` or `build.win`: `app-builder-lib/scheme.json` sets
`additionalProperties: false` on both the root `Configuration` and
`WindowsConfiguration`, so an unknown key there is a hard configuration
error on every electron-builder run.

**Flip gate (the only legal enablement):** WIN-08 cert provisioning —
secrets `AUTHENTICODE_CERT` / `AUTHENTICODE_CERT_PASSWORD` (win leg) and
`APPX_SIGNING_CERT` / `APPX_SIGNING_CERT_PASSWORD` (appx leg), signing on
a `windows-latest` leg per the section below — and only then set
`build.win.forceCodeSigning: true` (the per-platform knob;
`out/platformPackager.js`'s getter prefers `platformSpecificBuildOptions.forceCodeSigning`
over the top-level one) **in the same change** as this doc, the root
`signingPosture` block, and `tests/unit/signingPosturePolicy.test.mjs`,
which fails loudly on any posture/config/doc drift — including the
misconfiguration this section exists to forbid: the flag on, no certs.

---

## CI Signing Configuration (When Ready)

> **Status reminder (measured 2026-10-29): nothing below is active.** The
> corresponding block in `.github/workflows/build.yml` is a commented,
> INACTIVE sketch; releases ship UNSIGNED until the repo owner provisions
> certificates. The secret names below are the canonical ones — build.yml
> references exactly these, and `tests/unit/signingPostureWorkflow.test.mjs`
> round-trip-pins both sides, so introducing a new name here requires
> updating the workflow and the test together.
>
> **Runner leg:** `signtool.exe` is a Windows SDK binary. The `release` and
> `release-latest` jobs run on `ubuntu-26.04` and cannot execute anything
> here — signing steps belong on a `windows-latest` leg (the `build` job
> already is one), with the signed artifacts flowing into the release
> uploads. The snippets assume a `pwsh` shell, which is the GitHub Actions
> default on Windows runners.

When you are ready to wire CI to automatically sign builds:

### NSIS Authenticode

1. Store as **GitHub Actions secrets**:
   - `AUTHENTICODE_CERT` — base64-encoded `.pfx` certificate
   - `AUTHENTICODE_CERT_PASSWORD` — certificate password

2. On the windows build leg, after packaging and before artifact upload:

```yaml
- name: Import Authenticode Certificate
  env:
    AUTHENTICODE_CERT: ${{ secrets.AUTHENTICODE_CERT }}
  run: '[IO.File]::WriteAllBytes("cert.pfx",[Convert]::FromBase64String($env:AUTHENTICODE_CERT))'

- name: Sign NSIS Installer
  env:
    AUTHENTICODE_CERT_PASSWORD: ${{ secrets.AUTHENTICODE_CERT_PASSWORD }}
  run: |
    $ST = (Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
      Select-Object -Last 1).FullName   # never hard-pin the SDK version — it floats with the image
    & $ST sign /f cert.pfx /p "$env:AUTHENTICODE_CERT_PASSWORD" /fd SHA256 `
      /tr http://timestamp.digicert.com /td SHA256 release/Phlix-Setup-*.exe
```

### APPX Signing

1. Store as **GitHub Actions secrets**:
   - `APPX_SIGNING_CERT` — base64-encoded `.pfx` certificate
   - `APPX_SIGNING_CERT_PASSWORD` — certificate password

2. On the windows build leg, after the APPX is built (before artifact upload):

```yaml
- name: Sign APPX
  env:
    APPX_SIGNING_CERT: ${{ secrets.APPX_SIGNING_CERT }}
    APPX_SIGNING_CERT_PASSWORD: ${{ secrets.APPX_SIGNING_CERT_PASSWORD }}
  run: |
    [IO.File]::WriteAllBytes("appx-cert.pfx",[Convert]::FromBase64String($env:APPX_SIGNING_CERT))
    $ST = (Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
      Select-Object -Last 1).FullName
    & $ST sign /f appx-cert.pfx /p "$env:APPX_SIGNING_CERT_PASSWORD" /fd SHA256 `
      /tr http://timestamp.digicert.com /td SHA256 release/Phlix.*.appx
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
