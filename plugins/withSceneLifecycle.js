// iOS 27 terminates apps built with the iOS 27 SDK at launch unless they adopt the
// UIScene life cycle (crash in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
// Expo ships `ExpoAppSceneDelegate` for this, but the SDK 57 prebuild template does not wire it
// up yet. This plugin moves window creation from the AppDelegate to a SceneDelegate.
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const SCENE_DELEGATE = `
// Added by plugins/withSceneLifecycle.js
class SceneDelegate: ExpoAppSceneDelegate {}
`;

function replaceOnce(contents, search, replacement, label) {
  if (!contents.includes(search)) {
    throw new Error(`withSceneLifecycle: could not find ${label} in AppDelegate.swift`);
  }
  return contents.replace(search, replacement);
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift") {
      throw new Error("withSceneLifecycle: only Swift AppDelegates are supported");
    }
    let contents = mod.modResults.contents;
    if (contents.includes("class SceneDelegate")) {
      return mod;
    }

    contents = replaceOnce(
      contents,
      "class AppDelegate: ExpoAppDelegate {",
      "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      "AppDelegate declaration"
    );

    // The scene delegate creates the window and starts React Native into it.
    const startBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\s*\n/;
    if (!startBlock.test(contents)) {
      throw new Error("withSceneLifecycle: could not find the startReactNative block in AppDelegate.swift");
    }
    contents = contents.replace(startBlock, "");

    mod.modResults.contents = contents + SCENE_DELEGATE;
    return mod;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return mod;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneManifest(withSceneAppDelegate(config));
};
