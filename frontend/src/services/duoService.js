import api from "./api";

export const createDuoSession =
  async () => {
    const response =
      await api.post(
        "/api/duo/sessions"
      );

    return response.data;
  };

export const joinDuoSession =
  async (id) => {
    const response =
      await api.post(
        `/api/duo/sessions/${id}/join`
      );

    return response.data;
  };

export const joinDuoByInvite =
  async (inviteCode) => {
    const response =
      await api.post(
        "/api/duo/sessions/join_by_invite",
        {
          invite_code:
            String(
              inviteCode || ""
            ).trim(),
        }
      );

    return response.data;
  };

export const uploadDuoCard =
  async (
    id,
    imageFile
  ) => {
    const formData =
      new FormData();

    formData.append(
      "image",
      imageFile
    );

    const response =
      await api.post(
        `/api/duo/sessions/${id}/card`,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

    return response.data;
  };

export const getDuoSession =
  async (id) => {
    const response =
      await api.get(
        `/api/duo/sessions/${id}`
      );

    return response.data;
  };
