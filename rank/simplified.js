function fetchRankings(rankType) {
  fetch(`https://tuxun.fun/api/v0/tuxun/getRank?type=${encodeURIComponent(rankType)}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const rankings = data.data;
        const table = document.getElementById("rankingsTable");
        table.replaceChildren();

        const caption = document.createElement("caption");
        caption.textContent = "Top 200";
        table.appendChild(caption);

        const header = table.insertRow(-1);
        ["排名", "头像", "用户名", "省份", "积分"].forEach((label) => {
          const th = document.createElement("th");
          th.textContent = label;
          header.appendChild(th);
        });

        rankings.forEach((user, index) => {
          const row = table.insertRow(-1);
          const rankCell = row.insertCell(0);
          const avatarCell = row.insertCell(1);
          const userNameCell = row.insertCell(2);
          const provinceCell = row.insertCell(3);
          const ratingCell = row.insertCell(4);

          rankCell.textContent = String(index + 1);

          const avatar = document.createElement("img");
          const icon = user.userAO?.icon ? String(user.userAO.icon).replace(/^\/+/, "") : "";
          avatar.src = `https://i.chao-fan.com/${encodeURI(icon)}?x-oss-process=image/resize,h_120/quality,q_75`;
          avatar.alt = "";
          avatar.referrerPolicy = "no-referrer";
          avatarCell.appendChild(avatar);

          const profileLink = document.createElement("a");
          const userId = user.userAO?.userId ?? "";
          profileLink.href = `https://tuxun.fun/user/${encodeURIComponent(userId)}`;
          profileLink.target = "_blank";
          profileLink.rel = "noopener noreferrer";
          profileLink.className = "profile-link";
          profileLink.textContent = user.userAO?.userName ?? "";
          userNameCell.appendChild(profileLink);

          provinceCell.textContent = user.userAO?.province ?? "";
          ratingCell.textContent =
            user.rating === undefined || user.rating === null
              ? ""
              : String(user.rating);

          if (index < 3) {
            row.classList.add(["gold", "silver", "bronze"][index]);
          }
        });
      } else {
        console.error("Failed to fetch user rankings");
      }
    })
    .catch((error) => {
      console.error("Error fetching user rankings:", error);
    });
}

fetchRankings("world");
