import { Platform } from "react-native";
import structuredClone from "@ungap/structured-clone";

if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    // Ensure a secure RNG is available for libraries that depend on
    // `crypto.getRandomValues` (e.g., UUID generation).
    await import("react-native-get-random-values");

    const { polyfillGlobal } = await import(
      "react-native/Libraries/Utilities/PolyfillFunctions"
    );

    const { TextEncoderStream, TextDecoderStream } = await import(
      "@stardazed/streams-text-encoding"
    );

    if (!("structuredClone" in global)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }

    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
  };

  setupPolyfills();
}

export {};
