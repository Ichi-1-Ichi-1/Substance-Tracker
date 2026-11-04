// Native features for the iOS app (bundled to www/native.js by scripts/build.mjs).
// The web version never loads this file; app.js checks window.Native before using it.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

window.Native = {
  isNative: Capacitor.isNativePlatform(),

  // Write a text file to the cache and open the iOS share sheet (Save to Files, AirDrop, …).
  async shareFile(name, text) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri] });
  },

  async notificationsAllowed(ask) {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  },

  // Replace all pending reminders with the given list of { id, at: Date, title, body }.
  async setReminders(list) {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (list.length) await LocalNotifications.schedule({ notifications: list.map(n => ({ ...n, schedule: { at: n.at, allowWhileIdle: true } })) });
  },

  async biometryAvailable() {
    try { return (await NativeBiometric.isAvailable({ useFallback: true })).isAvailable; } catch (e) { return false; }
  },

  // Resolves true when the user passed Face ID / Touch ID / device passcode.
  async unlock(reason) {
    try { await NativeBiometric.verifyIdentity({ reason, title: 'Substance Tracker entsperren', useFallback: true }); return true; }
    catch (e) { return false; }
  },
};
