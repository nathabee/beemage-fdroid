import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

fun versionCodeFromSemver(major: Int, minor: Int, patch: Int): Int {
    // Ensures monotonic increasing even for 0.x.y
    return (major + 1) * 1_000_000 + (minor * 1_000) + patch
}

android {
    namespace = "de.nathabee.beemage"
    compileSdk = 35

    // Repo root VERSION file (repo/VERSION), relative to apps/android-native/
    val semver = rootProject.file("../../VERSION").readText().trim()
    val parts = semver.split(".")
    require(parts.size == 3) { "VERSION must be MAJOR.MINOR.PATCH, got: $semver" }
    val major = parts[0].toInt()
    val minor = parts[1].toInt()
    val patch = parts[2].toInt()

    defaultConfig {
        applicationId = "de.nathabee.beemage"
        minSdk = 24
        targetSdk = 35

        versionName = semver
        versionCode = versionCodeFromSemver(major, minor, patch)

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            // Optional: sign only if keystore.properties exists (keeps CI/F-Droid builds simple)
            val propsFile = rootProject.file("keystore.properties")
            if (propsFile.exists()) {
                val props = Properties().apply { load(propsFile.inputStream()) }
                storeFile = rootProject.file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            if (rootProject.file("keystore.properties").exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    implementation("androidx.webkit:webkit:1.10.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
