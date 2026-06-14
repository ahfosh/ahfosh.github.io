const sourceLinks = document.getElementById("source-links");
const presetUserIdInput = document.getElementById("preset-user-id");
const confirmUserIdBtn = document.getElementById("confirm-user-id-btn");
const roundOutput = document.getElementById("round-output");
const reviewOutput = document.getElementById("review-output");
const invalidOutput = document.getElementById("invalid-output");
const convertBtn = document.getElementById("convert-btn");
const clearBtn = document.getElementById("clear-btn");
const clearConfirm = document.getElementById("clear-confirm");
const cancelClearBtn = document.getElementById("cancel-clear-btn");
const confirmClearBtn = document.getElementById("confirm-clear-btn");
const statusMessage = document.getElementById("status-message");
const linkCount = document.getElementById("link-count");

const TUXUN_ORIGIN = "https://tuxun.fun";
let confirmedUserId = "";
const outputLinks = { "round-output": [], "review-output": [], "invalid-output": [] };

function extractLinks(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim().replace(/[，。；、,.;)\]}]+$/g, ""))
    .filter(Boolean);
}

function uniqueInOrder(items) {
  const seen = new Set();

  return items.filter(item => {
    if (seen.has(item)) {
      return false;
    }

    seen.add(item);
    return true;
  });
}

function isTuxunUrl(url) {
  return url.origin === TUXUN_ORIGIN;
}

function parseTuxunLink(rawLink) {
  try {
    const url = new URL(rawLink);

    if (!isTuxunUrl(url)) {
      return null;
    }

    const path = url.pathname.replace(/\/+$/g, "");

    if (path === "/solo") {
      return { type: "solo", gameId: url.searchParams.get("gameId") };
    }

    if (path.startsWith("/solo/")) {
      return { type: "solo", gameId: decodeURIComponent(path.slice("/solo/".length)) };
    }

    if (path === "/replay" || path === "/replayplayer" || path === "/replay-pano") {
      return {
        type: "round",
        gameId: url.searchParams.get("gameId"),
        round: url.searchParams.get("round") || url.searchParams.get("chooseRound"),
        userId: url.searchParams.get("userId") || url.searchParams.get("chooseUser"),
      };
    }
  } catch (error) {
    return null;
  }

  return null;
}

function buildReplayPanoLink(item, userId) {
  const params = new URLSearchParams();
  params.set("gameId", item.gameId);

  if (item.round) {
    params.set("round", item.round);
  }

  params.set("userId", userId);

  return `${TUXUN_ORIGIN}/replay-pano?${params.toString()}`;
}

function buildReplayLink(item) {
  const params = new URLSearchParams();
  params.set("gameId", item.gameId);

  return `${TUXUN_ORIGIN}/replay?${params.toString()}`;
}

function canOpenAsLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function getDisplayLinkText(link) {
  const tuxunPrefix = `${TUXUN_ORIGIN}/`;

  try {
    const url = new URL(link);

    if (url.origin === TUXUN_ORIGIN) {
      url.searchParams.delete("userId");
      url.searchParams.delete("chooseUser");

      const displayText = `${url.pathname.replace(/^\//, "")}${url.search}`;

      if (url.pathname === "/replay-pano") {
        return displayText.replace(/^replay-pano\?gameId=/, "");
      }

      return displayText;
    }
  } catch (error) {
    return link;
  }

  return link.startsWith(tuxunPrefix) ? link.slice(tuxunPrefix.length) : link;
}

function renderLinkList(container, links) {
  container.textContent = "";

  if (links.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无链接";
    container.appendChild(empty);
    return;
  }

  links.forEach(link => {
    if (canOpenAsLink(link)) {
      const anchor = document.createElement("a");
      anchor.href = link;
      anchor.textContent = getDisplayLinkText(link);
      anchor.title = link;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.addEventListener("click", event => {
        event.preventDefault();
        window.open(link, "_blank", "noopener,noreferrer");
      });
      container.appendChild(anchor);
      return;
    }

    const plainLink = document.createElement("span");
    plainLink.className = "plain-link";
    plainLink.textContent = link;
    container.appendChild(plainLink);
  });
}

function setOutputLinks(container, links) {
  outputLinks[container.id] = uniqueInOrder(links);
  renderLinkList(container, outputLinks[container.id]);
}

