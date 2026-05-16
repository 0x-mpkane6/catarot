export async function getReadingHistory() {

  // fake loading
  await new Promise((resolve) =>
    setTimeout(resolve, 600)
  );

  return [
    { id: 1, title: "Session 1" },
    { id: 2, title: "Session 2" },
    { id: 3, title: "Session 3" },
    { id: 4, title: "Session 4" },
    { id: 5, title: "Session 5" },
    { id: 6, title: "Session 6" },
    { id: 7, title: "Session 7" },
    { id: 8, title: "Session 8" },
    { id: 9, title: "Session 9" },
    { id: 10, title: "Session 10" },

    { id: 11, title: "Session 11" },
    { id: 12, title: "Session 12" },
    { id: 13, title: "Session 13" },
    { id: 14, title: "Session 14" },
    { id: 15, title: "Session 15" },
    { id: 16, title: "Session 16" },
    { id: 17, title: "Session 17" },
    { id: 18, title: "Session 18" },
    { id: 19, title: "Session 19" },
    { id: 20, title: "Session 20" },
  ];
}

