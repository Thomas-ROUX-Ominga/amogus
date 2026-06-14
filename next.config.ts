import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

export default withNextIntl(withSerwist({
  // Next.js config options
  serverExternalPackages: ["redis"],
}));
