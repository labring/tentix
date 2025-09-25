import { apiClient } from "@lib/api-client";

// Upload file utility adapted from chat upload utils
export const uploadAvatar = async (
  file: File,
  userId: number,
): Promise<string> => {
  try {
    const { url, srcUrl } = await apiClient.file["presigned-url"]
      .$get({
        query: {
          fileName: `avatar/${userId}-${Date.now()}-${file.name}`,
          fileType: file.type,
        },
      })
      .then((r) => r.json());

    const response = await fetch(url, {
      method: "PUT",
      body: file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload avatar to storage");
    }

    return srcUrl;
  } catch (error) {
    throw new Error(
      `Failed to upload avatar: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Delete old avatar file
export const deleteOldAvatar = async (avatarUrl: string) => {
  if (!avatarUrl || !avatarUrl.includes("avatar/")) return;

  try {
    // Extract filename from URL - looking for avatar/xxx pattern
    const avatarMatch = avatarUrl.match(/avatar\/[^/?]+/);
    if (!avatarMatch) {
      console.warn("Could not extract avatar filename from URL:", avatarUrl);
      return;
    }

    const fileName = avatarMatch[0];

    await apiClient.file.remove.$delete({
      query: { fileName },
    });
  } catch (error) {
    console.warn("Failed to delete old avatar:", error);
    // Don't throw error as this is not critical
  }
};

// Update user avatar API call
export async function updateUserAvatar(avatar: string, oldAvatar?: string) {
  const res = await apiClient.user.updateProfile.$post({
    json: {
      avatar,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to update avatar");
  }

  const result = await res.json();
  if (!result.success) {
    throw new Error(result.message || "Failed to update avatar");
  }

  // Delete old avatar file if update was successful
  if (oldAvatar) {
    await deleteOldAvatar(oldAvatar);
  }

  return result;
}
