const sourceLinks = document.getElementById("source-links");
const regionModeBtn = document.getElementById("region-mode-btn");
const presetUserIdInput = document.getElementById("preset-user-id");
const confirmUserIdBtn = document.getElementById("confirm-user-id-btn");
const invalidOutput = document.getElementById("invalid-output");
const convertBtn = document.getElementById("convert-btn");
const reportLinkTitle = document.getElementById("report-link-title");
const reportTableBody = document.getElementById("report-table-body");
const reportRowCount = document.getElementById("report-row-count");
const copyReportBtn = document.getElementById("copy-report-btn");
const copyInvalidBtn = document.getElementById("copy-invalid-btn");
const exportReportBtn = document.getElementById("export-report-btn");
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
const REPORT_LAYOUT_VERSION = 5;
const REGION_MODES = ["中国", "全球"];

let confirmedUserId = "";
let reportRegionMode = REGION_MODES[0];
let roundOutputFormat = "replay-pano";
let lastRoundItems = [];
let invalidEntries = [];
let reportReasons = {};
let deletedReportLinks = [];
let saveStateTimer = null;

function getStateSnapshot() {
  return {
    sourceLinks: sourceLinks.value,
    reportRegionMode,
    presetUserId: presetUserIdInput.value,
    confirmedUserId,
    roundOutputFormat,
    lastRoundItems,
    invalidEntries,
    reportReasons,
    reportLayoutVersion: REPORT_LAYOUT_VERSION,
    deletedReportLinks,
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

function updateRegionModeButton() {
  regionModeBtn.textContent = reportRegionMode;
  regionModeBtn.setAttribute("aria-label", `当前模式：${reportRegionMode}`);
  regionModeBtn.classList.toggle("is-china", reportRegionMode === REGION_MODES[0]);
  regionModeBtn.classList.toggle("is-global", reportRegionMode === REGION_MODES[1]);
}

function toggleRegionMode() {
  reportRegionMode = reportRegionMode === REGION_MODES[0] ? REGION_MODES[1] : REGION_MODES[0];
  updateRegionModeButton();
  saveState();
}

function resizeSourceLinks() {
  sourceLinks.style.height = "auto";
  const style = window.getComputedStyle(sourceLinks);
  const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  sourceLinks.style.height = `${sourceLinks.scrollHeight + borderHeight}px`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const state = JSON.parse(raw);
    sourceLinks.value = typeof state.sourceLinks === "string" ? state.sourceLinks : "";
    resizeSourceLinks();
    reportRegionMode = REGION_MODES.includes(state.reportRegionMode) ? state.reportRegionMode : REGION_MODES[0];
    updateRegionModeButton();
    presetUserIdInput.value = typeof state.presetUserId === "string" ? state.presetUserId : "";
    confirmedUserId = typeof state.confirmedUserId === "string" ? state.confirmedUserId : "";
    roundOutputFormat = state.roundOutputFormat === "replayplayer" ? "replayplayer" : "replay-pano";
    lastRoundItems = Array.isArray(state.lastRoundItems) ? state.lastRoundItems : [];
    reportReasons = state.reportReasons && typeof state.reportReasons === "object" ? state.reportReasons : {};
    deletedReportLinks = state.reportLayoutVersion === REPORT_LAYOUT_VERSION && Array.isArray(state.deletedReportLinks)
      ? state.deletedReportLinks
      : [];
    setInvalidOutput(Array.isArray(state.invalidEntries) ? state.invalidEntries : []);
    updateLinkCount();
    renderReportPanel();
    return true;
  } catch (error) {
    return false;
  }
}

function extractLinks(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim().replace(/[，。；、,.;)\]}]+$/g, ""))
    .filter(Boolean);
}

function uniqueInOrder(items, getKey = item => item) {
  const seen = new Set();

  return items.filter(item => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getUniqueSourceLinks(syncInput = false) {
  const links = extractLinks(sourceLinks.value);
  const uniqueLinks = uniqueInOrder(links);

  if (syncInput && uniqueLinks.length !== links.length) {
    sourceLinks.value = uniqueLinks.join("\n");
    resizeSourceLinks();
  }

  return {
    links: uniqueLinks,
    removedCount: links.length - uniqueLinks.length,
  };
}

function updateLinkCount(count = getUniqueSourceLinks().links.length) {
  linkCount.textContent = `${count}条链接`;
}

function classifyLink(rawLink) {
  let url;

  try {
    url = new URL(rawLink);
  } catch (error) {
    return { valid: false, reason: "链接无效" };
  }

  if (url.origin !== TUXUN_ORIGIN) {
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

    if (!UUID_REGEX.test(gameId)) {
      return { valid: false, reason: "gameId非法" };
    }

    if (!round) {
      return { valid: false, reason: "缺少参数round" };
    }

    return {
      valid: true,
      item: {
        gameId,
        round,
        userId: url.searchParams.get("userId") || url.searchParams.get("chooseUser"),
      },
    };
  }

  return { valid: false, reason: "路径错误" };
}

function buildReplayLink(path, item, userId = "") {
  const params = new URLSearchParams();
  params.set("gameId", item.gameId);

  if (userId) {
    params.set("userId", userId);
  }

  if (item.round) {
    params.set("round", item.round);
  }

  return `${TUXUN_ORIGIN}/${path}?${params.toString()}`;
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

function renderInvalidLinkList(entries) {
  invalidOutput.textContent = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无链接";
    invalidOutput.appendChild(empty);
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
      row.appendChild(anchor);
    } else {
      const plainLink = document.createElement("span");
      plainLink.className = "plain-link";
      plainLink.textContent = entry.link;
      row.appendChild(plainLink);
    }

    invalidOutput.appendChild(row);
  });
}

