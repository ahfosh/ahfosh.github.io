const svgPaths = ["sil-province.svg", "sil-prefecture.svg"];
let currentIndex = 0;
let currentSVGDoc = null;
let idAliasMap = new Map(); // Map to store ID and corresponding aliases

async function fetchSVG(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const text = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, "image/svg+xml");
    if (svgDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("SVG parsing error");
    }
    const paths = svgDoc.querySelectorAll("path");
    paths.forEach(path => {
      const id = path.getAttribute("id");
      if (id) {
        path.setAttribute("data-id", id); // Store the id in data-id attribute
      }
    });

    // Fetch and parse CSV file
    const csvUrl = url.replace(".svg", ".csv");
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      throw new Error("CSV file not found");
    }
    const csvText = await csvResponse.text();
    const csvLines = csvText.split("\n");
    csvLines.forEach(line => {
      const [id, alias] = line.trim().split(","); // Assuming ID and alias separated by comma
      if (id && alias) {
        idAliasMap.set(id, alias); // Store ID and corresponding alias in the map
      }
    });

    return svgDoc;
  } catch (error) {
    console.error("Error fetching SVG:", error.message);
    throw error; // Propagate the error for further handling
  }
}

function selectRandomPath(svgDoc) {
  const paths = svgDoc.querySelectorAll("path");
  const randomIndex = Math.floor(Math.random() * paths.length);
  return paths[randomIndex];
}

function displayPath(path) {
  const displaySVG = document.getElementById("display-svg");
  // Clear previous path
  displaySVG.innerHTML = "";
  const clonedPath = path.cloneNode(true);
  clonedPath.setAttribute("fill", "white"); // 设置填充颜色为白色
  displaySVG.appendChild(clonedPath);

  const viewBoxValues = clonedPath.getBBox();
  displaySVG.setAttribute(
    "viewBox",
    `${viewBoxValues.x} ${viewBoxValues.y} ${viewBoxValues.width} ${viewBoxValues.height}`
  );
}

async function loadAndDisplaySVG(svgUrl) {
  try {
    if (!currentSVGDoc) {
      console.log("Fetching SVG:", svgUrl);
      currentSVGDoc = await fetchSVG(svgUrl);
      console.log("SVG fetched successfully");
    }
    const randomPath = selectRandomPath(currentSVGDoc);
    displayPath(randomPath);
    document.getElementById("input-id").value = ""; // Clear input field
  } catch (error) {
    console.error("Failed to fetch or display SVG:", error.message);
    throw error; // Propagate the error for further handling
  }
}

let shouldStopExecution = false; // Flag to control function execution

function checkInput() {
  if (shouldStopExecution) return; // Check if execution should be stopped

  const inputId = document.getElementById("input-id").value.trim();
  const currentPath = document.querySelector("#display-svg path");
  if (!currentPath) {
    console.error("No path is currently displayed.");
    return;
  }
  const currentPathId = currentPath.dataset.id;
  const currentPathAlias = idAliasMap.get(currentPathId); // Check if input matches alias
  if (inputId.length > 0 && (inputId === currentPathId || inputId === currentPathAlias)) {
    loadAndDisplaySVG(svgPaths[currentIndex]);
  } else if (inputId.length > 0) {
    shouldStopExecution = true; // Set flag to stop execution
  }
}

// Set the SVG file URL
loadAndDisplaySVG(svgPaths[currentIndex]);

document.getElementById("input-id").addEventListener("input", function () {
  shouldStopExecution = false; // Reset flag on input event
  checkInput(); // Call checkInput function
});

// Switch to a new Path
document.getElementById("refresh-btn").addEventListener("click", () => {
  currentSVGDoc = null; // Reset current SVG document
  loadAndDisplaySVG(svgPaths[currentIndex]);
});

// Switch SVG button functionality
document.getElementById("switch-btn").addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % svgPaths.length;
  currentSVGDoc = null; // Reset current SVG document
  loadAndDisplaySVG(svgPaths[currentIndex]);
});
