const sourceLinks = document.getElementById("source-links");
const presetUserIdInput = document.getElementById("preset-user-id");
const confirmUserIdBtn = document.getElementById("confirm-user-id-btn");
const roundOutput = document.getElementById("round-output");
const roundTitle = document.getElementById("round-title");
const invalidOutput = document.getElementById("invalid-output");
const convertBtn = document.getElementById("convert-btn");
const converterView = document.getElementById("converter-view");
const reviewView = document.getElementById("review-view");
const converterViewBtn = document.getElementById("converter-view-btn");
const reviewViewBtn = document.getElementById("review-view-btn");
const reviewTable = document.getElementById("review-table");
const reportTableBody = document.getElementById("report-table-body");
const reviewRowCount = document.getElementById("review-row-count");
const copyReportBtn = document.getElementById("copy-report-btn");
const exportReportBtn = document.getElementById("export-report-btn");
const reviewFrame = document.getElementById("review-frame");
const playbackFrame = document.getElementById("playback-frame");
const reviewFrameEmpty = document.getElementById("review-frame-empty");
const playbackFrameEmpty = document.getElementById("playback-frame-empty");
const reviewFrameLabel = document.getElementById("review-frame-label");
const playbackFrameLabel = document.getElementById("playback-frame-label");
const toggleRoundFormatBtn = document.getElementById("toggle-round-format-btn");
const helpBtn = document.getElementById("help-btn");
const helpDialog = document.getElementById("help-dialog");
const closeHelpBtn = document.getElementById("close-help-btn");
const clearBtn = document.getElementById("clear-btn");
const clearConfirm = document.getElementById("clear-confirm");
const cancelClearBtn = document.getElementById("cancel-clear-btn");
const confirmClearBtn = document.getElementById("confirm-clear-btn");
const statusMessage = document.getElementById("status-message");
const linkCount = document.getElementById("link-count");

const TUXUN_ORIGIN = "https://tuxun.fun";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_KEY = "tuxun_volunteer_report";
const REPORT_LAYOUT_VERSION = 3;

let confirmedUserId = "";
let roundOutputFormat = "replay-pano";
let lastRoundItems = [];
const outputLinks = { "round-output": [] };
let invalidEntries = [];
let reportReasons = {};
let deletedReportLinks = [];
let activeReportLink = "";
let activeView = "converter";
let saveStateTimer = null;

function getStateSnapshot() {
  return {
    sourceLinks: sourceLinks.value,
    presetUserId: presetUserIdInput.value,
    confirmedUserId,
    roundOutputFormat,
    lastRoundItems,
    roundOutputLinks: outputLinks["round-output"],
    invalidEntries,
    reportReasons,
    reportLayoutVersion: REPORT_LAYOUT_VERSION,
    deletedReportLinks,
    activeReportLink,
    activeView,
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getStateSnapshot()));
  } catch (error) {
    // ignore storage quota or privacy mode errors
  }
}

