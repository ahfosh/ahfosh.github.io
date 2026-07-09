function processFiles() {
  const svgFileName = "svg.svg";
  const placeNamesInput = document.getElementById("placeNames").value;

  // 使用正则表达式匹配地名
  const placeNames = extractPlaceNames(placeNamesInput);

  if (placeNames.length === 0) {
    alert("请输入至少一个地名。");
    return;
  }

  readSVG(svgFileName)
    .then((svgData) => {
      const resultSVG = filterAndStyleSVG(svgData, placeNames);
      displayPreview(resultSVG); // 显示预览
      createDownloadLink(resultSVG); // 创建下载链接
    })
    .catch((error) => {
      console.error("处理文件时出错：", error);
      alert("处理文件时出错，请检查控制台获取更多信息。");
    });
}

function extractPlaceNames(inputText) {
  const placeNames = [];
  const regex = /[^\s,，\/、]+/g; // 匹配不包含空格、逗号、斜杠、顿号的连续字符
  let match;
  while ((match = regex.exec(inputText)) !== null) {
    placeNames.push(match[0]);
  }
  return placeNames;
}

function readSVG(fileName) {
  return fetch(fileName)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`无法读取 ${fileName}`);
      }
      return response.text();
    })
    .catch((error) => {
      console.error("读取SVG文件时出错:", error);
      alert("读取SVG文件时出错，请检查控制台获取更多信息。");
    });
}

function filterAndStyleSVG(svgData, pathIds) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(svgData, "image/svg+xml");
  const svgElement = xmlDoc.getElementsByTagName("svg")[0];

  // 创建一个新的SVG元素
  const newSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  newSVG.setAttribute("viewBox", svgElement.getAttribute("viewBox"));
  newSVG.setAttribute("width", svgElement.getAttribute("width"));
  newSVG.setAttribute("height", svgElement.getAttribute("height"));

  // 遍历原SVG的所有路径，先将不匹配的路径添加，再将匹配的路径添加到最底部
  const allPaths = svgElement.getElementsByTagName("path");
  let matchedPaths = [];

  Array.from(allPaths).forEach((path) => {
    const pathElement = path.cloneNode(true);
    if (pathIds.includes(pathElement.id)) {
      // 匹配的路径
      pathElement.setAttribute("stroke", "black");
      pathElement.setAttribute("fill", "white");
      // 匹配的路径，暂时存储
      matchedPaths.push(pathElement);
    } else {
      // 不匹配的路径
      pathElement.setAttribute("fill", "gray");
      // 不匹配的路径，直接添加到新SVG中
      newSVG.appendChild(pathElement);
    }
  });

  // 将匹配的路径添加到最底部
  matchedPaths.forEach((path) => newSVG.appendChild(path));

  return newXMLString(newSVG);
}

function newXMLString(element) {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(element);
}

function displayPreview(svgData) {
  const previewSVG = document.getElementById("previewSVG");
  previewSVG.replaceChildren();
  const doc = new DOMParser().parseFromString(svgData, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === "parsererror") {
    previewSVG.textContent = "Invalid SVG";
    return;
  }
  root.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (
        (attr.name === "href" || attr.name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });
  previewSVG.appendChild(document.importNode(root, true));
}

function createDownloadLink(svgData) {
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.getElementById("downloadLink");
  const container = document.getElementById("previewContainer");
  container.style.display = "block";
  link.href = url;
  link.download = "result.svg";
  link.innerText = "下载结果SVG";
}
