// Helper for migrated apps that centralize platform decisions.
// process.platform is read-only and reports "openharmony" on device.
exports.isHarmonyOS = () => process.platform === "openharmony";
exports.isDesktopLike = () => ["darwin", "win32", "linux", "openharmony"].includes(process.platform);
exports.platform = () => process.platform;