function scheduleSaveState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(saveState, 300);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const state = JSON.parse(raw);
    sourceLinks.value = typeof state.sourceLinks === "string" ? state.sourceLinks : "";
    presetUserIdInput.value = typeof state.presetUserId === "string" ? state.presetUserId : "";
    confirmedUserId = typeof state.confirmedUserId === "string" ? state.confirmedUserId : "";
    roundOutputFormat = state.roundOutputFormat === "replayplayer" ? "replayplayer" : "replay-pano";
    lastRoundItems = Array.isArray(state.lastRoundItems) ? state.lastRoundItems : [];
    reportReasons = state.reportReasons && typeof state.reportReasons === "object" ? state.reportReasons : {};
    deletedReportLinks = state.reportLayoutVersion === REPORT_LAYOUT_VERSION && Array.isArray(state.deletedReportLinks)
      ? state.deletedReportLinks
      : [];
    activeReportLink = typeof state.activeReportLink === "string" ? state.activeReportLink : "";
    activeView = state.activeView === "review" ? "review" : "converter";
    setOutputLinks(
      roundOutput,
      Array.isArray(state.roundOutputLinks) ? state.roundOutputLinks : [],
    );
    setInvalidOutput(Array.isArray(state.invalidEntries) ? state.invalidEntries : []);
    updateLinkCount();
    updateRoundPanelHeading();
    syncReportWorkspace();
    setActiveView(activeView, false);
    return true;
  } catch (error) {
    return false;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function getUniqueSourceLinks(syncInput = false) {
  const links = extractLinks(sourceLinks.value);
  const uniqueLinks = uniqueInOrder(links);

  if (syncInput && uniqueLinks.length !== links.length) {
    sourceLinks.value = uniqueLinks.join("\n");
  }

  return {
    links: uniqueLinks,
    removedCount: links.length - uniqueLinks.length,
  };
}

function updateLinkCount(count = getUniqueSourceLinks().links.length) {
  linkCount.textContent = `${count}条链接`;
}

function isTuxunUrl(url) {
  return url.origin === TUXUN_ORIGIN;
}

function isValidGameId(gameId) {
  return Boolean(gameId && UUID_REGEX.test(gameId));
}

function classifyLink(rawLink) {
  let url;

  try {
    url = new URL(rawLink);
  } catch (error) {
    return { valid: false, reason: "链接无效" };
  }

  if (!isTuxunUrl(url)) {
    return { valid: false, reason: "域名错误" };
  }

  const path = url.pathname.replace(/\/+$/g, "");

  if (path === "/solo" || path.startsWith("/solo/")) {
    return { valid: false, reason: "复盘链接" };
  }

  if (path === "/replay" || path === "/replayplayer" || path === "/replay-pano") {
    const gameId = url.searchParams.get("gameId");
    const round = url.searchParams.get("round") || url.searchParams.get("chooseRound");

    if (!gameId) {
      return { valid: false, reason: "缺少参数gameId" };
    }

    if (!isValidGameId(gameId)) {
      return { valid: false, reason: "gameId非法" };
    }

    if (!round) {
      return { valid: false, reason: "缺少参数round" };
    }

    return {
      valid: true,
      item: {
        type: "round",
        gameId,
        round,
        userId: url.searchParams.get("userId") || url.searchParams.get("chooseUser"),
      },
    };
  }

  return { valid: false, reason: "路径错误" };
}

function buildReplayPanoLink(item) {
  const params = new URLSearchParams();
  params.set("gameId", item.gameId);

  if (item.round) {
    params.set("round", item.round);
  }

  return `${TUXUN_ORIGIN}/replay-pano?${params.toString()}`;
}

function buildReplayPlayerLink(item, userId) {
  const params = new URLSearchParams();
  params.set("gameId", item.gameId);

  if (userId) {
    params.set("userId", userId);
  }

  if (item.round) {
    params.set("round", item.round);
  }

  return `${TUXUN_ORIGIN}/replayplayer?${params.toString()}`;
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

      if (url.pathname === "/replay-pano" || url.pathname === "/replayplayer") {
        return displayText.replace(/^replay(?:-pano|player)\?gameId=/, "");
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

function renderInvalidLinkList(container, entries) {
  container.textContent = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无链接";
    container.appendChild(empty);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "invalid-item";

    const reason = document.createElement("span");
    reason.className = "invalid-reason";
    reason.textContent = entry.reason;
    row.appendChild(reason);

    if (canOpenAsLink(entry.link)) {
      const anchor = document.createElement("a");
      anchor.href = entry.link;
      anchor.textContent = getDisplayLinkText(entry.link);
      anchor.title = entry.link;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.addEventListener("click", event => {
        event.preventDefault();
        window.open(entry.link, "_blank", "noopener,noreferrer");
      });
      row.appendChild(anchor);
    } else {
      const plainLink = document.createElement("span");
      plainLink.className = "plain-link";
      plainLink.textContent = entry.link;
      row.appendChild(plainLink);
    }

    container.appendChild(row);
  });
}

function setOutputLinks(container, links) {
  outputLinks[container.id] = uniqueInOrder(links);
  renderLinkList(container, outputLinks[container.id]);
}

function setInvalidOutput(entries) {
  const seen = new Set();
  invalidEntries = entries.filter(entry => {
    const key = `${entry.link}\0${entry.reason}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
  renderInvalidLinkList(invalidOutput, invalidEntries);
}

function getOutputText(id) {
  if (id === "invalid-output") {
    return invalidEntries.map(entry => entry.link).join("\n");
  }

  return outputLinks[id].join("\n");
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", type === "error");
  statusMessage.classList.toggle("is-success", type === "success");
}

function resolveRoundUserId(roundItems) {
  const linkUserIds = uniqueInOrder(roundItems.map(item => item.userId).filter(Boolean));
  const userIds = uniqueInOrder([confirmedUserId, ...linkUserIds].filter(Boolean));

  if (userIds.length > 1) {
    return { userId: null, conflict: true };
  }

  if (userIds.length === 1) {
    return { userId: userIds[0], conflict: false };
  }

  return { userId: null, conflict: false };
}

function buildRoundOutputLinks(items, format, userId) {
  if (format === "replayplayer") {
    return items.map(item => buildReplayPlayerLink(item, userId));
  }

  return items.map(item => buildReplayPanoLink(item));
}

function setActiveView(view, shouldSave = true) {
  activeView = view === "review" ? "review" : "converter";
  const isReviewView = activeView === "review";

  converterView.hidden = isReviewView;
  reviewView.hidden = !isReviewView;
  document.body.classList.toggle("is-review-mode", isReviewView);
  converterViewBtn.classList.toggle("is-active", !isReviewView);
  reviewViewBtn.classList.toggle("is-active", isReviewView);
  converterViewBtn.setAttribute("aria-selected", String(!isReviewView));
  reviewViewBtn.setAttribute("aria-selected", String(isReviewView));

  if (shouldSave) {
    saveState();
  }
}

function requestReviewFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }

  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {
    // Fullscreen can be denied by browser settings or lack of user activation.
  });
}

function exitReviewFullscreen() {
  if (!document.fullscreenElement) {
    return;
  }

  document.exitFullscreen().catch(() => {
    // Ignore browser-level fullscreen exit failures.
  });
}

function getReportRows() {
  const resolved = resolveRoundUserId(lastRoundItems);
  const seen = new Set();
  const deleted = new Set(deletedReportLinks);

  return lastRoundItems
    .map(item => {
      const reviewLink = buildReplayPanoLink(item);
      const playbackUserId = item.userId || (resolved.conflict ? "" : resolved.userId) || "";
      const playbackLink = buildReplayPlayerLink(item, playbackUserId);

      return {
        gameId: item.gameId,
        round: item.round,
        reviewLink,
        playbackLink,
        displayText: getDisplayLinkText(reviewLink),
        reason: reportReasons[reviewLink] || "",
      };
    })
    .filter(row => {
      if (deleted.has(row.reviewLink)) {
        return false;
      }

      if (seen.has(row.reviewLink)) {
        return false;
      }

      seen.add(row.reviewLink);
      return true;
    });
}

function renderReportRows() {
  const rows = getReportRows();
  reportTableBody.textContent = "";

  if (reviewRowCount) {
    reviewRowCount.textContent = `${rows.length}条链接`;
  }

  if (rows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "report-empty-row";

    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 3;
    emptyCell.textContent = "暂无复盘链接";
    emptyRow.appendChild(emptyCell);
    reportTableBody.appendChild(emptyRow);
    return;
  }

  rows.forEach(row => {
    const tableRow = document.createElement("tr");
    tableRow.className = "report-row";
    tableRow.classList.toggle("is-active", row.reviewLink === activeReportLink);

    const deleteCell = document.createElement("td");
    deleteCell.className = "report-delete-cell";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-report-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `删除${row.displayText}`);
    deleteButton.addEventListener("click", () => {
      deleteReportRow(row.reviewLink);
    });
    deleteCell.appendChild(deleteButton);

    const linkCell = document.createElement("td");
    linkCell.className = "report-link-cell";
    const link = document.createElement("a");
    link.className = "report-link";
    link.href = row.reviewLink;
    link.title = row.reviewLink;
    link.textContent = row.displayText;
    link.addEventListener("click", event => {
      event.preventDefault();
      selectReportRow(row);
    });
    linkCell.appendChild(link);

    const reasonCell = document.createElement("td");
    reasonCell.className = "report-reason-cell";
    const reasonInput = document.createElement("input");
    reasonInput.type = "text";
    reasonInput.className = "report-reason-input";
    reasonInput.placeholder = "举报原因";
    reasonInput.value = row.reason;
    reasonInput.addEventListener("input", () => {
      if (reasonInput.value) {
        reportReasons[row.reviewLink] = reasonInput.value;
      } else {
        delete reportReasons[row.reviewLink];
      }

      scheduleSaveState();
    });
    reasonCell.appendChild(reasonInput);

    tableRow.appendChild(deleteCell);
    tableRow.appendChild(linkCell);
    tableRow.appendChild(reasonCell);
    reportTableBody.appendChild(tableRow);
  });
}

function setEmbeddedFrames(row) {
  reviewFrame.src = row.reviewLink;
  reviewFrame.hidden = false;
  reviewFrameEmpty.hidden = true;

  if (reviewFrameLabel) {
    reviewFrameLabel.textContent = `第${row.round}轮`;
  }

  playbackFrame.src = row.playbackLink;
  playbackFrame.hidden = false;
  playbackFrameEmpty.hidden = true;

  if (playbackFrameLabel) {
    playbackFrameLabel.textContent = `第${row.round}轮`;
  }
}

function clearEmbeddedFrames() {
  reviewFrame.removeAttribute("src");
  reviewFrame.hidden = true;
  reviewFrameEmpty.hidden = false;

  if (reviewFrameLabel) {
    reviewFrameLabel.textContent = "未选择";
  }

  playbackFrame.removeAttribute("src");
  playbackFrame.hidden = true;
  playbackFrameEmpty.hidden = false;

  if (playbackFrameLabel) {
    playbackFrameLabel.textContent = "未选择";
  }
}

function selectReportRow(row) {
  activeReportLink = row.reviewLink;
  setEmbeddedFrames(row);
  renderReportRows();
  saveState();
}

function restoreReportFrameSelection() {
  const selectedRow = getReportRows().find(row => row.reviewLink === activeReportLink);

  if (selectedRow) {
    setEmbeddedFrames(selectedRow);
    return;
  }

  activeReportLink = "";
  clearEmbeddedFrames();
}

function syncReportWorkspace() {
  restoreReportFrameSelection();
  renderReportRows();
}

function deleteReportRow(reviewLink) {
  if (!deletedReportLinks.includes(reviewLink)) {
    deletedReportLinks.push(reviewLink);
  }

  if (activeReportLink === reviewLink) {
    activeReportLink = "";
    clearEmbeddedFrames();
  }

  renderReportRows();
  saveState();
}

function getReportExportText() {
  return getReportRows()
    .map(row => `${row.reviewLink}，${reportReasons[row.reviewLink] || ""}`)
    .join("\n");
}

function exportReportText() {
  const text = getReportExportText();

  if (!text.trim()) {
    setStatus("没有可导出的内容。", "error");
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "图寻举报原因.txt";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  setStatus("已导出txt。", "success");
}

function updateRoundPanelHeading() {
  roundTitle.textContent = `${roundOutputFormat} 轮次`;
  const hasRoundLinks = outputLinks["round-output"].length > 0;
  toggleRoundFormatBtn.hidden = !hasRoundLinks;
  toggleRoundFormatBtn.textContent = roundOutputFormat === "replay-pano" ? "replayplayer" : "replay-pano";
}

function buildConvertCompleteMessage(roundCount, removedCount, invalidCount) {
  const invalidHint = invalidCount > 0 ? "，请检查" : "";
  return `转换完成：轮次${roundCount}条，去重${removedCount}条；非法${invalidCount}条${invalidHint}`;
}

function confirmPresetUserId(showFeedback = true) {
  confirmedUserId = presetUserIdInput.value.trim();
  syncReportWorkspace();

  if (!showFeedback) {
    return;
  }

  if (confirmedUserId) {
    setStatus(`已确认 userId：${confirmedUserId}`, "success");
  } else {
    setStatus("已清除预设 userId。");
  }

  saveState();
}

function convertLinks() {
  confirmPresetUserId(false);

  const { links: rawLinks, removedCount } = getUniqueSourceLinks(true);
  const classified = rawLinks.map(rawLink => ({ rawLink, ...classifyLink(rawLink) }));
  const invalid = classified
    .filter(entry => !entry.valid)
    .map(entry => ({ link: entry.rawLink, reason: entry.reason }));
  const roundItems = classified.filter(entry => entry.valid).map(entry => entry.item);

  updateLinkCount(rawLinks.length);
  lastRoundItems = roundItems;
  roundOutputFormat = "replay-pano";
  setOutputLinks(roundOutput, []);
  setInvalidOutput(invalid);

  if (roundItems.length > 0) {
    setOutputLinks(roundOutput, buildRoundOutputLinks(roundItems, "replay-pano"));
  }

  updateRoundPanelHeading();
  syncReportWorkspace();

  setStatus(
    buildConvertCompleteMessage(
      outputLinks["round-output"].length,
      removedCount,
      invalidEntries.length,
    ),
    "success",
  );

  saveState();
}

function toggleRoundFormat() {
  if (lastRoundItems.length === 0) {
    return;
  }

  if (roundOutputFormat === "replay-pano") {
    const { userId, conflict } = resolveRoundUserId(lastRoundItems);

    if (conflict) {
      setStatus("userId冲突！请检查。", "error");
      return;
    }

    if (!userId) {
      setStatus("未检测到userId！请检查。", "error");
      return;
    }

    roundOutputFormat = "replayplayer";
    setOutputLinks(roundOutput, buildRoundOutputLinks(lastRoundItems, "replayplayer", userId));
  } else {
    roundOutputFormat = "replay-pano";
    setOutputLinks(roundOutput, buildRoundOutputLinks(lastRoundItems, "replay-pano"));
  }

  updateRoundPanelHeading();
  saveState();
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
  updateLinkCount();
  scheduleSaveState();
});

presetUserIdInput.addEventListener("input", scheduleSaveState);

confirmUserIdBtn.addEventListener("click", () => {
  confirmPresetUserId();
});

convertBtn.addEventListener("click", convertLinks);
toggleRoundFormatBtn.addEventListener("click", toggleRoundFormat);
converterViewBtn.addEventListener("click", () => {
  setActiveView("converter");
  exitReviewFullscreen();
});

reviewViewBtn.addEventListener("click", () => {
  setActiveView("review");
  requestReviewFullscreen();
});

reviewColumnResizer.addEventListener("pointerdown", startReportColumnResize);
reviewColumnResizer.addEventListener("keydown", handleReportColumnKeydown);

function closeHelpDialog() {
  helpDialog.hidden = true;
}

helpBtn.addEventListener("click", () => {
  helpDialog.hidden = false;
});

closeHelpBtn.addEventListener("click", closeHelpDialog);

helpDialog.addEventListener("click", event => {
  if (event.target === helpDialog) {
    closeHelpDialog();
  }
});

function clearAll() {
  sourceLinks.value = "";
  presetUserIdInput.value = "";
  confirmedUserId = "";
  lastRoundItems = [];
  roundOutputFormat = "replay-pano";
  reportReasons = {};
  activeReportLink = "";
  setOutputLinks(roundOutput, []);
  setInvalidOutput([]);
  updateRoundPanelHeading();
  syncReportWorkspace();
  updateLinkCount(0);
  setStatus("");
  saveState();
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

if (!loadState()) {
  setOutputLinks(roundOutput, []);
  setInvalidOutput([]);
  updateRoundPanelHeading();
  applyReportColumnWidth();
  syncReportWorkspace();
  setActiveView("converter", false);
}
