document.addEventListener("DOMContentLoaded", function () {
  fetch("schedule.json")
    .then((response) => response.json())
    .then((data) => {
      renderSchedule(data.weeks);
    })
    .catch((error) => console.error("Error fetching schedule data:", error));
});

function appendTextTd(row, text, rowspan) {
  const td = document.createElement("td");
  if (rowspan && rowspan > 0) td.rowSpan = rowspan;
  td.textContent = text == null ? "" : String(text);
  row.appendChild(td);
  return td;
}

function renderSchedule(weeks) {
  const tbody = document.querySelector("#scheduleTable tbody");
  tbody.replaceChildren();

  let lastWeek = "";
  let lastDate = "";
  let lastDay = "";

  weeks.forEach((week) => {
    week.days.forEach((day) => {
      const row = document.createElement("tr");

      let weekSpan = 0;
      if (week.week === lastWeek) {
        weekSpan = 0;
      } else {
        weekSpan = week.days.length;
        lastWeek = week.week;
      }

      let dateSpan = 0;
      if (day.date === lastDate) {
        dateSpan = 0;
      } else {
        dateSpan = 1;
        lastDate = day.date;
      }

      let daySpan = 0;
      if (day.day === lastDay) {
        daySpan = 0;
      } else {
        daySpan = 1;
        lastDay = day.day;
      }

      if (weekSpan > 0) {
        appendTextTd(row, week.week, weekSpan);
      }
      appendTextTd(row, day.date, dateSpan > 0 ? dateSpan : undefined);
      appendTextTd(row, day.day, daySpan > 0 ? daySpan : undefined);

      const events = day.events || {};
      [
        "quiz",
        "logic",
        "analysis",
        "vision",
        "memory",
        "duel",
        "chat",
        "gold",
      ].forEach((key) => {
        appendTextTd(row, events[key] || "");
      });

      tbody.appendChild(row);
    });
  });

  const finalRow = document.createElement("tr");
  const finalTd = document.createElement("td");
  finalTd.colSpan = 12;
  finalTd.style.textAlign = "center";
  finalTd.textContent = "闭幕式 & 颁奖典礼";
  finalRow.appendChild(finalTd);
  tbody.appendChild(finalRow);
}
