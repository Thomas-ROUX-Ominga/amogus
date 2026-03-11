import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
    interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            // Never cache real-time game synchronization endpoints.
            matcher: /\/api\/game\/[^/]+\/(events|snapshot)(\?.*)?$/,
            handler: new NetworkOnly(),
            method: "GET",
        },
        ...defaultCache,
    ],
});

serwist.addEventListeners();