function getOutputText(id) {
  return outputLinks[id].join("\n");
}

function isValidParsedLink(item) {
  if (!item || !item.gameId) {
    return false;
  }

  if (item.type === "round") {
    return Boolean(item.round);
  }

  return item.type === "solo";
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", type === "error");
  statusMessage.classList.toggle("is-success", type === "success");
}

function confirmPresetUserId(showFeedback = true) {
  confirmedUserId = presetUserIdInput.value.trim();

  if (!showFeedback) {
    return;
  }

  if (confirmedUserId) {
    setStatus(`已确认 userId：${confirmedUserId}`, "success");
  } else {
    setStatus("已清除预设 userId。");
  }
}

function convertLinks() {
  confirmPresetUserId(false);

  const rawLinks = extractLinks(sourceLinks.value);
  const parsedEntries = rawLinks.map(rawLink => ({ rawLink, item: parseTuxunLink(rawLink) }));
  const invalidLinks = parsedEntries.filter(entry => !isValidParsedLink(entry.item)).map(entry => entry.rawLink);
  const parsedLinks = parsedEntries.filter(entry => isValidParsedLink(entry.item)).map(entry => entry.item);
  const roundItems = parsedLinks.filter(item => item.type === "round" && item.gameId);
  const reviewItems = parsedLinks.filter(item => item.type === "solo" && item.gameId);
  const linkUserIds = uniqueInOrder(roundItems.map(item => item.userId).filter(userId => Boolean(userId)));
  const userIds = uniqueInOrder([confirmedUserId, ...linkUserIds].filter(Boolean));

  linkCount.textContent = `${rawLinks.length}条链接`;
  setOutputLinks(roundOutput, []);
  setOutputLinks(reviewOutput, reviewItems.map(buildReplayLink));
  setOutputLinks(invalidOutput, invalidLinks);

  if (roundItems.length > 0 && userIds.length > 1) {
    setStatus("userId冲突！请检查。", "error");
    return;
  }

  if (roundItems.length > 0 && userIds.length === 0) {
    setStatus("未检测到userId！请检查。", "error");
    return;
  }

  if (roundItems.length > 0) {
    setOutputLinks(
      roundOutput,
      roundItems.map(item => buildReplayPanoLink(item, userIds[0])),
    );
  }

  setStatus(
    `转换完成：轮次${outputLinks["round-output"].length}条，复盘${outputLinks["review-output"].length
    }条，非法${outputLinks["invalid-output"].length}条。`,
    "success",
  );
}

async function copyText(text) {
  if (!text.trim()) {
    setStatus("没有可复制的内容。", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("已复制到剪贴板。", "success");
  } catch (error) {
    const tempTextarea = document.createElement("textarea");
    tempTextarea.value = text;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextarea);
    setStatus("已复制到剪贴板。", "success");
  }
}

sourceLinks.addEventListener("input", () => {
  linkCount.textContent = `${extractLinks(sourceLinks.value).length}条链接`;
});

confirmUserIdBtn.addEventListener("click", () => {
  confirmPresetUserId();
});

convertBtn.addEventListener("click", convertLinks);

function clearAll() {
  sourceLinks.value = "";
  presetUserIdInput.value = "";
  confirmedUserId = "";
  setOutputLinks(roundOutput, []);
  setOutputLinks(reviewOutput, []);
  setOutputLinks(invalidOutput, []);
  linkCount.textContent = "0条链接";
  setStatus("");
}

function closeClearConfirm() {
  clearConfirm.hidden = true;
}

clearBtn.addEventListener("click", () => {
  clearConfirm.hidden = false;
});

cancelClearBtn.addEventListener("click", closeClearConfirm);

confirmClearBtn.addEventListener("click", () => {
  clearAll();
  closeClearConfirm();
});

clearConfirm.addEventListener("click", event => {
  if (event.target === clearConfirm) {
    closeClearConfirm();
  }
});

document.querySelectorAll("[data-copy-target]").forEach(button => {
  button.addEventListener("click", () => {
    copyText(getOutputText(button.dataset.copyTarget));
  });
});

setOutputLinks(roundOutput, []);
setOutputLinks(reviewOutput, []);
setOutputLinks(invalidOutput, []);
