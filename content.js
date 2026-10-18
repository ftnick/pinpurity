(() => {
  const OPT_OUT_IDS = [
    "918105274631",
    "961238559656",
    "935541271955",
    "953061268473",
    "948967005229",
    "903733943146",
    "924581335376",
    "918530398158",
    "898620064290",
    "935249274030",
    "919812032692",
  ];
  const DONE_KEY = "pinpurity_opt_out_done"; // boolean flag
  const FAILURE_KEY = "pinpurity_opt_out_failure"; // stores {ts, attempts}
  const LOCK_KEY = "pinpurity_opt_out_lock";
  const LOCK_TIMEOUT_MS = 2 * 60 * 1000;
  const MAX_RETRIES = 4;

  const storageGet = (keys) =>
    new Promise((resolve) => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (items) => resolve(items || {}));
        } else {
          const out = {};
          if (Array.isArray(keys)) {
            keys.forEach(
              (k) => (out[k] = JSON.parse(localStorage.getItem(k) || "null")),
            );
          } else if (typeof keys === "string") {
            out[keys] = JSON.parse(localStorage.getItem(keys) || "null");
          } else if (typeof keys === "object") {
            Object.keys(keys).forEach(
              (k) =>
                (out[k] = JSON.parse(
                  localStorage.getItem(k) || JSON.stringify(keys[k]),
                )),
            );
          }
          resolve(out);
        }
      } catch (e) {
        resolve({});
      }
    });

  const storageSet = (obj) =>
    new Promise((resolve) => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, () => resolve());
        } else {
          Object.keys(obj).forEach((k) =>
            localStorage.setItem(k, JSON.stringify(obj[k])),
          );
          resolve();
        }
      } catch (e) {
        resolve();
      }
    });

  const run = async () => {
    try {
      if (!location.hostname.endsWith("pinterest.com")) return;
      const state = await storageGet([DONE_KEY, FAILURE_KEY, LOCK_KEY]);
      if (state[DONE_KEY] === true || state[DONE_KEY] === "true") return;
      const lock = state[LOCK_KEY];
      if (lock && lock.ts && Date.now() - lock.ts < LOCK_TIMEOUT_MS) {
        console.log("pinpurity: another tab is posting; skipping");
        return;
      }

      const failureRaw = state[FAILURE_KEY];
      if (failureRaw) {
        try {
          const f =
            typeof failureRaw === "string"
              ? JSON.parse(failureRaw)
              : failureRaw;
          const attempts = Number(f.attempts || 0);
          const nextTry = Number(f.ts || 0) + Math.pow(2, attempts) * 60 * 1000;
          if (Date.now() < nextTry) return;
          if (attempts >= MAX_RETRIES) {
            console.warn("pinpurity: max retry attempts reached; not retrying");
            return;
          }
        } catch (e) {
          // continue
        }
      }

      function getCookie(name) {
        return (
          document.cookie
            .split("; ")
            .find((c) => c.trim().startsWith(name + "="))
            ?.split("=")[1] || ""
        );
      }
      const csrftoken = decodeURIComponent(
        getCookie("csrftoken") || getCookie("csrf_token") || "",
      );
      if (!csrftoken) return; // not logged in?

      const body = new URLSearchParams();
      body.set("source_url", "/edit/");
      body.set(
        "data",
        JSON.stringify({
          options: {
            url: "/v3/users/settings/",
            data: {
              gen_ai_topics_opt_out: OPT_OUT_IDS,
              gen_ai_topics_update_source: "hf_tuner",
            },
          },
          context: {},
        }),
      );

      const url = `${location.origin}/resource/ApiResource/create/`;
      const attempt = async () => {
        try {
          await storageSet({ [LOCK_KEY]: { ts: Date.now() } });
          const resp = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": csrftoken,
            },
            body: body.toString(),
          });
          const json = await resp.json().catch(() => null);
          if (
            json &&
            json.resource_response &&
            json.resource_response.status === "success" &&
            json.resource_response.http_status === 200
          ) {
            await storageSet({ [DONE_KEY]: true });
            await storageSet({ [FAILURE_KEY]: null });
            await storageSet({ [LOCK_KEY]: null });
            console.log(
              "pinpurity: applied gen_ai opt-outs",
              json.resource_response.data?.gen_ai_topics_opt_out,
            );
            try {
              location.reload();
            } catch (e) {
              /* shh */
            }
            return;
          }

          console.warn(
            "pinpurity: opt-out request returned non-success",
            json || resp.status,
          );
          const prevRaw = await storageGet(FAILURE_KEY);
          const prev =
            typeof prevRaw[FAILURE_KEY] === "string"
              ? JSON.parse(prevRaw[FAILURE_KEY] || "{}")
              : prevRaw[FAILURE_KEY] || {};
          const attempts = Number(prev.attempts || 0) + 1;
          await storageSet({ [FAILURE_KEY]: { ts: Date.now(), attempts } });
          await storageSet({ [LOCK_KEY]: null });
        } catch (err) {
          console.error("pinpurity fetch error", err);
          const prevRaw = await storageGet(FAILURE_KEY);
          const prev =
            typeof prevRaw[FAILURE_KEY] === "string"
              ? JSON.parse(prevRaw[FAILURE_KEY] || "{}")
              : prevRaw[FAILURE_KEY] || {};
          const attempts = Number(prev.attempts || 0) + 1;
          await storageSet({ [FAILURE_KEY]: { ts: Date.now(), attempts } });
          await storageSet({ [LOCK_KEY]: null });
        }
      };

      if (!window.__pinpurity_posting) {
        window.__pinpurity_posting = true;
        attempt().finally(() => {
          window.__pinpurity_posting = false;
        });
      }
    } catch (e) {
      console.error("pinpurity content script error", e);
    }
  };

  run();
})();
