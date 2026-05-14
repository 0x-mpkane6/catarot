export const FakeAPI = {
  drawTarot: async (indexes) => {
    // giả lập delay backend
    await new Promise((res) => setTimeout(res, 800));

    // fake ảnh (sau này m thay bằng API thật)
    return indexes.map((i) => ({
      id: i,
      name: `Card ${i}`,
      image: `https://picsum.photos/100/150?random=${i}`,
    }));
  },
};