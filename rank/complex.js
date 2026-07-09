function fetchComplexRankings(rankType) {
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
        [
          "排名",
          "头像",
          "用户名",
          "省份",
          "积分",
          "高分",
          "轮次",
          "匹配",
          "胜场",
          "败场",
          "胜率",
          "连胜",
          "连败",
          "长胜",
          "长败",
        ].forEach((label) => {
          const th = document.createElement("th");
          th.textContent = label;
          header.appendChild(th);
        });

        rankings.forEach((user, index) => {
          const row = table.insertRow(-1);
          const cells = Array.from({ length: 15 }, (_, i) => row.insertCell(i));

          cells[0].textContent = String(index + 1);

          const avatar = document.createElement("img");
          const icon = user.userAO?.icon ? String(user.userAO.icon).replace(/^\/+/, "") : "";
          avatar.src = `https://i.chao-fan.com/${encodeURI(icon)}?x-oss-process=image/resize,h_120/quality,q_75`;
          avatar.alt = "";
          avatar.referrerPolicy = "no-referrer";
          cells[1].appendChild(avatar);

          const profileLink = document.createElement("a");
          const userId = user.userAO?.userId ?? "";
          profileLink.href = `https://tuxun.fun/user/${encodeURIComponent(userId)}`;
          profileLink.target = "_blank";
          profileLink.rel = "noopener noreferrer";
          profileLink.className = "profile-link";
          profileLink.textContent = user.userAO?.userName ?? "";
          cells[2].appendChild(profileLink);

          cells[3].textContent = user.userAO?.province ?? "";
          cells[4].textContent =
            user.rating === undefined || user.rating === null
              ? ""
              : String(user.rating);

          if (index < 3) {
            row.classList.add(["gold", "silver", "bronze"][index]);
          }

          fetchUserProfileData(
            rankType,
            userId,
            cells[5],
            cells[6],
            cells[7],
            cells[8],
            cells[9],
            cells[10],
            cells[11],
            cells[12],
            cells[13],
            cells[14],
          );
        });
      } else {
        console.error("Failed to fetch user rankings");
      }
    })
    .catch((error) => {
      console.error("Error fetching user rankings:", error);
    });
}

function fetchUserProfileData(
  rankType,
  userId,
  maxRatingCell,
  gameTimesCell,
  soloTimesCell,
  soloWinCell,
  soloLoseCell,
  winRateCell,
  winningStreakCell,
  loseStreakCell,
  longestWinningStreakCell,
  longestLoseStreakCell,
) {
  fetch(
    `https://tuxun.fun/api/v0/tuxun/getProfile?userId=${encodeURIComponent(userId)}`,
  )
    .then((response) => response.json())
    .then((data) => {
      const rankField = rankType === "world" ? "worldRank" : "chinaRank";
      const rank = data.data?.[rankField] ?? {};
      maxRatingCell.textContent = String(rank.maxRating ?? "");
      gameTimesCell.textContent = String(rank.gameTimes ?? "");
      soloTimesCell.textContent = String(rank.soloTimes ?? "");
      soloWinCell.textContent = String(rank.soloWin ?? "");
      soloLoseCell.textContent = String(rank.soloLose ?? "");

      const wins = Number(rank.soloWin) || 0;
      const losses = Number(rank.soloLose) || 0;
      const denom = wins + losses;
      const winRate = denom > 0 ? (wins / denom) * 100 : 0;
      winRateCell.textContent = `${winRate.toFixed(2)}%`;

      winningStreakCell.textContent = String(rank.winningStreak ?? "");
      loseStreakCell.textContent = String(rank.loseStreak ?? "");
      longestWinningStreakCell.textContent = String(
        rank.longestWinningStreak ?? "",
      );
      longestLoseStreakCell.textContent = String(rank.longestLoseStreak ?? "");
    })
    .catch((error) => {
      console.error("Error fetching user data:", error);
    });
}

fetchComplexRankings("world");
