// BakBak web-push service worker. Registered from src/lib/push.ts.
//
// It only ever shows notifications for pushes that carry a title; everything
// else (read receipts, presence, etc.) is delivered over the live socket and
// never touches this file. Click opens the chat in an existing window when
// there is one, otherwise a new tab.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Notification icon ───────────────────────────────────────────────────────
// The sender's avatar cropped to a circle, with a round BakBak badge at the
// bottom-right — the same composition as the in-app message toast. Drawn on
// an OffscreenCanvas and handed to showNotification as a PNG data URL.

const ICON_SIZE = 192;
const LOGO_FALLBACK = "/images/branding/logo.svg";

// public/images/branding/logo.svg (viewBox 401×328): a speech bubble whose
// three dots are holes, so filled white on the gradient the dots show through.
const LOGO_W = 401;
const LOGO_H = 328;
const LOGO_PATH =
  "M104.886 5.31572C178.915 -1.9983 238.454 -1.77395 312.267 6.04619C353.935 10.4607 387.963 42.019 393.962 83.4886C402.444 142.127 402.384 189.453 394.186 244.715C388.154 285.381 354.787 316.303 313.903 320.62C240.44 328.379 179.544 327.397 101.294 319.905C99.4781 319.731 97.6756 319.507 95.8895 319.234C88.4559 318.097 80.9061 317.382 73.4579 318.418L6.83383 327.69C2.39615 328.307 -1.128 324.02 0.336758 319.785L15.244 276.691C19.3098 264.937 18.6723 252.22 17.1209 239.88C17.0214 239.089 16.9324 238.294 16.8534 237.495C10.8556 176.922 13.3551 136.392 18.0995 92.9134C23.1002 47.085 59.0085 9.84836 104.886 5.31572ZM121.829 135.999C106.641 135.999 94.3291 148.312 94.3289 163.499C94.3289 178.687 106.641 190.999 121.829 190.999C137.017 190.999 149.329 178.687 149.329 163.499C149.329 148.312 137.017 135.999 121.829 135.999ZM206.829 135.999C191.641 135.999 179.329 148.312 179.329 163.499C179.329 178.687 191.641 190.999 206.829 190.999C222.017 190.999 234.329 178.687 234.329 163.499C234.329 148.312 222.017 135.999 206.829 135.999ZM291.829 135.999C276.641 135.999 264.329 148.312 264.329 163.499C264.329 178.687 276.641 190.999 291.829 190.999C307.017 190.999 319.329 178.687 319.329 163.499C319.329 148.312 307.017 135.999 291.829 135.999Z";

/** Download the avatar as a bitmap; null if missing, slow, expired or CORS-blocked. */
async function loadAvatar(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

async function composeIcon(data) {
  if (typeof OffscreenCanvas === "undefined") return null;
  const size = ICON_SIZE;
  const half = size / 2;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const avatar = await loadAvatar(data.icon);

  // Avatar, clipped to a circle. Photo is cover-cropped; without one, the
  // sender's initial on the app's violet avatar colours.
  ctx.save();
  circle(ctx, half, half, half);
  ctx.clip();
  if (avatar) {
    const scale = Math.max(size / avatar.width, size / avatar.height);
    const w = avatar.width * scale;
    const h = avatar.height * scale;
    ctx.drawImage(avatar, (size - w) / 2, (size - h) / 2, w, h);
    avatar.close();
  } else {
    ctx.fillStyle = "#ede9fe";
    ctx.fillRect(0, 0, size, size);
    const name = (data.senderName || data.title || "B").trim();
    ctx.fillStyle = "#7c3aed";
    ctx.font = `600 ${Math.round(size * 0.44)}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.charAt(0).toUpperCase(), half, half + size * 0.02);
  }
  ctx.restore();

  // BakBak badge, bottom-right. A transparent gap cut around it keeps it
  // separate from the photo on light and dark notification backgrounds alike.
  const badgeR = size * 0.2;
  const bx = size - badgeR - 2;
  const by = size - badgeR - 2;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  circle(ctx, bx, by, badgeR + size * 0.035);
  ctx.fill();
  ctx.restore();

  const gradient = ctx.createLinearGradient(bx, by - badgeR, bx, by + badgeR);
  gradient.addColorStop(0, "#805FF8");
  gradient.addColorStop(1, "#4C18EF");
  ctx.fillStyle = gradient;
  circle(ctx, bx, by, badgeR);
  ctx.fill();

  const glyphW = badgeR * 1.15;
  const glyphScale = glyphW / LOGO_W;
  ctx.save();
  ctx.translate(bx - glyphW / 2, by - (LOGO_H * glyphScale) / 2 + badgeR * 0.03);
  ctx.scale(glyphScale, glyphScale);
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(LOGO_PATH), "evenodd");
  ctx.restore();

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

// ── Push & click ────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title;
  if (!title) return;

  // The API sends `chatId`, not a URL — build the chat route from it so a
  // click lands in the conversation instead of the home screen.
  const url = data.url || (data.chatId ? `/chats/${data.chatId}` : "/");

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // A focused app tab is on screen: it already handles the message
      // through the socket (in-app toast), so skip the OS popup — otherwise
      // every message would double-notify.
      if (clients.some((client) => client.focused)) return;

      let icon = null;
      try {
        icon = await composeIcon(data);
      } catch {
        icon = null;
      }

      await self.registration.showNotification(title, {
        body: data.body || "",
        // Composed icon, else the raw avatar (browsers load icons without
        // CORS), else the app logo.
        icon: icon || data.icon || LOGO_FALLBACK,
        badge: data.badge || "/favicon.svg",
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) void client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