function setInvalidOutput(entries) {
  invalidEntries = uniqueInOrder(entries, entry => `${entry.link}\0${entry.reason}`);
  renderInvalidLinkList(invalidEntries);
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

function getReportRows() {
  const seen = new Set();
  const deleted = new Set(deletedReportLinks);
  const resolved = resolveRoundUserId(lastRoundItems);
  const sharedUserId = resolved.conflict ? "" : resolved.userId || "";

  return lastRoundItems
    .map(item => {
      const reportKey = buildReplayLink("replay-pano", item);
      const reportLink = roundOutputFormat === "replayplayer"
        ? buildReplayLink("replayplayer", item, item.userId || sharedUserId)
        : reportKey;

      return {
        reportKey,
        reportLink,
        displayText: getDisplayLinkText(reportLink),
        reason: reportReasons[reportKey] || "",
      };
    })
    .filter(row => {
      if (deleted.has(row.reportKey)) {
        return false;
      }

      if (seen.has(row.reportKey)) {
        return false;
      }

      seen.add(row.reportKey);
      return true;
    });
}

function renderReportRows() {
  const rows = getReportRows();
  reportTableBody.textContent = "";

  reportRowCount.textContent = `${rows.length}条链接`;

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

    const deleteCell = document.createElement("td");
    deleteCell.className = "report-delete-cell";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-report-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `删除${row.displayText}`);
    deleteButton.addEventListener("click", () => {
      deleteReportRow(row.reportKey);
    });
    deleteCell.appendChild(deleteButton);

    const linkCell = document.createElement("td");
    linkCell.className = "report-link-cell";
    const link = document.createElement("a");
    link.className = "report-link";
    link.href = row.reportLink;
    link.title = row.reportLink;
    link.textContent = row.displayText;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
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
        reportReasons[row.reportKey] = reasonInput.value;
      } else {
        delete reportReasons[row.reportKey];
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

function deleteReportRow(reportKey) {
  if (!deletedReportLinks.includes(reportKey)) {
    deletedReportLinks.push(reportKey);
  }

  renderReportRows();
  saveState();
}

function getReportHeaderUserId() {
  const resolved = resolveRoundUserId(lastRoundItems);

  if (!resolved.conflict && resolved.userId) {
    return resolved.userId;
  }

  return confirmedUserId || presetUserIdInput.value.trim();
}

function getReportHeaderText() {
  return `uid: ${getReportHeaderUserId()}，${reportRegionMode}`;
}

function getReportExportText() {
  const rows = getReportRows();

  if (rows.length === 0) {
    return "";
  }

  return [
    getReportHeaderText(),
    ...rows.map(row => `${row.reportLink}，${row.reason}`),
  ].join("\n");
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

function updateReportPanelHeading() {
  reportLinkTitle.textContent = `${roundOutputFormat} 轮次`;
  const hasRoundLinks = lastRoundItems.length > 0;
  toggleRoundFormatBtn.hidden = !hasRoundLinks;
  toggleRoundFormatBtn.textContent = roundOutputFormat === "replay-pano" ? "replayplayer" : "replay-pano";
}

function renderReportPanel() {
  updateReportPanelHeading();
  renderReportRows();
}

function buildConvertCompleteMessage(roundCount, removedCount, invalidCount) {
  const invalidHint = invalidCount > 0 ? "，请检查" : "";
  return `转换完成：轮次${roundCount}条，去重${removedCount}条；非法${invalidCount}条${invalidHint}`;
}

function confirmPresetUserId(showFeedback = true) {
  confirmedUserId = presetUserIdInput.value.trim();
  renderReportRows();

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
  setInvalidOutput(invalid);

  renderReportPanel();

  setStatus(
    buildConvertCompleteMessage(
      getReportRows().length,
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
  } else {
    roundOutputFormat = "replay-pano";
  }

  renderReportPanel();
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
  resizeSourceLinks();
  updateLinkCount();
  scheduleSaveState();
});

regionModeBtn.addEventListener("click", toggleRegionMode);

presetUserIdInput.addEventListener("input", scheduleSaveState);

confirmUserIdBtn.addEventListener("click", () => {
  confirmPresetUserId();
});

convertBtn.addEventListener("click", convertLinks);
toggleRoundFormatBtn.addEventListener("click", toggleRoundFormat);

copyReportBtn.addEventListener("click", () => {
  copyText(getReportExportText());
});

copyInvalidBtn.addEventListener("click", () => {
  copyText(invalidEntries.map(entry => entry.link).join("\n"));
});

exportReportBtn.addEventListener("click", exportReportText);

function closeOnBackdrop(dialog, closeDialog) {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
}

function closeHelpDialog() {
  helpDialog.hidden = true;
}

helpBtn.addEventListener("click", () => {
  helpDialog.hidden = false;
});

closeHelpBtn.addEventListener("click", closeHelpDialog);

closeOnBackdrop(helpDialog, closeHelpDialog);

function clearAll() {
  sourceLinks.value = "";
  resizeSourceLinks();
  reportRegionMode = REGION_MODES[0];
  updateRegionModeButton();
  presetUserIdInput.value = "";
  confirmedUserId = "";
  lastRoundItems = [];
  roundOutputFormat = "replay-pano";
  reportReasons = {};
  deletedReportLinks = [];
  setInvalidOutput([]);
  renderReportPanel();
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

closeOnBackdrop(clearConfirm, closeClearConfirm);

window.addEventListener("resize", resizeSourceLinks);

if (!loadState()) {
  setInvalidOutput([]);
  renderReportPanel();
}

updateRegionModeButton();
resizeSourceLinks();
