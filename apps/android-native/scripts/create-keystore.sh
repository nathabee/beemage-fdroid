cd apps/android-native
keytool -genkeypair -v \
  -keystore beemage-release.jks \
  -alias beemage \
  -keyalg RSA -keysize 4096 \
  -validity 10000
