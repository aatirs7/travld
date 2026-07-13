// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
    rules: {
      // Responsive-layout standard §5: screens must import Text from @travld/ui
      // (capped Dynamic Type), never react-native's Text directly.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Import { Text } from '@travld/ui' instead — it caps the Dynamic Type multiplier.",
            },
          ],
        },
      ],
    },
  },
]);
