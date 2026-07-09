let addedTexts = [];

function generateSVG() {
  const rows = parseInt(document.getElementById("rows").value, 10) || 0;
  const columns = parseInt(document.getElementById("columns").value, 10) || 0;
  const svg = document.getElementById("svg");
  svg.replaceChildren();
  const NS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(j * 50));
      rect.setAttribute("y", String(i * 50));
      rect.setAttribute("width", "50");
      rect.setAttribute("height", "50");
      rect.setAttribute("fill", "white");
      rect.setAttribute("stroke", "black");
      rect.setAttribute("stroke-width", "1");
      svg.appendChild(rect);
    }
  }
  addedTexts = [];
}

function addText() {
  const text = document.getElementById("text").value;
  const svg = document.getElementById("svg");
  const textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  const xCell = parseInt(document.getElementById("xCoordinate").value);
  const yCell = parseInt(document.getElementById("yCoordinate").value);
  const orientation = document.getElementById("orientation").value;

  if (orientation === "vertical") {
    textElement.setAttribute("writing-mode", "tb");
    textElement.setAttribute("x", xCell * 50 - 26.5);
    textElement.setAttribute("y", yCell * 50 - 33.25);
  } else if (orientation === "horizontal") {
    textElement.setAttribute("x", xCell * 50 - 32.5);
    textElement.setAttribute("y", yCell * 50 - 24);
  }

  textElement.setAttribute("dominant-baseline", "middle");
  textElement.setAttribute("letter-spacing", "34");
  textElement.textContent = text;
  textElement.setAttribute("id", text);
  addedTexts.push(textElement);
  svg.appendChild(textElement.cloneNode(true));
}

function undo() {
  const svg = document.getElementById("svg");
  if (addedTexts.length > 0) {
    const lastTextId = addedTexts.pop().id;
    const lastTextElement = document.getElementById(lastTextId);
    if (lastTextElement) {
      svg.removeChild(lastTextElement);
    }
  }
}

function exportSVG() {
  const svg = document.getElementById("svg");
  const svgCopy = svg.cloneNode(true);
  const texts = svgCopy.querySelectorAll("text");
  texts.forEach((text) => {
    text.setAttribute("fill", "none");
  });
  const svgData = new XMLSerializer().serializeToString(svgCopy);
  const blob = new Blob([svgData], {
    type: "image/svg+xml",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "generated.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function checkMaxValue(input) {
  if (parseInt(input.value) > parseInt(input.max)) {
    input.value = input.max;
  }
}
