W0.1  done   1 review round   sha 379658b   preload resolves
W0.2  done   1 review round   sha 98b3518   window.electronAPI typed optional
W0.3  done   1 review round   sha 07e2dd2   stable device ID generated
W0.4  done   1 review round   sha e3a9f19   app:// protocol serves renderer
W0.5  done   1 review round   sha a96481b   CSP allows http/wss/blob
W0.6  done   1 review round   sha 93454f8   sandbox enabled, URL validated
W0.7  done   1 review round   sha 4988642   main/preload coverage measured
W0.8  done   1 review round   sha 8c57c01   smoke test launches Electron
W1.1  done   1 review round   sha 9c43bcd   @phlix/ui re-pinned to v0.98.34
W1.2  done   3 review rounds  sha 94cc043   @phlix/ui page/route inventory documented
W1.3  done   1 review round   sha 66bf64a   buildMenu rewired to 8 entries (web-ui parity)
W1.4  done   2 review rounds  sha c671152   buildExtraRoutes rewired; routeReachability guard added
W1.5  done   1 review round   sha 5504b3f   hub: 5 missing pages wired (SharedWithMe, InviteLinks, AcceptInvite, FederationShares, ServerDetail)
W1.6  done   1 review round   sha a7bdaad   frozen nav assertions replaced with membership+reachability checks
W1.7  done   2 review rounds  sha 196c9d0   admin surface verified; 23 pages (corrected from 22 est.); settings/schema-driven confirmed
W1.0  done   1 review round   sha d901aad   @phlix/contracts bumped to v0.4.1 (SyncPlayGroup type); local shadow-type removed
W2.1  done   1 review round   sha 3d4a8f7   local SyncPlay stack deleted in favour of @phlix/ui; lockfile regenerated
W2.2  done   2 review rounds   sha 0b1a3d7   ParentalControlsPage fork deleted (1373 lines); stale doc references cleaned
W2.3  done   2 review rounds   sha d030bdb   mock UserRatingPicker deleted (355 lines); copyright test fixed; stale docs cleaned
W2.4  done   1 review round   sha 5bccecf7   SkipButton deleted; upstream @phlix/ui handles skip-intro
W2.5  done   2 review rounds   sha ebba59d   10 unreachable components deleted (1883 lines, 74 tests); coverage 69.33%
W2.6  done   1 review round   sha 06dd808   react, react-dom, @types/react, @types/react-dom removed (8 packages); plugin-vue-jsx retained (4 .tsx files)
W2.7  done   1 review round   sha 40d443b   overlay rewritten: createApp once, bounded 10-retry, pinia+router attached, overlay.html deleted; 4 tests added
W3.1  done   1 review round   sha f22c56a   Space/Left/Right: registerAccelerator:false + focus guard in renderer; 9 tests added
W3.2  done   1 review round   sha 417fbaa   isQuitting separated from minimizeToTray; persisted via electron-store; tray checkbox added; 9 tests
W3.3  done   1 review round   sha 46ca24c   idempotent installers; cleanupOverlay export; disposeAll wired to HMR+beforeunload; 2 tests
W3.4  already_removed   sha n/a   SyncPlay drift correction deleted in W2.1 (ws:// client removed); no action needed
W3.5  already_removed   sha n/a   SyncPlay WS JWT logging deleted in W2.1; no action needed
W3.6  done   1 review round   sha 356cf04   Open File menu item + no-op handler removed (Branch B chosen)
W3.7  done   1 review round   sha 4c5790b   all 16 IPC channels documented and verified end-to-end
W4.1  done   1 review round   sha 18874e6   build/icon.png/ico created (midnight-jazz brand); createTray guarded with isEmpty(); prebuild hook + asset scripts; 3 trayIcon tests
W4.2  done   1 review round   sha 422798b   requestSingleInstanceLock + second-instance handler restores/focuses window; 4 singleInstance tests
W4.3  done   1 review round   sha c8b7ecc   WindowBounds persisted (debounced 250ms, off-screen guard, maximized restore); 21 windowBounds tests
W4.4  done   1 review round   sha 45b68ad   deeplink: router optional chaining fix; onDeeplink cleanup uses correct listener ref; IPC test updated
W4.5  done   2 review rounds  sha 9d4ec9b   setThumbarButtons (play/pause/rewind/forward); setProgressBar (indeterminate on start, fraction during, clear on done); @phlix/ui mediaSession already done; 16 thumbar tests
W4.6  done   1 review round   sha 0e41a94   powerSaveBlocker with ensurePowerBlocker(start); isStarted guard; power:update IPC; 4 teardown paths (close/before-quit/render-process-gone); 20 powerSaveBlocker tests
W4.7  done   2 review rounds  sha e70908e   Notification.isSupported guard; notificationsEnabled pref; notification:show IPC; click routes via phlix://internal; 7 notification tests
W4.8  done   1 review round   sha ade183f   perMachine:false; per-user install; no admin rights; auto-update friendly; docs verified (APPDATA is logs, not install)
W4.9  deferred   blocked on W4.10 (signing) — unsigned auto-update triggers SmartScreen on every update
W4.10  blocked   needs WINDOWS_CERT_BASE64 + WINDOWS_CERT_PASSWORD secrets from human
W4.11  done   1 review round   sha 5dfae99   files allow-list: dist/** build/** package.json; asar:true; sourcemap:false; 215 tests
W4.12  done   1 review round   sha 1c873f0   PHLIX_DISABLE_GPU env var; disableHardwareAcceleration pref; gpu:get-feature-status IPC; 228 tests

## Phase W5 — Performance
W5.1  done   1 review round   sha a2a106b   perf(overlay): react to router events instead of polling the pathname
W5.2  done   1 review round   sha b2268f5   perf(pip): resolve the video element once instead of forcing layout
W5.3  done   1 review round   sha f0d10b2   perf(sleeptimer): use a deadline and CSS transitions instead of intervals
W5.4  done   1 review round   sha 7fd4d28   perf(boot): parallelise IPC calls for faster first paint
W5.5  done   1 review round   sha 4d7fdd3   test(music): verify paging after removing the unbounded local screens
W5.6  done   1 review round   sha f9cb906   docs(perf): record list virtualization findings and measurements

## Phase W6 — CI and quality gates
W6.1  done   1 review round   sha edca188   ci(build): gate packaging on tests, lint, typecheck, and smoke
W6.2  done   1 review round   sha f131ca3   ci: use npm ci and key the cache on the lockfile
W6.3  done   1 review round   sha 973064c   ci(types): typecheck the test suite
W6.4  done   1 review round   sha 2ec025b   refactor(logging): use electron-log and enforce no-console
W6.5  done   1 review round   sha f55b31d   ci(security): fix audit findings and add CodeQL and audit gating
W6.6  done   1 review round   sha 0aac851   docs(ci): record the verified CI baseline
W6.7  done   1 review round   sha 2bb876c   ci(release): add SHA256SUMS, version drift check, and latest.yml to release flow

## Phase W7 — Documentation
W7.0  post-plan cleanup   sha 56e5167   docs: update @phlix/ui version reference in ui-surface.md from v0.98.34 to v0.98.39
W7.0  post-plan cleanup   sha 0e2520d   fix: align Node.js version requirement across package.json, README, and CI
W7.0  post-plan cleanup   sha 35acb98   docs: update CHANGELOG pin references to v0.98.39 and v0.4.3
W7.0  post-plan cleanup   sha 4da3cae   docs: update stale line number references in ipc-channels.md
W7.1  done   1 review round   sha 75f7139   docs(dev): rewrite the windows client page to match reality
W7.2  done   1 review round   sha 6abe3ff   docs(clients): correct the windows client claims
W7.3  done   1 review round   sha da5345a   docs(readme): fix Node.js version requirement and add npm ci guidance for CI
W7.4  done   1 review round   sha 288dfec   docs: correct the React/Vue confusion and the stale dependency pins
W7.5  done   1 review round   sha ad4df71   docs: record the architecture decisions behind the remediation
W7.6  done   1 review round   sha cbcb192   docs: state the minimum supported server version
W7.7  done   1 review round   sha ca35188   docs(changelog): record everything shipped in this plan
