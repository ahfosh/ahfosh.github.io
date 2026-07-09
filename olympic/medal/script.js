let medalData = [];
let currentSortColumn = null;
let ascendingOrder = true;

function isSafeHttpUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url, window.location.href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  fetch("medal_table.json")
    .then((response) => response.json())
    .then((data) => {
      medalData = data;
      renderTable(medalData);
    })
    .catch((error) => console.error("Error fetching data:", error));
});

function renderTable(data) {
  const tbody = document.querySelector("#medalTable tbody");
  tbody.replaceChildren();

  data.forEach((entry, index) => {
    const row = document.createElement("tr");
    const cells = Array.from({ length: 7 }, () =>
      row.appendChild(document.createElement("td")),
    );

    cells[0].textContent = String(index + 1);
    cells[1].textContent = entry.nickname == null ? "" : String(entry.nickname);

    const name = entry.name == null ? "" : String(entry.name);
    if (isSafeHttpUrl(entry.link)) {
      const a = document.createElement("a");
      a.href = entry.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = name;
      cells[2].appendChild(a);
    } else {
      cells[2].textContent = name;
    }

    const gold = Number(entry.gold) || 0;
    const silver = Number(entry.silver) || 0;
    const bronze = Number(entry.bronze) || 0;
    cells[3].textContent = String(gold);
    cells[4].textContent = String(silver);
    cells[5].textContent = String(bronze);
    cells[6].textContent = String(gold + silver + bronze);

    tbody.appendChild(row);
  });
}
