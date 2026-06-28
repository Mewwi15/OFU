const { withGradleProperties } = require('expo/config-plugins');

/**
 * Force the Android Gradle JVM to run under the en/US locale.
 *
 * Why: on machines whose default locale is Thai (th_TH), the JVM's
 * `Calendar.getInstance()` returns a Buddhist calendar where the year is
 * +543 (e.g. 2026 → 2569). During `mergeDebugJavaResource`, apkzlib packs the
 * current date into the ZIP's MS-DOS date field, which only encodes years
 * 1980–2107, so 2569 trips a `MsDosDateTimeUtils.packDate` VerifyException and
 * the build fails with a cryptic "com.google.common.base.VerifyException (no
 * error message)".
 *
 * Since `android/` is gitignored (Expo CNG), a manual edit to
 * `android/gradle.properties` is wiped by `expo prebuild`. This plugin
 * re-applies the override on every prebuild so the Android build stays green.
 */
const JVM_ARGS_KEY = 'org.gradle.jvmargs';
const LOCALE_ARGS = '-Duser.language=en -Duser.country=US';

module.exports = function withGradleJvmLocale(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === JVM_ARGS_KEY,
    );

    if (existing) {
      if (!existing.value.includes('-Duser.country=US')) {
        existing.value = `${existing.value} ${LOCALE_ARGS}`;
      }
    } else {
      cfg.modResults.push({
        type: 'property',
        key: JVM_ARGS_KEY,
        value: `-Xmx2048m -XX:MaxMetaspaceSize=512m ${LOCALE_ARGS}`,
      });
    }

    return cfg;
  });
};
